# Development

```sh
npm ci
npm run build
npm run lint
npm test
npm run check:release
npm run setup:review
npm run deploy:review
```

Open `work/Canvas Scenes Review` as a vault and enable the local plugin. Setup creates disposable fixture files and does not overwrite existing files. Deploy updates the three plugin assets and preserves scene data. `work/` and built assets are ignored by Git.

`scripts/eval.mjs` targets only the named review vault using Obsidian's developer CLI. `scripts/verify-desktop.js` and `scripts/verify-lifecycle.js` exercise the real app; inspect their fixture-only changes before running. They require the CLI to be enabled and the review vault open. The desktop script creates three review scenes on its first run.

Camera internals are isolated in `src/camera.ts`. The platform-independent model, geometry, storage validation and serialized transactions are in `src/model.ts`. Controls and commands are in `src/main.ts`; standard Obsidian dialogs are in `src/dialogs.ts`.

## Manual installation

Copy `main.js`, `manifest.json` and `styles.css` into `<vault configuration folder>/plugins/canvas-scenes/`, then enable Pano in Obsidian's Community plugins settings. Preserve any existing `data.json` when updating. The usual configuration folder is `.obsidian`, but Obsidian supports other names.

Pano is available in the [Obsidian Community directory](https://community.obsidian.md/plugins/canvas-scenes). For manual installation, download the three plugin assets from the [latest GitHub release](https://github.com/woodoffice/obsidian-pano/releases/latest).

## Verification

Typecheck, production build, Obsidian ESLint checks and 15 automated tests pass. Real-app checks covered camera accuracy, aspect-ratio changes, scene commands, separate pane cameras, file/folder renames, metadata persistence after vault reload, plugin cleanup, write failure, read-only boards and preservation of newer-format data. Rename (including Enter), reorder, delete and Undo were exercised through the native UI. Light and dark layouts and two narrow panes were inspected. Animation checks verified intermediate camera positions, exact landing, rapid retargeting, wheel interruption, Reduce Motion, and cancellation when the plugin is disabled.

Physical shortcut dispatch while editing a card also passed: ⌘⇧S saves a scene without losing editor focus, typing continues afterward, and ⌥⌘← / ⌥⌘→ navigate while preserving the card text. Temporary test changes were removed and the existing scenes were preserved.

Both native preferences were toggled through the UI and retained after plugin reload, preserving the existing scenes. The filtered-shortcuts button opened the native Hotkeys page with only Pano's six commands.

The initial desktop workflow was accepted in review. Full-app restart, other operating systems, alternate community themes and mobile hardware remain unverified. GitHub and directory review status is recorded in the release-readiness document.

Local release verification also checks manifest/version consistency, shipping CSS, runtime imports and release assets. A separate clean-install check compares a fresh production bundle byte for byte. These do not replace the directory’s hosted preview scan.

See [release readiness](RELEASE.md), [specification](../SPEC.md) and [verified camera behavior](CAMERA.md).
