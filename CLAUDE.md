# Notes for Claude

- Owner: Aron (cozyboyclean). Windows desktop app built with Electron; web version is a claude.ai artifact.
- Shared UI code lives in `app/core.js`, `app/views.js`, `app/forms.js`. Desktop-only behavior is gated on `DESK` (the `window.desktop` preload bridge); web-only on `window.claude`. Keep both working.
- `app/index.html` is the desktop page (offline fonts and Chart.js bundled, CSP). `web/journal.html` is the artifact page; keep their CSS in sync when changing styles.
- Never change the stored data shape in a breaking way: users' `journal.json` must keep loading. Add fields with defaults (see `mergeDefaults`).
- To ship: bump `version` in package.json, replace `release-notes.md` with plain-language notes for Aron, commit, push to main. No tag needed (tag pushes are refused from Claude sessions). `.github/workflows/release.yml` runs on package.json changes, skips versions already released, builds on windows-latest and publishes a non-draft release `vX.Y.Z` that electron-updater reads. Check the run with the GitHub Actions UI or ask Aron if it's not visible.
- Local Linux builds need wine + wine32 (`npm run dist`); CI does not.
