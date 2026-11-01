# 3 Gates Trade Journal

A desktop trade journal for futures traders: trade log with partial exits, MFE/MAE, custom statistics and rated comments; statistics, Edge Finder, Tiltmeter, Simulator, daily journal, calendar and accounts.

Trades are stored on the user's own PC (`%APPDATA%\3 Gates Trade Journal\journal.json`, with 30 daily backups). Nothing in this repository contains trade data.

## Install

Download `3-Gates-Trade-Journal-Setup-x.y.z.exe` from the latest [release](../../releases/latest). The installed app updates itself from this repository's releases.

## Layout

- `app/` – the journal UI (HTML, CSS, JS). `core.js`, `views.js`, `forms.js` are shared with the web version.
- `main.js`, `preload.js` – Electron shell: file storage, save dialogs, auto-update.
- `web/journal.html` – the claude.ai web version's page (loads the same three scripts).
- `build/` – icons.

## Releasing an update

1. Make the change and bump `version` in `package.json`.
2. Commit, then tag and push: `git tag v1.2.0 && git push origin main --tags`.
3. GitHub Actions builds the Windows installer and publishes the release. Installed apps pick it up on next launch or within 4 hours.
