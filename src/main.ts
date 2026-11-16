import { ButtonComponent, ItemView, Menu, Modal, Notice, Plugin, type View } from 'obsidian';
import { cameraIsVisible, cancelCameraFlights, canvasContext, canvasIsIncompatible, captureFrame, contextIsCurrent, restoreFrame, type CanvasContext } from './camera.ts';
import { ChooseSceneModal, ManageScenesModal, RenameSceneModal, sceneMenu, type SceneDialogActions } from './dialogs.ts';
import { SceneStore, destination, emptyData, nextSceneName, parseData, renameCanvasPaths, type Scene } from './model.ts';
import { PanoSettingTab } from './settings.ts';

export default class PanoPlugin extends Plugin {
  store!: SceneStore;
  private readonly navigators = new Map<View, HTMLElement>();
  private readonly anchors = new WeakMap<View, { file: object; id: string }>();
  private readonly warnedViews = new WeakSet<View>();
  private readonly dialogs = new Set<Modal>();
  private unloaded = false;

  async onload(): Promise<void> {
    try {
      this.store = new SceneStore(parseData(await this.loadData()), data => this.saveData(data));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not load saved scenes. Your stored data has been preserved.';
      this.store = new SceneStore(emptyData(), data => this.saveData(data), message);
      new Notice(message, 12000);
    }
    this.addSettingTab(new PanoSettingTab(this.app, this, this.store));
    this.register(this.store.subscribe(() => {
      if (!this.store.settings.animateSceneChanges) cancelCameraFlights();
      this.refresh();
    }));
    this.command('save-scene', 'Save scene', context => this.perform(() => this.saveScene(context)),
      context => this.store.writable && cameraIsVisible(context));
    for (const [id, name, delta] of [['previous-scene', 'Previous scene', -1], ['next-scene', 'Next scene', 1]] as const) {
      this.command(id, name, context => this.perform(() => {
        const scene = destination(this.store.scenes(context.path), this.anchor(context), delta);
        if (scene) this.visit(context, scene);
      }), context => cameraIsVisible(context) && !!destination(this.store.scenes(context.path), this.anchor(context), delta));
    }
    this.command('choose-scene', 'Choose scene', context => {
      this.openDialog(new ChooseSceneModal(this.app, this.dialogActions(context)));
    }, context => cameraIsVisible(context) && this.store.scenes(context.path).length > 0);
    this.command('manage-scenes', 'Manage scenes', context => this.manage(context));
    this.command('toggle-navigator', 'Show scene navigator', () => this.perform(() => this.store.update(data => {
      data.settings.showNavigator = !data.settings.showNavigator;
    })), () => this.store.writable);
    this.registerEvent(this.app.workspace.on('layout-change', () => this.refresh()));
    this.registerEvent(this.app.workspace.on('active-leaf-change', () => this.refresh()));
    this.registerEvent(this.app.workspace.on('file-open', () => this.refresh()));
    this.registerEvent(this.app.vault.on('rename', (file, oldPath) => {
      const path = file.path;
      if (!this.store.hasRecordsUnder(oldPath)) return;
      this.perform(() => this.store.update(data => renameCanvasPaths(data, oldPath, path)));
    }));
    this.app.workspace.onLayoutReady(() => { if (!this.unloaded) this.refresh(); });
  }

  onunload(): void {
    this.unloaded = true;
    cancelCameraFlights();
    for (const el of this.navigators.values()) el.remove();
    this.navigators.clear();
    for (const dialog of this.dialogs) dialog.close();
    this.dialogs.clear();
  }

  private command(id: string, name: string, run: (context: CanvasContext) => void,
    allowed: (context: CanvasContext) => boolean = () => true): void {
    this.addCommand({ id, name, checkCallback: checking => {
      const view = this.app.workspace.getActiveViewOfType(ItemView);
      const context = view && canvasContext(view);
      if (!context || !allowed(context)) return false;
      if (!checking) run(context);
      return true;
    } });
  }

  private assertCurrent(context: CanvasContext): void {
    if (!contextIsCurrent(context)) throw new Error('This canvas has changed or closed. Open the scene controls again.');
  }

  private anchor(context: CanvasContext): string | null {
    const anchor = this.anchors.get(context.view);
    if (anchor?.file !== context.file) return null;
    return this.store.scenes(context.path).some(scene => scene.id === anchor.id) ? anchor.id : null;
  }

  private setAnchor(context: CanvasContext, scene: Scene): void {
    if (contextIsCurrent(context)) this.anchors.set(context.view, { file: context.file, id: scene.id });
    this.refresh();
  }

  private async saveScene(context: CanvasContext): Promise<void> {
    const frame = captureFrame(context);
    const scene = await this.store.update(data => {
      this.assertCurrent(context);
      const board = data.canvases[context.path] ??= { scenes: [] };
      const scene: Scene = { id: crypto.randomUUID(), name: nextSceneName(board.scenes), frame };
      board.scenes.push(scene);
      return scene;
    });
    this.setAnchor(context, scene);
    new Notice(`Saved ${scene.name}`);
  }

  private visit(context: CanvasContext, scene: Scene): void {
    this.assertCurrent(context);
    const current = this.store.scenes(context.path).find(item => item.id === scene.id);
    if (!current) throw new Error('This scene no longer exists.');
    restoreFrame(context, current.frame, this.store.settings.animateSceneChanges);
    this.setAnchor(context, current);
  }

  private edit(context: CanvasContext, id: string, change: (scenes: Scene[], index: number) => void): Promise<void> {
    return this.store.update(data => {
      this.assertCurrent(context);
      const scenes = data.canvases[context.path]?.scenes;
      const index = scenes?.findIndex(scene => scene.id === id) ?? -1;
      if (!scenes || index < 0) throw new Error('This scene no longer exists.');
      change(scenes, index);
    });
  }

  private options(context: CanvasContext, scene: Scene, event: MouseEvent): void {
    const scenes = this.store.scenes(context.path);
    const index = scenes.findIndex(item => item.id === scene.id);
    const menu = new Menu();
    menu.addItem(item => item.setTitle('Rename').setIcon('pencil').setDisabled(!this.store.writable).onClick(() => {
      this.openDialog(new RenameSceneModal(this.app, scene, async name => {
        try {
          await this.edit(context, scene.id, (scenes, index) => { scenes[index].name = name.trim() || scenes[index].name; });
        } catch (error) { this.report(error); throw error; }
      }));
    }));
    menu.addItem(item => item.setTitle('Replace with current view').setIcon('scan')
      .setDisabled(!this.store.writable || !cameraIsVisible(context)).onClick(() => this.perform(async () => {
        const frame = captureFrame(context);
        await this.edit(context, scene.id, (scenes, index) => { scenes[index].frame = frame; });
        this.setAnchor(context, scene);
        new Notice(`Replaced ${scene.name}`);
      })));
    for (const [title, delta] of [['Move earlier', -1], ['Move later', 1]] as const) {
      menu.addItem(item => item.setTitle(title).setIcon(delta < 0 ? 'arrow-up' : 'arrow-down')
        .setDisabled(!this.store.writable || index + delta < 0 || index + delta >= scenes.length)
        .onClick(() => this.perform(() => this.edit(context, scene.id, (scenes, index) => {
          const target = index + delta;
          if (target >= 0 && target < scenes.length) [scenes[index], scenes[target]] = [scenes[target], scenes[index]];
        }))));
    }
    menu.addSeparator();
    menu.addItem(item => item.setTitle('Delete').setIcon('trash-2').setDisabled(!this.store.writable)
      .onClick(() => this.perform(() => this.deleteScene(context, scene.id))));
    menu.showAtMouseEvent(event);
  }

  private async deleteScene(context: CanvasContext, id: string): Promise<void> {
    let removed: Scene | undefined;
    let oldIndex = 0;
    await this.edit(context, id, (scenes, index) => { oldIndex = index; [removed] = scenes.splice(index, 1); });
    for (const leaf of this.app.workspace.getLeavesOfType('canvas')) {
      const pane = canvasContext(leaf.view);
      if (pane?.file === context.file && this.anchors.get(pane.view)?.id === id) this.anchors.delete(pane.view);
    }
    this.refresh();
    if (!removed) return;
    const deleted = removed;
    const fragment = createFragment();
    fragment.createSpan({ text: `Deleted ${deleted.name} ` });
    const button = fragment.createEl('button', { text: 'Undo', cls: 'canvas-scenes-undo' });
    const notice = new Notice(fragment, 10000);
    button.addEventListener('click', () => {
      button.disabled = true;
      this.perform(async () => {
        await this.store.update(data => {
          this.assertCurrent(context);
          const scenes = (data.canvases[context.path] ??= { scenes: [] }).scenes;
          if (!scenes.some(scene => scene.id === id)) scenes.splice(Math.min(oldIndex, scenes.length), 0, deleted);
        });
        notice.hide();
      });
    });
  }

  private dialogActions(context: CanvasContext): SceneDialogActions {
    return {
      scenes: () => contextIsCurrent(context) ? this.store.scenes(context.path) : [],
      subscribe: listener => this.store.subscribe(listener),
      visit: scene => this.perform(() => this.visit(context, scene)),
      options: (scene, event) => this.options(context, scene, event),
    };
  }

  private openDialog(dialog: Modal): void {
    this.dialogs.add(dialog);
    // Retain only open dialogs, including when the plugin is disabled mid-dialog.
    const onClose = dialog.onClose.bind(dialog);
    dialog.onClose = () => { this.dialogs.delete(dialog); onClose(); };
    dialog.open();
  }

  private manage(context: CanvasContext): void {
    this.openDialog(new ManageScenesModal(this.app, this.dialogActions(context)));
  }

  private refresh(): void {
    if (this.unloaded) return;
    const views = new Set(this.app.workspace.getLeavesOfType('canvas').map(leaf => leaf.view));
    for (const [view, el] of this.navigators) {
      if (!views.has(view) || !this.store.showNavigator || !canvasContext(view)) {
        el.remove();
        this.navigators.delete(view);
      }
    }
    for (const view of views) {
      const context = canvasContext(view);
      if (!context) {
        if (canvasIsIncompatible(view) && !this.warnedViews.has(view)) {
          this.warnedViews.add(view);
          new Notice('Pano cannot access this canvas view. Update the plugin or disable it; saved scenes have been preserved.', 10000);
        }
        continue;
      }
      if (!this.store.showNavigator) continue;
      let el = this.navigators.get(view);
      if (!el || el.parentElement !== context.camera.wrapperEl) {
        el?.remove();
        el = context.camera.wrapperEl.createDiv({ cls: 'canvas-scenes-navigator', attr: { 'aria-label': 'Scene navigator', role: 'group' } });
        el.addEventListener('pointerdown', event => event.stopPropagation());
        el.addEventListener('click', event => event.stopPropagation());
        el.addEventListener('dblclick', event => event.stopPropagation());
        this.navigators.set(view, el);
      }
      el.empty();
      const controls = el.createDiv({ cls: 'canvas-scenes-controls' });
      const scenes = this.store.scenes(context.path);
      const anchor = this.anchor(context);
      const index = scenes.findIndex(scene => scene.id === anchor);
      const visible = cameraIsVisible(context);
      const previous = new ButtonComponent(controls).setIcon('chevron-left').setTooltip('Previous scene')
        .setDisabled(!visible || !destination(scenes, anchor, -1))
        .onClick(() => this.perform(() => {
          const scene = destination(this.store.scenes(context.path), this.anchor(context), -1);
          if (scene) this.visit(context, scene);
        }));
      previous.buttonEl.setAttribute('aria-label', 'Previous scene');
      const label = index >= 0 ? `${scenes[index].name} · ${index + 1} of ${scenes.length}` : 'Scenes';
      const title = new ButtonComponent(controls).setButtonText(label).setClass('canvas-scenes-title')
        .setTooltip('Choose a scene or manage scenes')
        .onClick(event => sceneMenu(event, this.store.scenes(context.path), this.anchor(context),
          scene => this.perform(() => this.visit(context, scene)), () => this.manage(context)));
      title.buttonEl.setAttribute('aria-label', `Choose scene. ${label}`);
      title.buttonEl.setAttribute('aria-haspopup', 'menu');
      const next = new ButtonComponent(controls).setIcon('chevron-right').setTooltip('Next scene')
        .setDisabled(!visible || !destination(scenes, anchor, 1))
        .onClick(() => this.perform(() => {
          const scene = destination(this.store.scenes(context.path), this.anchor(context), 1);
          if (scene) this.visit(context, scene);
        }));
      next.buttonEl.setAttribute('aria-label', 'Next scene');
      const save = new ButtonComponent(controls).setIcon('plus').setTooltip('Save scene')
        .setDisabled(!visible || !this.store.writable).onClick(() => this.perform(() => this.saveScene(context)));
      save.buttonEl.setAttribute('aria-label', 'Save scene');
    }
  }

  private report(error: unknown): void {
    new Notice(`Pano: ${error instanceof Error ? error.message : 'Could not save changes. Please try again.'}`, 10000);
  }

  private perform(action: () => unknown): void {
    void Promise.resolve().then(action).catch(error => this.report(error));
  }
}
