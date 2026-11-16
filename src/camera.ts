import { TFile, type View } from 'obsidian';
import { fitFrame, validFrame, type Frame } from './model.ts';
import { sceneFlight, type CameraPose } from './motion.ts';

interface CanvasCamera {
  wrapperEl: HTMLElement;
  canvasRect: { width: number; height: number };
  zoomCenter: unknown;
  getViewportBBox(): { minX: number; minY: number; maxX: number; maxY: number };
  setViewport(x: number, y: number, zoom: number): void;
}

export interface CanvasContext {
  view: View;
  file: TFile;
  path: string;
  camera: CanvasCamera;
}

const flights = new Map<CanvasCamera, () => Frame>();

export function cancelCameraFlights(): void {
  for (const cancel of flights.values()) cancel();
}

// All access to undocumented Canvas objects is confined to this adapter.
export function canvasContext(view: View): CanvasContext | null {
  if (view.getViewType() !== 'canvas') return null;
  const candidate = view as View & { file?: unknown; canvas?: unknown };
  if (!(candidate.file instanceof TFile) || !candidate.canvas || typeof candidate.canvas !== 'object') return null;
  const c = candidate.canvas as Partial<CanvasCamera>;
  if (typeof c.getViewportBBox !== 'function' || typeof c.setViewport !== 'function'
    || !c.canvasRect || typeof c.canvasRect.width !== 'number' || typeof c.canvasRect.height !== 'number'
    || !c.wrapperEl || c.wrapperEl.nodeType !== 1) return null;
  return { view, file: candidate.file, path: candidate.file.path, camera: c as CanvasCamera };
}

export function canvasIsIncompatible(view: View): boolean {
  if (view.getViewType() !== 'canvas') return false;
  const candidate = view as View & { file?: unknown; canvas?: Partial<CanvasCamera> };
  // Canvas views briefly exist before their file and measured viewport are ready.
  // That loading state is not an incompatibility.
  return candidate.file instanceof TFile && !!candidate.canvas?.wrapperEl?.isConnected
    && typeof candidate.canvas.canvasRect?.width === 'number'
    && typeof candidate.canvas.canvasRect?.height === 'number' && !canvasContext(view);
}

export function contextIsCurrent(context: CanvasContext): boolean {
  const current = canvasContext(context.view);
  return current?.file === context.file && current.path === context.path
    && current.camera === context.camera && context.camera.wrapperEl.isConnected;
}

export function cameraIsVisible(context: CanvasContext): boolean {
  const { width, height } = context.camera.canvasRect;
  return contextIsCurrent(context) && context.camera.wrapperEl.getClientRects().length > 0
    && Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0;
}

export function captureFrame(context: CanvasContext): Frame {
  // A capture during travel saves the visible view and leaves it still.
  const stoppedFrame = flights.get(context.camera)?.();
  if (!cameraIsVisible(context)) throw new Error('Open this canvas in a visible pane and try again.');
  const box = context.camera.getViewportBBox();
  const frame = stoppedFrame ?? { x: box.minX, y: box.minY, width: box.maxX - box.minX, height: box.maxY - box.minY };
  if (!validFrame(frame)) throw new Error('This version of Canvas returned an unsupported view. Your scenes have been preserved.');
  return frame;
}

export function restoreFrame(context: CanvasContext, frame: Frame, animate = true): void {
  if (!cameraIsVisible(context)) throw new Error('Open this canvas in a visible pane and try again.');
  const start = captureFrame(context);
  const camera = context.camera;
  const { width, height } = camera.canvasRect;
  const target = fitFrame(frame, width, height);
  const apply = (pose: CameraPose) => {
    camera.zoomCenter = null;
    camera.setViewport(pose.x, pose.y, pose.zoom);
  };
  const win = camera.wrapperEl.ownerDocument.defaultView;
  const reducedMotion = win?.matchMedia('(prefers-reduced-motion: reduce)');
  const flight = sceneFlight(start, target, width);
  const origin = flight.at(0);
  if (!animate || !win || reducedMotion?.matches || (Math.hypot(target.x - origin.x, target.y - origin.y) * 2 ** origin.zoom < 1
    && Math.abs(target.zoom - origin.zoom) < 0.001)) {
    apply(target);
    return;
  }

  let active = true;
  let request = 0;
  let lastPose = origin;
  const started = win.performance.now();
  const cancel = () => {
    active = false;
    win.cancelAnimationFrame(request);
    flights.delete(camera);
    camera.wrapperEl.removeEventListener('wheel', cancel, true);
    camera.wrapperEl.removeEventListener('pointerdown', pointerDown, true);
    win.removeEventListener('keydown', cancel, true);
    reducedMotion?.removeEventListener('change', motionChanged);
    // setViewport updates the pose before Canvas refreshes its cached scale.
    // Capture one coherent pose rather than mixing those two animation frames.
    const scale = 2 ** lastPose.zoom;
    const frameWidth = camera.canvasRect.width / scale;
    const frameHeight = camera.canvasRect.height / scale;
    return { x: lastPose.x - frameWidth / 2, y: lastPose.y - frameHeight / 2, width: frameWidth, height: frameHeight };
  };
  const pointerDown = (event: PointerEvent) => {
    if (!(event.target as Element | null)?.closest?.('.canvas-scenes-navigator')) cancel();
  };
  const motionChanged = () => {
    if (!reducedMotion?.matches) return;
    cancel();
    if (cameraIsVisible(context)) apply(fitFrame(frame, camera.canvasRect.width, camera.canvasRect.height));
  };
  const step = (now: number) => {
    if (!active) return;
    if (!cameraIsVisible(context) || camera.canvasRect.width !== width || camera.canvasRect.height !== height) {
      cancel();
      return;
    }
    const progress = (now - started) / flight.duration;
    lastPose = flight.at(progress);
    apply(lastPose);
    if (progress >= 1) cancel();
    else request = win.requestAnimationFrame(step);
  };
  flights.set(camera, cancel);
  camera.wrapperEl.addEventListener('wheel', cancel, { capture: true, passive: true });
  camera.wrapperEl.addEventListener('pointerdown', pointerDown, true);
  win.addEventListener('keydown', cancel, true);
  reducedMotion?.addEventListener('change', motionChanged);
  request = win.requestAnimationFrame(step);
}
