import { App, Notice, Plugin, PluginSettingTab, type SettingDefinitionItem } from 'obsidian';
import type { SceneStore } from './model.ts';

export class PanoSettingTab extends PluginSettingTab {
  private readonly pluginId: string;

  constructor(app: App, plugin: Plugin, private readonly store: SceneStore) {
    super(app, plugin);
    this.pluginId = plugin.manifest.id;
  }

  getSettingDefinitions(): SettingDefinitionItem[] {
    return [
      {
        name: 'Show scene navigator',
        desc: 'Display scene controls on each canvas.',
        control: { type: 'toggle', key: 'showNavigator', disabled: () => !this.store.writable },
      },
      {
        name: 'Animate scene changes',
        desc: 'Travel smoothly between scenes. Always respects your system’s reduced motion preference.',
        control: { type: 'toggle', key: 'animateSceneChanges', disabled: () => !this.store.writable },
      },
      {
        name: 'Keyboard shortcuts',
        desc: 'Choose shortcuts for saving scenes and moving between them.',
        render: setting => {
          setting.addButton(button => button.setButtonText('Configure shortcuts').onClick(() => this.openHotkeys()));
        },
      },
    ];
  }

  getControlValue(key: string): unknown {
    if (key === 'showNavigator' || key === 'animateSceneChanges') return this.store.settings[key];
    return undefined;
  }

  async setControlValue(key: string, value: unknown): Promise<void> {
    if ((key !== 'showNavigator' && key !== 'animateSceneChanges') || typeof value !== 'boolean') {
      throw new Error('Unsupported setting value.');
    }
    await this.store.update(data => { data.settings[key] = value; });
  }

  private openHotkeys(): void {
    // Match the host's plugin-menu action. This settings navigation is not public
    // API; capability-check it and keep the manual route usable if it changes.
    const setting = (this.app as App & { setting?: {
      open?: () => void;
      openTabById?: (id: string) => unknown;
    } }).setting;
    try {
      if (typeof setting?.open === 'function' && typeof setting.openTabById === 'function') {
        setting.open();
        const tab = setting.openTabById('hotkeys') as { setQuery?: (query: string) => void } | null | undefined;
        if (typeof tab?.setQuery === 'function') {
          tab.setQuery(this.pluginId);
          return;
        }
      }
    } catch {
      // A changed internal route must not break scene navigation or settings.
    }
    new Notice('Open settings, choose hotkeys, and search for Pano.');
  }
}
