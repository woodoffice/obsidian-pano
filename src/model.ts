export interface Frame {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Scene {
  id: string;
  name: string;
  frame: Frame;
}

export interface SceneSettings {
  showNavigator: boolean;
  animateSceneChanges: boolean;
}

export interface SceneData {
  version: 1;
  settings: SceneSettings;
  canvases: Record<string, { scenes: Scene[] }>;
}

export function emptyData(): SceneData {
  return { version: 1, settings: { showNavigator: true, animateSceneChanges: true }, canvases: {} };
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function validFrame(value: unknown): value is Frame {
  if (!record(value)) return false;
  const { x, y, width, height } = value;
  return [x, y, width, height].every(n => typeof n === 'number' && Number.isFinite(n))
    && (width as number) > 0 && (height as number) > 0
    && Number.isFinite((x as number) + (width as number))
    && Number.isFinite((y as number) + (height as number));
}

export function parseData(raw: unknown): SceneData {
  if (raw === null || raw === undefined) return emptyData();
  if (!record(raw) || raw.version !== 1 || !record(raw.settings)
    || typeof raw.settings.showNavigator !== 'boolean'
    || (raw.settings.animateSceneChanges !== undefined && typeof raw.settings.animateSceneChanges !== 'boolean')
    || !record(raw.canvases)) {
    throw new Error('Scene data is invalid or from a newer version. Your stored data has been preserved; restore a valid data file before saving scenes.');
  }
  for (const [path, board] of Object.entries(raw.canvases)) {
    if (!path.endsWith('.canvas') || !record(board) || !Array.isArray(board.scenes)) {
      throw new Error('Scene data contains an invalid canvas record. Your stored data has been preserved.');
    }
    const ids = new Set<string>();
    for (const scene of board.scenes) {
      if (!record(scene) || typeof scene.id !== 'string' || !scene.id
        || ids.has(scene.id) || typeof scene.name !== 'string' || !scene.name.trim()
        || !validFrame(scene.frame)) {
        throw new Error('Scene data contains an invalid scene. Your stored data has been preserved.');
      }
      ids.add(scene.id);
    }
  }
  // Retain additional fields in this schema rather than silently discarding them.
  const data = structuredClone(raw) as unknown as SceneData;
  data.settings.animateSceneChanges ??= true;
  return data;
}

export function nextSceneName(scenes: readonly Scene[]): string {
  const names = new Set(scenes.map(scene => scene.name));
  let number = 1;
  while (names.has(`Scene ${number}`)) number++;
  return `Scene ${number}`;
}

export function destination(scenes: readonly Scene[], anchor: string | null, delta: -1 | 1): Scene | undefined {
  const index = scenes.findIndex(scene => scene.id === anchor);
  if (index < 0) return delta === 1 ? scenes[0] : scenes.at(-1);
  return scenes[index + delta];
}

export function fitFrame(frame: Frame, width: number, height: number): { x: number; y: number; zoom: number } {
  if (!validFrame(frame) || !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error('This canvas is not visible yet. Open it in a visible pane and try again.');
  }
  // Obsidian 1.15.1's native camera range: 2^-4 through 2^1.
  const zoom = Math.max(-4, Math.min(1, Math.log2(Math.min(width / frame.width, height / frame.height))));
  return { x: frame.x + frame.width / 2, y: frame.y + frame.height / 2, zoom };
}

export function renameCanvasPaths(data: SceneData, oldPath: string, newPath: string): void {
  const entries = Object.keys(data.canvases)
    .filter(path => path === oldPath || path.startsWith(`${oldPath}/`))
    .map(path => [path, newPath + path.slice(oldPath.length)] as const);
  if (entries.some(([, target]) => Object.hasOwn(data.canvases, target))) {
    throw new Error('Scenes already exist at the destination path. Both sets of saved scenes have been preserved.');
  }
  for (const [source, target] of entries) {
    data.canvases[target] = data.canvases[source];
    delete data.canvases[source];
  }
}

export class SceneStore {
  private tail: Promise<unknown> = Promise.resolve();
  private readonly listeners = new Set<() => void>();
  private data: SceneData;
  private readonly save: (data: SceneData) => Promise<void>;
  readonly readOnlyReason: string | null;

  constructor(
    data: SceneData,
    save: (data: SceneData) => Promise<void>,
    readOnlyReason: string | null = null,
  ) {
    this.data = data;
    this.save = save;
    this.readOnlyReason = readOnlyReason;
  }

  get writable(): boolean { return this.readOnlyReason === null; }
  get settings(): Readonly<SceneSettings> { return this.data.settings; }
  get showNavigator(): boolean { return this.data.settings.showNavigator; }
  scenes(path: string): readonly Scene[] { return this.data.canvases[path]?.scenes ?? []; }
  hasRecordsUnder(path: string): boolean {
    return Object.keys(this.data.canvases).some(key => key === path || key.startsWith(`${path}/`));
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  update<T>(change: (data: SceneData) => T): Promise<T> {
    const operation = this.tail.then(async () => {
      if (!this.writable) throw new Error(this.readOnlyReason ?? 'Scene data is read-only.');
      const next = structuredClone(this.data);
      const result = change(next);
      await this.save(next);
      this.data = next;
      for (const listener of this.listeners) listener();
      return result;
    });
    this.tail = operation.catch(() => {});
    return operation;
  }
}
