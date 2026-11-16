# Data and compatibility

Scenes are saved in the plugin's `data.json`, indexed by vault-relative Canvas path. Canvas files are not modified. File and folder renames observed by Obsidian keep their scenes. Metadata for missing/deleted files is retained so a restored file at the same path can recover its scenes.

Copying or duplicating a `.canvas` file alone does not carry its scenes. Renaming files while Obsidian is closed may break their path association. Cross-device transfer depends on syncing plugin data; simultaneous-device conflict resolution is not provided. Back up plugin data alongside your vault if the scene collection matters to you.

Invalid or newer-format scene data is preserved and saves are disabled until valid data is restored. An unsupported camera disables navigation without deleting scenes.

The optional filtered-Hotkeys button also uses a guarded internal Obsidian settings route. If that route changes, it falls back to instructions for opening Hotkeys manually.

There are no network requests, analytics, external services or runtime plugin dependencies.

## Saved views

Open a Canvas, pan and zoom to frame a view, then click **+** in the lower-left scene navigator. Choose its title to visit a saved scene or open **Manage scenes…**. In narrow panes the navigator sits above Canvas's native add-card controls.

The manager offers Rename, Replace with current view, Move earlier/later and Delete. A deletion has an Undo button for ten seconds. Previous/next stop at the ends. Manual panning keeps your last visited scene as the navigation anchor; it does not update the saved frame.

A scene displays live board content. It does not save an image or restore an older version of your cards. On a differently sized pane, the entire saved frame stays visible, with extra space around it as needed.

Navigation travels smoothly between scenes with eased camera movement and a subtle pullback. Trips take roughly 0.28–0.55 seconds, depending on distance. Panning, zooming or another command can interrupt travel; another scene choice retargets from the current position. Saving during a trip stops the camera and captures the visible frame. With the system's Reduce Motion preference enabled, scenes jump into place immediately.

## Keyboard commands

In **Settings → Pano**, select **Configure shortcuts**. This opens Hotkeys filtered to Pano's commands. You can also open **Settings → Hotkeys** and search for **Pano** yourself.

Choose your preferred bindings, for example:

| Command | Suggested macOS shortcut |
| --- | --- |
| Save scene | ⌘⇧S |
| Previous scene | ⌥⌘← |
| Next scene | ⌥⌘→ |

Choose scene, Manage scenes and Show scene navigator are also available from the command palette. The last command toggles the navigator; keyboard commands continue to work when it is hidden.

No default shortcuts are imposed. Choose bindings in Obsidian’s native Hotkeys page.

The suggested previous/next bindings overlap Obsidian's default back/forward navigation shortcuts on macOS. The native Hotkeys page displays conflicts so you can choose different bindings if desired.

## Compatibility

Requires Obsidian 1.15.1 or newer on desktop. Verified on macOS. Windows, Linux, mobile hardware, a full-app restart and alternate community themes remain unverified. The guarded internal camera and settings routes may require compatibility updates when Obsidian changes.
