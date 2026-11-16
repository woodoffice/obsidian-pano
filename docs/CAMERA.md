# Camera compatibility record

Verified 16 November 2026 in a separate **Canvas Scenes Review** vault, using the running Obsidian **1.15.1** desktop app on macOS. The installer bundle reports 1.12.7; that is not the running app version. Minimum supported app version is conservatively set to the version actually verified.

Installed public API type declarations: `obsidian` **1.14.4**, pinned by `package-lock.json`. Canvas-specific types are defined locally because they are not part of that public API.

## Integration

Canvas is obtained from a normal Canvas workspace view. The adapter checks the view's file, wrapper element, viewport dimensions and camera functions at runtime.

- `canvas.getViewportBBox()` returns world-coordinate `minX`, `minY`, `maxX`, `maxY`.
- `canvas.canvasRect.width` and `.height` are the viewport size in CSS pixels.
- `canvas.setViewport(centerX, centerY, zoom)` applies an immediate camera position and zoom. It also updates the target values and requests a frame.
- Zoom is **log₂(scale)**. Native rendering clamps the zoom exponent to **−4…1**, equivalent to **6.25%…200%**. The plugin applies the same verified limits before calling the camera.
- Clear `canvas.zoomCenter` before applying a saved view so a prior pointer-centered zoom cannot affect the jump. That field is lazily initialized by Canvas; its absence during initial loading is not an incompatibility.
- `canvas.zoomToBbox()` adds 10% padding and uses an animated target. It is deliberately not used for scene restoration.

All internal camera access lives in `src/camera.ts`. No renderer patches, selection manipulation, screenshot-mode flags or Canvas history writes are needed.

## Scene travel in 0.1.1

The adapter now calls that same immediate viewport method on animation frames. `src/motion.ts` adapts Echo's smootherstep position/width interpolation, distance-based duration (280–550 ms) and pullback (at most 12% of the wider endpoint, constrained by the native zoom floor). The final frame uses the exact fitted destination.

Each Canvas has at most one active flight. A new destination cancels and retargets from the current visible rectangle. Wheel input, direct pointer interaction, keyboard input, a hidden/closed/resized pane, capture, or plugin unload cancels pending frames and listeners. Navigator clicks can choose a replacement destination without an early stop. The system's `prefers-reduced-motion` preference skips the flight; enabling it during travel settles at the destination.

Real-app checks in Obsidian 1.15.1 observed intermediate positions, exact arrival, continuous retargeting, wheel interruption, immediate reduced-motion behavior, and cleanup on disable/re-enable. Saved metadata, Canvas content and undo history remained unchanged by navigation.

Canvas refreshes its cached scale after `setViewport` updates the position and zoom. To avoid combining values from two frames, capture during a flight stops it and uses the last applied pose to compute a coherent rectangle. A real-app regression check confirmed that this saved rectangle exactly matches the settled view; its temporary scene was removed afterward.

## Observed checks

The probe captured a frame at center **(−610.25, −145.75)** with scale **0.8** in a **680 × 722** CSS-pixel viewport:

```text
x = −1035.25
y = −597
width = 850
height = 902.5
```

After moving elsewhere and restoring, every frame component matched, with **0 CSS pixels** maximum measured error.

Changing the viewport to **470 × 430** and restoring yielded the same center and the complete saved frame, with a wider visible rectangle of approximately **986.4535 × 902.5** world units. Changing native sidebar width also retained frame containment in the desktop workflow check.

Native zoom targets beyond both limits were clamped to −4 and 1. Capture, movement and restoration did not change the fixture's Canvas content, undo history, selected IDs or read-only state.

Desktop workflow checks also verified that navigation in a second pane leaves the first pane's camera position and zoom alone; each pane fits the same saved rectangle to its own dimensions.

## Compatibility boundary

These are undocumented implementation details observed in one app version. Shape checks can detect missing methods; they cannot prove unchanged semantics after a future update. Repeat the camera probe and desktop checks before widening the supported version claim. Real hardware/platform checks remain separate from passing TypeScript tests.
