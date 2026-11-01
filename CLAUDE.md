# Notes for Claude

- Owner: Aron (cozyboyclean). Windows desktop app built with Electron; web version is a claude.ai artifact.
- Shared UI code lives in `app/core.js`, `app/views.js`, `app/forms.js`. Desktop-only behavior is gated on `DESK` (the `window.desktop` preload bridge); web-only on `window.claude`. Keep both working.
- `app/index.html` is the desktop page (offline fonts and Chart.js bundled, CSP). `web/journal.html` is the artifact page; keep their CSS in sync when changing styles.
- Never change the stored data shape in a breaking way: users' `journal.json` must keep loading. Add fields with defaults (see `mergeDefaults`).
- To ship: bump `version` in package.json, commit to main, push tag `vX.Y.Z`. The workflow in `.github/workflows/release.yml` builds on windows-latest and publishes a non-draft GitHub release that electron-updater reads. Put plain-language release notes in the release body.
- Local Linux builds need wine + wine32 (`npm run dist`); CI does not.
