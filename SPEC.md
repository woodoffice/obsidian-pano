# Pano

Research and proposed specification · 16 November 2026

Status: desktop 0.1.0 accepted in review on 16 November 2026. Echo-style travel was added in 0.1.1. The 0.1.2 Pano candidate adds native navigator/animation settings and a filtered-Hotkeys button; local release checks pass, with directory submission still pending. The existing identifier remains stable to preserve scene data and shortcuts. See [release readiness](docs/RELEASE.md), [camera verification](docs/CAMERA.md) and [usage](README.md).

## Brief

Save the view of an Obsidian Canvas as a scene, then revisit scenes with a shortcut or a small navigator on the board. Keep ordinary Canvas editing intact.

A scene remembers a place and its framing. It displays the board's **current content**: it is not an image capture, a backup, or a historical version of the cards.

The main workflow:

1. Pan and zoom until the view looks right.
2. Save a scene with **⌘⇧S** or the navigator's **+** button.
3. Move elsewhere and save another scene.
4. Visit previous/next scenes with **⌥⌘← / ⌥⌘→**, or choose one by name.

These are recommended user-assigned shortcuts, subject to conflicts in the user's vault. Commands remain available without shortcuts.

## Research findings

### Canvas supplies the board; the plugin supplies saved views

Obsidian documents Canvas navigation, zoom-to-fit, groups and image export, but does not document an equivalent scene navigator. This is a documentation finding, not a claim that every current community plugin lacks the feature. [Obsidian Canvas help](https://obsidian.md/help/plugins/canvas)

JSON Canvas is the open **file format**, not an open-source copy of Obsidian's Canvas renderer. Its 1.0 schema defines nodes and edges, without a standard scene or camera field. Sharing that format with Echo does not make their rendering code interchangeable. [JSON Canvas specification](https://jsoncanvas.org/spec/1.0/)

The public Obsidian TypeScript API does not expose a Canvas viewport interface. Advanced Canvas's own declarations describe internal methods including `getViewportBBox()`, `setViewport(...)`, and `zoomToBbox(...)`. These are credible integration candidates, not an API guarantee. Their coordinate conventions, zoom representation, padding, limits and animation behavior need a real Obsidian check. [Public API declarations](https://raw.githubusercontent.com/obsidianmd/obsidian-api/master/obsidian.d.ts), [Advanced Canvas declarations](https://github.com/Developer-Mike/obsidian-advanced-canvas/blob/main/src/%40types/Canvas.d.ts)

**Conclusion:** the feature is feasible in principle. The main uncertainty is maintaining a small integration with Canvas internals, rather than the scene model itself. Do not build another canvas renderer.

### Existing alternatives

| Reference | Documented approach | Relevance |
| --- | --- | --- |
| Apple Freeform | Capture a view; navigate back/forward or select from a list; rename, replace, delete and reorder scenes | Closest product reference |
| Advanced Canvas | Presentation slides are nodes, connected by arrows; arrow keys navigate in a read-only presentation mode | A broader existing option if presentations are the actual goal |
| Canvas Presentation | Navigate cards/groups in a sequence | Related existing navigation, rather than evidence of arbitrary saved view rectangles |

Sources: [Freeform scene guide](https://support.apple.com/en-mk/guide/freeform/frfm7cc55b64/mac), [Advanced Canvas presentation documentation](https://github.com/Developer-Mike/obsidian-advanced-canvas#presentation-mode), [Canvas Presentation source](https://github.com/Quorafind/Obsidian-Canvas-Presentation/blob/master/canvasPresentationIndex.ts).

This is a targeted comparison, not an exhaustive ecosystem audit. The proposed plugin's reason to exist is a small Freeform-style navigation tool that does not require slide nodes, connecting arrows, or a separate presentation mode. If the integration spike reveals that an existing plugin already delivers this workflow cleanly, reconsider a separate implementation before expanding the project.

### What to reuse from Echo

The current local Echo source implements its project canvas with SwiftUI and AppKit. Its scene record has an ID, title and board rectangle, held separately from board content. Its camera fits scene rectangles to the available viewport and accounts for reduced motion.

The public implementation notes are in [camera compatibility](docs/CAMERA.md).
Reuse the model and framing principles. Implement a small TypeScript equivalent against Obsidian's existing canvas. Do not port AppKit, Echo's renderer, its minimum scene size, integer rounding, autoplay or camera-flight system.

### Lessons from Minimo

- Keep commands, menus and dialogs in Obsidian's normal UI. Minimo exposed a failure where the command palette appeared behind a custom writing view; scene navigation needs no custom fullscreen layer.
- Use Obsidian's native Hotkeys settings. Avoid a second shortcut manager or undocumented settings navigation.
- Treat mobile as a real interaction review: keyboard, touch, typing, rotation and Split View need separate checks.
- Scope styling to plugin elements, use theme variables, and avoid `!important` and broad overrides of Obsidian chrome.
- Retain the small TypeScript/esbuild workflow and Obsidian ESLint checks, while selecting this plugin's own minimum app version from verification.

These lessons come from the Minimo development record and inspected local project configuration. Obsidian also recommends resource cleanup, conditional command callbacks and avoiding default hotkeys. [Plugin review guidelines](https://github.com/obsidianmd/obsidian-developer-docs/blob/main/en/Plugins/Releasing/Plugin%20guidelines.md)

## Proposed first version

### Saving and managing scenes

- Save the active Canvas's visible world-coordinate rectangle immediately, appending a scene to that board's ordered list.
- Name it `Scene 1`, `Scene 2`, etc., choosing the next unused numbered name. No naming dialog interrupts capture; names can be changed afterward.
- Mark the newly saved scene as the current navigation anchor in that pane. Show success only after persistence succeeds.
- Support **Rename**, **Replace with current view**, **Move earlier**, **Move later**, and **Delete** in a scene manager. Keyboard-accessible move actions are sufficient for version one; drag reordering is optional later.
- Replace changes the rectangle while preserving ID, name and position. It requires an explicit action, never an automatic update after panning.
- Delete offers a short-lived Undo action. Do not take over Canvas's own undo history for scene metadata.
- Empty names revert to the existing name. Duplicate descriptive names are allowed; scene identity uses IDs.
- Saving an empty area is valid. Scenes bookmark space and do not need to contain cards.

### Navigation

- Each pane has its own last-visited scene ID in memory; saved scene lists are shared by panes displaying the same file.
- From a fresh pane, Next visits the first scene and Previous visits the last. After that, navigation follows list order and stops at the ends; it does not wrap.
- The navigator shows the last visited scene's name and position. Manual pan/zoom leaves that navigation anchor intact and never rewrites the saved scene. Choosing its name again restores its framing.
- After deletion of the current anchor, clear the anchor without moving the camera. Subsequent Next/Previous use the fresh-pane rule.
- Reordering keeps the current scene by ID. Selecting a scene moves only the originating pane.
- Opening a Canvas leaves Obsidian's normal initial viewport alone. The plugin does not restore a scene automatically.
- Scene navigation uses eased travel with a subtle pullback, adapting Echo's 0.28–0.55-second camera flight. A new destination retargets from the current view; direct camera interaction or capture interrupts it. Reduce Motion uses an immediate jump.
- Navigation must not move cards, change selection, alter read-only state or create Canvas undo entries.

### Framing: more than x and y

Position alone is insufficient: the same center at another zoom shows a different scene. Persist a rectangle in **Canvas world coordinates**, with floating-point precision and negative coordinates allowed.

For a saved rectangle `(x, y, width, height)` and a destination viewport of `W × H` CSS pixels:

```text
centerX = x + width / 2
centerY = y + height / 2
scale = min(W / width, H / height)
```

This is a conceptual scale; the adapter must translate it into Obsidian's verified zoom representation. Capture excludes app sidebars and window chrome.

- Same viewport dimensions: restore the original framing within one CSS pixel at the final zoom, where native zoom limits permit.
- Different aspect ratio: center and contain the entire saved rectangle, showing extra board around it as necessary. Never crop the saved frame or stretch the board.
- Do not add automatic padding, force 16:9, or snap the frame to cards.
- Follow native zoom limits. If those prevent an exact fit, use the closest supported view; do not bypass limits with screenshot/export flags.
- Reject non-finite numbers and non-positive dimensions. Hidden or zero-sized panes cannot capture or navigate until measurable.

### Controls on the board

A compact navigator sits inside each Canvas pane, provisionally at the lower left, without covering native Canvas controls:

```text
[ ‹ ] [ Scene 2 · 2 of 4 ▾ ] [ › ] [ + ]
```

- The title opens a scene list for direct navigation, with **Manage scenes…** as a secondary action.
- With no scenes, show **Scenes** and the save button; previous/next are disabled.
- A **Show scene navigator** command toggles visibility as a plugin preference. Hiding it leaves commands available.
- It appears only in normal Canvas views, not Markdown notes or embedded Canvas previews.
- Controls use Obsidian styling, tooltips, accessible names, visible focus and a compact-width layout. Menus/dialogs use Obsidian's standard components and close with Escape.
- Clicking controls must not initiate board selection or panning. Closing a menu returns focus to the originating Canvas.
- A small navigator is the only persistent UI; the manager is a standard dialog, not a new sidebar.

### Commands and suggested bindings

| Command | macOS recommendation | Windows/Linux recommendation |
| --- | --- | --- |
| Save scene | ⌘⇧S | Ctrl+Shift+S |
| Previous scene | ⌥⌘← | Ctrl+Alt+Left |
| Next scene | ⌥⌘→ | Ctrl+Alt+Right |
| Choose scene | Unassigned | Unassigned |
| Manage scenes | Unassigned | Unassigned |
| Show scene navigator | Unassigned | Unassigned |

Register conditional commands through Obsidian. Do not intercept global keydown events or plain arrow keys. Commands require a compatible active Canvas; navigation also requires an available destination. Saving must work while editing a card without inserting text or losing edits. A dialog pins its originating file/pane when opened and revalidates it before applying an action.

Recommend the suggested bindings in setup/README and configure them in the isolated review vault during implementation. Do not silently change existing vault hotkeys. Obsidian explicitly advises against plugin-assigned defaults because of conflicts. [Hotkeys help](https://obsidian.md/help/hotkeys), [Review guidance](https://github.com/obsidianmd/obsidian-developer-docs/blob/main/en/Plugins/Releasing/Plugin%20guidelines.md#avoid-setting-a-default-hotkey-for-commands)

## Persistence and compatibility

**Recommendation:** use Obsidian's `loadData()` / `saveData()` plugin storage for version one, indexed by vault-relative Canvas path. Save scene edits only; ordinary camera motion and scene visits need no disk writes.

Illustrative schema, not implementation:

```json
{
  "version": 1,
  "settings": { "showNavigator": true },
  "canvases": {
    "Projects/Example.canvas": {
      "scenes": [
        {
          "id": "stable-unique-id",
          "name": "Overview",
          "frame": { "x": -400.5, "y": 120, "width": 1600, "height": 900 }
        }
      ]
    }
  }
}
```

- Do not modify `.canvas` content or Obsidian's workspace files. Uninstalling leaves the board intact; scene metadata remains in plugin data unless removed separately.
- Use `app.vault.configDir`, not a hard-coded `.obsidian` folder, when documenting storage paths.
- Follow file and parent-folder renames/moves observed through Obsidian's Vault events. Preserve metadata rather than overwrite on an unexpected destination collision.
- Keep metadata for deleted/missing files, allowing a restored file at the same path to recover its scenes. Do not expose missing files in the navigator.
- Duplicating a Canvas creates a board without scenes. Moving/renaming files while Obsidian is closed can break their path association. These are explicit first-version limitations.
- Serialize local writes and handle failed saves visibly. Invalid data or an unknown future schema must not be reset and overwritten with defaults.
- Sync depends on the user's tool carrying plugin data. No custom sync or simultaneous-device conflict resolution is promised; conflicting edits may require recovery from sync history.
- Copying a `.canvas` file alone does **not** carry scenes. If self-contained sharing becomes a requirement, revisit sidecars or namespaced Canvas metadata as a separate storage decision.

Keep all private Canvas access in one small adapter. Check capabilities at runtime; unsupported views disable camera actions with an actionable notice and preserve saved data. Prefer public lifecycle events and direct camera methods; avoid prototype patches, polling loops, and undocumented custom events supplied only by another plugin.

No network requests, analytics, native helper, external service or runtime dependency on another Canvas plugin is required.

## Scope boundaries

Included: capture, revisit, order, name, replace and remove scene frames; keyboard commands; compact navigator; persistence.

Deferred: thumbnails/screenshots, scene borders drawn on the board, draggable/resizable frames, selection-derived scenes, autoplay, fullscreen presentation, exports, deep links, collaborative playback, per-scene content versions, and Echo integration.

Target desktop review first, with portable TypeScript and Obsidian APIs throughout. iPad touch and hardware-keyboard support is a second verification gate before advertising mobile compatibility. Windows/Linux bindings are recommendations until tested. Do not copy Minimo's minimum Obsidian version or infer compatibility from its manifest.

## Delivery and acceptance

### 1. Prove camera capture and restoration

In a disposable vault, establish the actual running Obsidian version and Canvas object shape. Capture a frame, move elsewhere, restore it, then repeat after resizing and changing sidebar widths.

**Pass:** measured world frame and center agree with the framing contract; native zoom limits and coordinate conversion are understood; no board-content change or undo entry occurs. Record exact app/API versions and the internal methods used. Failure here changes the plan before UI work.

### 2. Deliver the complete desktop slice

Implement persistence, commands, navigator and manager. Use a small fixture board with widely separated scenes, negative coordinates, text, images and file cards.

**Pass:**

- Save three distinct views; choose, step through, rename, replace, reorder, delete and undo deletion.
- Close/reopen the file, restart Obsidian and disable/re-enable the plugin; frames and order survive.
- Rename the file and its parent folder; scenes follow. Duplicate-file behavior matches the documented limit.
- Open one board in two panes and two boards together; commands affect the correct pane and scene lists stay consistent.
- Type inside a card, invoke Save, use command palette and manager, then continue typing. Menus remain visible and Escape restores usable focus.
- Verify light/dark themes, narrow pane, read-only Canvas, zero/one/many scenes, hidden navigator and missing Canvas core plugin.
- Compare `.canvas` content before/after scene operations on an otherwise idle fixture. Verify cleanup after unload and no duplicate controls after reload.
- Simulate a failed write, invalid stored geometry and unavailable camera methods; errors do not corrupt boards or erase metadata.

Automated checks should cover meaningful geometry, navigation boundaries, schema validation, rename mapping and write ordering; run typecheck, Obsidian ESLint checks and a production build. Real-app checks establish behavior that mocks cannot.

### 3. Review iPad and prepare distribution

Use a separate synced test vault. Verify touch controls, save/choose/previous/next, card typing, keyboard shortcuts, menu dismissal, portrait/landscape and Split View. Verify the storage transfer with the actual sync configuration before claiming cross-device persistence.

Inspect the installed desktop slice with the owner before release. Set manifest/platform claims from observed results. Apply Minimo's release discipline: reproducible assets, lint/test/build checks, scoped CSS review and clear support/compatibility notes. A passing build is not owner acceptance.

## Accepted implementation decisions

1. A scene is a saved view of live content; saving is immediate and naming is optional afterward.
2. Frame containment takes priority over retaining the same zoom on differently sized windows.
3. Plugin data storage keeps Canvas files untouched, with the sharing and offline-rename limits stated above.
4. Previous/next stop at the ends; no presentation mode is needed.
5. Begin implementation with the camera compatibility spike, then review the complete desktop workflow before adding polish.
