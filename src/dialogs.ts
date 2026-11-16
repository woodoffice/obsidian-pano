import { App, ButtonComponent, FuzzySuggestModal, Menu, Modal, TextComponent } from 'obsidian';
import type { Scene } from './model.ts';

export interface SceneDialogActions {
  scenes(): readonly Scene[];
  subscribe(listener: () => void): () => void;
  visit(scene: Scene): void;
  options(scene: Scene, event: MouseEvent): void;
}

export class ChooseSceneModal extends FuzzySuggestModal<Scene> {
  constructor(app: App, private readonly actions: SceneDialogActions) {
    super(app);
    this.setPlaceholder('Choose a scene');
  }
  getItems(): Scene[] { return [...this.actions.scenes()]; }
  getItemText(scene: Scene): string { return scene.name; }
  onChooseItem(scene: Scene): void { this.actions.visit(scene); }
}

export class ManageScenesModal extends Modal {
  private unsubscribe?: () => void;

  constructor(app: App, private readonly actions: SceneDialogActions) { super(app); }

  onOpen(): void {
    this.setTitle('Manage scenes');
    this.contentEl.addClass('canvas-scenes-manager');
    this.unsubscribe = this.actions.subscribe(() => this.render());
    this.render();
  }

  private render(): void {
    this.contentEl.empty();
    const scenes = this.actions.scenes();
    if (!scenes.length) {
      this.contentEl.createEl('p', { text: 'No scenes yet. Frame part of your canvas, then save a scene.' });
    }
    scenes.forEach((scene, index) => {
      const row = this.contentEl.createDiv({ cls: 'canvas-scenes-row' });
      row.createSpan({ cls: 'canvas-scenes-index', text: String(index + 1) });
      new ButtonComponent(row).setButtonText(scene.name).setClass('canvas-scenes-name')
        .setTooltip(`Go to ${scene.name}`).onClick(() => { this.close(); this.actions.visit(scene); });
      new ButtonComponent(row).setIcon('ellipsis').setTooltip(`Options for ${scene.name}`)
        .onClick(event => this.actions.options(scene, event));
    });
    const footer = this.contentEl.createDiv({ cls: 'canvas-scenes-footer' });
    new ButtonComponent(footer).setButtonText('Done').onClick(() => this.close());
  }

  onClose(): void { this.unsubscribe?.(); this.contentEl.empty(); }
}

export class RenameSceneModal extends Modal {
  constructor(app: App, private readonly scene: Scene, private readonly rename: (name: string) => Promise<void>) { super(app); }

  onOpen(): void {
    this.setTitle('Rename scene');
    const form = this.contentEl.createEl('form');
    const input = new TextComponent(form).setValue(this.scene.name);
    input.inputEl.setAttribute('aria-label', 'Scene name');
    input.inputEl.addClass('canvas-scenes-rename');
    const footer = form.createDiv({ cls: 'canvas-scenes-footer' });
    const cancel = new ButtonComponent(footer).setButtonText('Cancel').onClick(() => this.close());
    cancel.buttonEl.type = 'button';
    const save = new ButtonComponent(footer).setButtonText('Save').setCta();
    save.buttonEl.type = 'submit';
    form.addEventListener('submit', event => {
      event.preventDefault();
      save.setDisabled(true);
      void this.rename(input.getValue()).then(() => this.close()).catch(() => save.setDisabled(false));
    });
    input.inputEl.focus();
    input.inputEl.select();
  }
  onClose(): void { this.contentEl.empty(); }
}

export function sceneMenu(event: MouseEvent, scenes: readonly Scene[], current: string | null,
  visit: (scene: Scene) => void, manage: () => void): void {
  const menu = new Menu();
  scenes.forEach((scene, index) => menu.addItem(item => item.setTitle(`${index + 1} · ${scene.name}`)
    .setChecked(scene.id === current).onClick(() => visit(scene))));
  if (scenes.length) menu.addSeparator();
  menu.addItem(item => item.setTitle('Manage scenes…').setIcon('list-ordered').onClick(manage));
  menu.showAtMouseEvent(event);
}
