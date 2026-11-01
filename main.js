'use strict';
const { app, BrowserWindow, ipcMain, dialog, shell, Menu, nativeTheme } = require('electron');
const path = require('path');
const fs = require('fs');
let autoUpdater = null;
try { ({ autoUpdater } = require('electron-updater')); } catch (e) { }

if (!app.requestSingleInstanceLock()) { app.quit(); }

const dataDir = () => app.getPath('userData');
const dataFile = () => path.join(dataDir(), 'journal.json');
const backupDir = () => path.join(dataDir(), 'backups');
const stateFile = () => path.join(dataDir(), 'window.json');
let win = null;

function writeAtomic(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, text, 'utf8');
  fs.renameSync(tmp, file);
}
function dailyBackup(text) {
  try {
    const d = new Date();
    const name = `journal-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.json`;
    writeAtomic(path.join(backupDir(), name), text);
    const files = fs.readdirSync(backupDir()).filter(f => /^journal-\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort();
    for (const f of files.slice(0, Math.max(0, files.length - 30))) fs.unlinkSync(path.join(backupDir(), f));
  } catch (e) { /* backups are best effort */ }
}
function save(text) {
  if (typeof text !== 'string' || !text.startsWith('{')) throw new Error('Invalid journal data');
  writeAtomic(dataFile(), text);
  dailyBackup(text);
}

ipcMain.on('journal:load', e => {
  try { e.returnValue = fs.existsSync(dataFile()) ? fs.readFileSync(dataFile(), 'utf8') : null; }
  catch (err) { e.returnValue = null; }
});
ipcMain.handle('journal:save', (e, text) => { save(text); return true; });
ipcMain.on('journal:saveSync', (e, text) => { try { save(text); e.returnValue = true; } catch (err) { e.returnValue = false; } });
ipcMain.handle('file:save', async (e, filename, data) => {
  const ext = path.extname(filename).slice(1);
  const r = await dialog.showSaveDialog(win, {
    defaultPath: path.join(app.getPath('documents'), filename),
    filters: ext ? [{ name: ext.toUpperCase() + ' file', extensions: [ext] }, { name: 'All files', extensions: ['*'] }] : []
  });
  if (r.canceled || !r.filePath) return null;
  fs.writeFileSync(r.filePath, data, 'utf8');
  return r.filePath;
});
ipcMain.handle('folder:open', () => shell.openPath(dataDir()));

function loadState() { try { return JSON.parse(fs.readFileSync(stateFile(), 'utf8')); } catch (e) { return { width: 1440, height: 900 }; } }
function saveState() {
  if (!win) return;
  try { const b = win.getNormalBounds(); writeAtomic(stateFile(), JSON.stringify({ ...b, max: win.isMaximized() })); } catch (e) { }
}

function createWindow() {
  const st = loadState();
  win = new BrowserWindow({
    x: st.x, y: st.y, width: st.width || 1440, height: st.height || 900, minWidth: 420, minHeight: 500,
    title: '3 Gates Trade Journal', show: false,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#0e131d' : '#eef1f6',
    icon: path.join(__dirname, 'app', 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: true }
  });
  if (st.max) win.maximize();
  win.once('ready-to-show', () => win.show());
  win.on('close', saveState);
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('file:')) { e.preventDefault(); if (/^https?:/.test(url)) shell.openExternal(url); } });
  win.loadFile(path.join(__dirname, 'app', 'index.html'));
}

/* ---------- auto-update (GitHub Releases) ---------- */
let manualCheck = false;
function setupUpdates() {
  if (!autoUpdater || !app.isPackaged || process.env.PORTABLE_EXECUTABLE_FILE) return;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('update-available', info => { if (manualCheck) dialog.showMessageBox(win, { type: 'info', message: `Version ${info.version} is downloading`, detail: "You'll be asked to restart when it's ready." }); });
  autoUpdater.on('update-not-available', () => { if (manualCheck) dialog.showMessageBox(win, { type: 'info', message: "You're on the latest version", detail: 'Version ' + app.getVersion() }); manualCheck = false; });
  autoUpdater.on('error', err => { if (manualCheck) dialog.showMessageBox(win, { type: 'warning', message: "Couldn't check for updates", detail: String(err && err.message || err) }); manualCheck = false; });
  autoUpdater.on('update-downloaded', async info => {
    manualCheck = false;
    const notes = typeof info.releaseNotes === 'string' ? info.releaseNotes.replace(/<[^>]+>/g, '').trim() : '';
    const r = await dialog.showMessageBox(win, { type: 'info', buttons: ['Restart now', 'Later'], defaultId: 0, cancelId: 1, message: `Version ${info.version} is ready`, detail: (notes ? notes + '\n\n' : '') + 'Restart to update. Your trades are not affected. If you choose Later, it installs the next time you close the app.' });
    if (r.response === 0) autoUpdater.quitAndInstall();
  });
  autoUpdater.checkForUpdates().catch(() => { });
  setInterval(() => autoUpdater.checkForUpdates().catch(() => { }), 4 * 60 * 60 * 1000);
}
function checkNow() {
  if (!autoUpdater || !app.isPackaged) return dialog.showMessageBox(win, { message: 'Updates are only available in the installed app.' });
  if (process.env.PORTABLE_EXECUTABLE_FILE) return dialog.showMessageBox(win, { message: "The portable version doesn't update itself.", detail: 'Install the app with the setup file to get automatic updates.' });
  manualCheck = true; autoUpdater.checkForUpdates().catch(() => { });
}

Menu.setApplicationMenu(Menu.buildFromTemplate([
  { label: 'File', submenu: [{ label: 'Open data folder', click: () => shell.openPath(dataDir()) }, { type: 'separator' }, { role: 'quit' }] },
  { label: 'Edit', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
  { label: 'Help', submenu: [{ label: 'Check for updates…', click: checkNow }, { label: 'About', click: () => dialog.showMessageBox(win, { message: '3 Gates Trade Journal', detail: 'Version ' + app.getVersion() + '\nData folder: ' + dataDir() }) }] },
  { label: 'View', submenu: [{ role: 'reload' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { type: 'separator' }, { role: 'togglefullscreen' }, { role: 'toggleDevTools' }] }
]));

app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.whenReady().then(() => { createWindow(); setupUpdates(); });
app.on('window-all-closed', () => app.quit());
