# Pano release readiness

Candidate: **0.1.2** · reviewed locally on **16 November 2026**.

## Local verification

| Check | Result |
| --- | --- |
| TypeScript and production build | Passed |
| Official Obsidian ESLint recommendations | Passed, zero warnings; warnings fail the check |
| Automated tests | 15 passed |
| Additional local release checks | Passed: versions, manifest fields, assets, CSS, runtime imports and bundle syntax |
| Clean install and production build | Passed: byte-identical `main.js` |
| Native settings | Both toggles applied and persisted after plugin reload |
| Configure shortcuts | Opened native Hotkeys filtered to all six Pano commands |
| Owner data | Five existing scenes retained; no board-content changes from settings |
| Name availability | No exact Pano or canvas-scenes match in the official registry checked on this date; not a reservation |

`npm run verify` runs the local release gate. `npm run verify:reproducible` performs a fresh installation/build in an isolated temporary directory and compares the bundle. It needs registry access. These scripts are additional local checks, not a reproduction of Obsidian's private hosted scanner.

GitHub checks and release workflows are prepared under `.github/workflows/`, with pinned action commits. A tag-triggered release workflow verifies the candidate, checks that the tag matches the manifest, attests all three release assets, and uploads `main.js`, `manifest.json` and `styles.css` individually. Current runs are available in [GitHub Actions](https://github.com/woodoffice/obsidian-pano/actions).

## Remaining steps before claiming directory readiness

1. Publish the source repository: [woodoffice/obsidian-pano](https://github.com/woodoffice/obsidian-pano).
2. Run the prepared checks on GitHub, create the matching release and confirm that its assets and attestations are available.
3. Add the entry in the Obsidian developer dashboard and run **Review branch** against the exact candidate commit/tag.
4. Resolve every hosted error and warning, then confirm the hosted scorecard and release version before publishing the directory entry.

The local checks do **not** establish that the directory scorecard is green. Confirm the GitHub release and hosted review results for the exact candidate before publishing the directory entry.

Current submission uses the Community directory dashboard, rather than an old pull request to `community-plugins.json`. The manifest on the default branch and the matching GitHub release must agree. See [Submit your plugin](https://docs.obsidian.md/Plugins/Releasing/Submit%20your%20plugin) and the [directory FAQ](https://docs.obsidian.md/community-directory/faq).

## Minimo lessons applied

- The confirmed 0.1.9 fix removed `!important` from source and generated CSS. Pano's shipping stylesheet contains none, and the release gate rejects it. [Minimo fix](https://github.com/woodoffice/obsidian-minimo/commit/7d94f8cb0d2b3e05c5a1982d342e221ad0bc5e8c)
- Review built assets as well as source. A successful source lint alone does not prove the uploaded release is correct.
- Use native settings, sentence-case labels and theme variables. Avoid a redundant top-level settings heading, inline hard-coded styling, unsafe HTML construction, global `app`, runtime Node/Electron dependencies and imposed hotkeys.
- Register lifecycle resources and clean up controls, dialogs, listeners and animation frames on unload. Do not detach the user's workspace leaves.
- Preserve user data during updates and test native menus, focus and actual keyboard input. Do not infer mobile compatibility from a build.
- Keep release versions aligned, preserve provenance through attestations, and verify the directory has actually scanned the new release. Do not infer a refreshed scorecard from a GitHub release succeeding.

These local rules follow the [Obsidian developer policies](https://docs.obsidian.md/community-directory/developer-policies), [submission requirements](https://docs.obsidian.md/community-directory/submission-requirements-for-plugins), and [review guidelines](https://github.com/obsidianmd/obsidian-developer-docs/blob/main/en/Plugins/Releasing/Plugin%20guidelines.md).

## Deliberate compatibility boundaries

Canvas camera controls have no public plugin API. Their guarded adapter is essential to the plugin and verified against Obsidian 1.15.1. The requested filtered-Hotkeys button uses the host's internal `openTabById`/`setQuery` route, guarded by capability checks and a manual-instructions fallback. Native setting definitions and persistence use public APIs.

An internal method is not automatically a policy violation, but local lint does not establish how the hosted scanner will assess it. Inspect the hosted result before claiming a clean review. Do not hide or suppress a finding to obtain a score.

The existing plugin ID remains `canvas-scenes`; the display name is Pano. Keeping that ID preserves the review vault's saved scenes and custom hotkeys. The chosen macOS previous/next review bindings overlap core back/forward shortcuts; no bindings are imposed on other vaults.

Full-app restart, Windows/Linux, alternate community themes and mobile hardware remain unverified. The manifest conservatively declares desktop-only support and requires Obsidian 1.15.1.
