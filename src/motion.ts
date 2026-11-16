import type { Frame } from './model.ts';

export interface CameraPose { x: number; y: number; zoom: number }

export function sceneFlight(start: Frame, target: CameraPose, viewportWidth: number) {
  const origin = { x: start.x + start.width / 2, y: start.y + start.height / 2, zoom: Math.log2(viewportWidth / start.width) };
  const targetWidth = viewportWidth / 2 ** target.zoom;
  const travel = Math.hypot(target.x - origin.x, target.y - origin.y);
  const baseWidth = Math.max(start.width, targetWidth);
  // Match Echo's restrained pullback and distance-based timing.
  const bump = Math.min(Math.max(0, viewportWidth * 16 - baseWidth), baseWidth * 0.12, travel * 0.04);
  const duration = 280 + Math.min(270, travel / Math.max(baseWidth, 1) * 60);
  return {
    duration,
    at(progress: number): CameraPose {
      if (progress <= 0) return origin;
      if (progress >= 1) return target;
      const e = progress ** 3 * (progress * (progress * 6 - 15) + 10);
      const width = start.width + (targetWidth - start.width) * e + bump * Math.sin(Math.PI * e);
      return {
        x: origin.x + (target.x - origin.x) * e,
        y: origin.y + (target.y - origin.y) * e,
        zoom: Math.max(-4, Math.min(1, Math.log2(viewportWidth / width))),
      };
    },
  };
}
