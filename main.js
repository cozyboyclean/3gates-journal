'use strict';
const { app, BrowserWindow, ipcMain, dialog, shell, Menu, nativeTheme, protocol } = require('electron');
const { Readable } = require('stream');
const crypto = require('crypto');

// Screenshots and clips live as files in <data folder>/media and are served to the page via journal-media://m/<file>
protocol.registerSchemesAsPrivileged([{ scheme: 'journal-media', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }]);
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

/* ---------- storage settings: where clips live, and the external-drive backup ---------- */
const cfgFile = () => path.join(dataDir(), 'storage.json');
let CFG = null;
function cfg() { if (!CFG) { try { CFG = JSON.parse(fs.readFileSync(cfgFile(), 'utf8')) || {}; } catch (e) { CFG = {}; } } return CFG; }
function saveCfg() { try { writeAtomic(cfgFile(), JSON.stringify(cfg(), null, 2)); } catch (e) { } }
const defaultMediaDir = () => path.join(dataDir(), 'media');
const mediaDir = () => cfg().mediaDir || defaultMediaDir();
const MIME = { '.mp4': 'video/mp4', '.m4v': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm', '.mkv': 'video/x-matroska', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.bmp': 'image/bmp' };
const safeName = n => { const b = path.basename(String(n || '')); return /^[A-Za-z0-9._-]+$/.test(b) && !b.startsWith('.') ? b : null; };
function newMediaName(ext) {
  ext = String(ext || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) || 'bin';
  const d = new Date(); const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  return `${stamp}-${crypto.randomBytes(5).toString('hex')}.${ext}`;
}
ipcMain.handle('media:add', async (e, src) => {
  fs.mkdirSync(mediaDir(), { recursive: true });
  if (src && typeof src.path === 'string' && src.path) {
    const st = await fs.promises.stat(src.path);
    if (!st.isFile()) throw new Error('Not a file');
    const name = newMediaName(path.extname(src.path).slice(1));
    await fs.promises.copyFile(src.path, path.join(mediaDir(), name));
    return { file: name, size: st.size };
  }
  if (src && src.bytes) {
    const name = newMediaName(src.ext || 'png');
    await fs.promises.writeFile(path.join(mediaDir(), name), Buffer.from(src.bytes));
    return { file: name, size: src.bytes.byteLength };
  }
  throw new Error('Nothing to add');
});
ipcMain.handle('media:delete', async (e, files) => {
  for (const f of Array.isArray(files) ? files : []) { const n = safeName(f); if (n) for (const dir of new Set([mediaDir(), defaultMediaDir()])) await fs.promises.rm(path.join(dir, n), { force: true }).catch(() => { }); }
  return true;
});
const sameDir = (a, b) => path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase();
const driveRoot = dir => path.parse(path.resolve(dir)).root;
const driveThere = dir => { try { return !!dir && fs.existsSync(driveRoot(dir)); } catch (e) { return false; } };
const listMedia = async dir => { try { return (await fs.promises.readdir(dir)).filter(safeName); } catch (e) { return []; } };
async function sizeOf(f) { try { return (await fs.promises.stat(f)).size; } catch (e) { return -1; } }
// copy to a temp name, then rename, so a half-copied file never looks complete
async function copyIfChanged(src, dst) {
  const s = await sizeOf(src); if (s < 0) return false;
  if (await sizeOf(dst) === s) return false;
  await fs.promises.copyFile(src, dst + '.part'); await fs.promises.rename(dst + '.part', dst);
  return true;
}
const S2 = { busy: '', progress: null, lastError: '', wasThere: false };
function storageInfo() {
  const c = cfg();
  return {
    mediaDir: mediaDir(), mediaIsDefault: !c.mediaDir,
    backupDir: c.backupDir || '', backupThere: driveThere(c.backupDir), lastBackup: c.lastBackup || null, lastBackupFiles: c.lastBackupFiles || 0,
    busy: S2.busy, progress: S2.progress, lastError: S2.lastError
  };
}
function pushStorage(msg) { if (win && !win.isDestroyed()) win.webContents.send('storage:changed', storageInfo(), msg || ''); }

async function moveMediaTo(dest) {
  const from = mediaDir();
  if (sameDir(from, dest)) return;
  await fs.promises.mkdir(dest, { recursive: true });
  S2.busy = 'moving'; S2.lastError = '';
  try {
    let names = await listMedia(from); S2.progress = { done: 0, total: names.length }; pushStorage();
    for (const n of names) { await copyIfChanged(path.join(from, n), path.join(dest, n)); S2.progress.done++; pushStorage(); }
    // switch over, then pick up anything added while we were copying
    cfg().movingFrom = from; cfg().mediaDir = sameDir(dest, defaultMediaDir()) ? undefined : dest; saveCfg();
    names = await listMedia(from);
    for (const n of names) await copyIfChanged(path.join(from, n), path.join(dest, n));
    // remove originals only once the copy is verified
    for (const n of names) { const a = path.join(from, n); if (await sizeOf(a) === await sizeOf(path.join(dest, n))) await fs.promises.rm(a, { force: true }).catch(() => { }); }
    await fs.promises.rmdir(from).catch(() => { });
    delete cfg().movingFrom; saveCfg();
  } catch (e) { S2.lastError = 'Move stopped: ' + (e && e.message || e); throw e; }
  finally { S2.busy = ''; S2.progress = null; pushStorage(); }
}

const stamp = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
async function runBackup(why) {
  const dir = cfg().backupDir;
  if (!dir || S2.busy || !driveThere(dir)) return false;
  S2.busy = 'backup'; S2.lastError = ''; pushStorage();
  try {
    await fs.promises.mkdir(path.join(dir, 'media'), { recursive: true });
    await fs.promises.mkdir(path.join(dir, 'history'), { recursive: true });
    if (fs.existsSync(dataFile())) {
      const text = await fs.promises.readFile(dataFile(), 'utf8');
      writeAtomic(path.join(dir, 'journal.json'), text);
      writeAtomic(path.join(dir, 'history', `journal-${stamp(new Date())}.json`), text);
      const hist = (await fs.promises.readdir(path.join(dir, 'history'))).filter(f => /^journal-\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort();
      for (const f of hist.slice(0, Math.max(0, hist.length - 90))) await fs.promises.rm(path.join(dir, 'history', f), { force: true });
    }
    for (const f of ['storage.json']) { try { await fs.promises.copyFile(path.join(dataDir(), f), path.join(dir, f)); } catch (e) { } }
    // clips are added, never removed from the backup, so deleting one in the app can't wipe your only copy
    const names = await listMedia(mediaDir()); let copied = 0;
    S2.progress = { done: 0, total: names.length }; pushStorage();
    for (const n of names) { if (await copyIfChanged(path.join(mediaDir(), n), path.join(dir, 'media', n))) copied++; S2.progress.done++; if (S2.progress.done % 5 === 0) pushStorage(); }
    cfg().lastBackup = new Date().toISOString(); cfg().lastBackupFiles = names.length; saveCfg();
    S2.busy = ''; S2.progress = null;
    pushStorage(why === 'manual' ? 'Backup complete' : `Backed up to ${driveRoot(dir).replace(/\\$/, '')}${copied ? ` (${copied} new clip${copied === 1 ? '' : 's'})` : ''}`);
    return true;
  } catch (e) {
    S2.busy = ''; S2.progress = null; S2.lastError = 'Backup failed: ' + (e && e.message || e); pushStorage(S2.lastError);
    return false;
  }
}
// Look for the backup drive every 30 s. Back up as soon as it's plugged in, and again every 12 h while it stays connected.
function watchBackupDrive() {
  const tick = () => {
    const dir = cfg().backupDir; const there = driveThere(dir);
    const age = cfg().lastBackup ? Date.now() - Date.parse(cfg().lastBackup) : Infinity;
    if (there && (!S2.wasThere || age > 12 * 3600e3)) runBackup('auto');
    if (there !== S2.wasThere) { S2.wasThere = there; pushStorage(); }
  };
  setTimeout(tick, 5000); setInterval(tick, 30000);
  // gentle nudge when the drive hasn't been seen for a week
  let nudged = 0;
  const remind = () => {
    const c = cfg(); if (!c.backupDir || S2.busy || driveThere(c.backupDir)) return;
    const since = Date.parse(c.lastBackup || c.backupSince || '') || Date.now();
    const days = Math.floor((Date.now() - since) / 86400e3);
    if (days < 7 || Date.now() - nudged < 20 * 3600e3) return;
    nudged = Date.now();
    if (win && !win.isDestroyed()) dialog.showMessageBox(win, { type: 'info', message: c.lastBackup ? `Your last backup was ${days} days ago` : `No backup yet`, detail: `Plug in your backup drive (${driveRoot(c.backupDir).replace(/\\$/, '')}) and the journal will back up your trades and clips automatically.` });
  };
  setTimeout(remind, 2 * 60e3); setInterval(remind, 3 * 3600e3);
}

ipcMain.handle('storage:get', () => storageInfo());
ipcMain.handle('storage:pickMedia', async () => {
  if (S2.busy) return storageInfo();
  const r = await dialog.showOpenDialog(win, { title: 'Choose where to keep screenshots and clips', defaultPath: mediaDir(), properties: ['openDirectory', 'createDirectory'] });
  if (r.canceled || !r.filePaths[0]) return storageInfo();
  let dest = r.filePaths[0];
  if (path.basename(dest).toLowerCase() !== 'media' && !/journal/i.test(dest)) dest = path.join(dest, '3 Gates Journal Media');
  if (cfg().backupDir && driveRoot(dest).toLowerCase() === driveRoot(cfg().backupDir).toLowerCase()) { dialog.showMessageBox(win, { type: 'warning', message: "That's your backup drive", detail: "Keep clips on a drive that's always connected, like D:. The backup drive gets a copy automatically." }); return storageInfo(); }
  try { await moveMediaTo(dest); pushStorage('Clips folder changed'); } catch (e) { dialog.showMessageBox(win, { type: 'warning', message: "Couldn't move your clips", detail: String(e && e.message || e) + '\n\nNothing was lost. Your clips are still in the old folder.' }); }
  return storageInfo();
});
ipcMain.handle('storage:pickBackup', async () => {
  const r = await dialog.showOpenDialog(win, { title: 'Choose your backup drive or folder', properties: ['openDirectory', 'createDirectory'] });
  if (r.canceled || !r.filePaths[0]) return storageInfo();
  let dest = r.filePaths[0];
  if (!/journal/i.test(dest)) dest = path.join(dest, '3 Gates Journal Backup');
  if (driveRoot(dest).toLowerCase() === driveRoot(mediaDir()).toLowerCase() || driveRoot(dest).toLowerCase() === driveRoot(dataDir()).toLowerCase()) {
    const a = await dialog.showMessageBox(win, { type: 'warning', buttons: ['Use it anyway', 'Pick another'], defaultId: 1, cancelId: 1, message: 'That drive already holds your journal', detail: 'A backup on the same drive is lost if that drive fails. An external drive is safer.' });
    if (a.response !== 0) return storageInfo();
  }
  cfg().backupDir = dest; cfg().backupSince = new Date().toISOString(); saveCfg(); S2.wasThere = driveThere(dest);
  runBackup('manual');
  return storageInfo();
});
ipcMain.handle('storage:backupNow', async () => {
  if (!cfg().backupDir) return storageInfo();
  if (!driveThere(cfg().backupDir)) { pushStorage(`Plug in your backup drive (${driveRoot(cfg().backupDir).replace(/\\$/, '')}) first`); return storageInfo(); }
  await runBackup('manual'); return storageInfo();
});
ipcMain.handle('storage:stopBackup', () => { delete cfg().backupDir; delete cfg().backupSince; saveCfg(); pushStorage('Backup turned off. Files already on the drive were left in place.'); return storageInfo(); });
ipcMain.handle('storage:open', (e, which) => { const d = which === 'backup' ? cfg().backupDir : mediaDir(); if (d && fs.existsSync(d)) shell.openPath(d); });

function serveMedia(req) {
  const u = new URL(req.url);
  const name = safeName(decodeURIComponent(u.pathname.slice(1)));
  if (!name) return new Response('Bad request', { status: 400 });
  let file = null, st = null;
  for (const dir of [mediaDir(), defaultMediaDir(), cfg().movingFrom].filter(Boolean)) {
    try { const f = path.join(dir, name); const s2 = fs.statSync(f); if (s2.isFile()) { file = f; st = s2; break; } } catch (e) { }
  }
  if (!file) return new Response('Not found', { status: 404 });
  const type = MIME[path.extname(name).toLowerCase()] || 'application/octet-stream';
  const range = req.headers.get('range');
  const m = range && /bytes=(\d*)-(\d*)/.exec(range);
  if (m && (m[1] || m[2])) {
    let start = m[1] ? parseInt(m[1], 10) : Math.max(0, st.size - parseInt(m[2], 10));
    let end = m[1] && m[2] ? Math.min(parseInt(m[2], 10), st.size - 1) : st.size - 1;
    if (start >= st.size || start > end) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${st.size}` } });
    return new Response(Readable.toWeb(fs.createReadStream(file, { start, end })), { status: 206, headers: { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Content-Length': String(end - start + 1), 'Content-Range': `bytes ${start}-${end}/${st.size}` } });
  }
  return new Response(Readable.toWeb(fs.createReadStream(file)), { status: 200, headers: { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Content-Length': String(st.size) } });
}

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
    if (r.response === 0) installNow();
  });
  autoUpdater.checkForUpdates().catch(() => { });
  setInterval(() => autoUpdater.checkForUpdates().catch(() => { }), 4 * 60 * 60 * 1000);
}
// Close every window first (each one saves the journal on its way out), then hand over to the installer
// silently and relaunch afterwards, so nothing of the app is still running when the installer starts.
async function installNow() {
  app.removeAllListeners('window-all-closed');
  await Promise.all(BrowserWindow.getAllWindows().map(w => new Promise(res => {
    if (w.isDestroyed()) return res();
    w.once('closed', res); w.close();
    setTimeout(res, 3000);
  })));
  autoUpdater.quitAndInstall(true, true);
}
function checkNow() {
  if (!autoUpdater || !app.isPackaged) return dialog.showMessageBox(win, { message: 'Updates are only available in the installed app.' });
  if (process.env.PORTABLE_EXECUTABLE_FILE) return dialog.showMessageBox(win, { message: "The portable version doesn't update itself.", detail: 'Install the app with the setup file to get automatic updates.' });
  manualCheck = true; autoUpdater.checkForUpdates().catch(() => { });
}

Menu.setApplicationMenu(Menu.buildFromTemplate([
  { label: 'File', submenu: [{ label: 'Open data folder', click: () => shell.openPath(dataDir()) }, { label: 'Open clips folder', click: () => { fs.mkdirSync(mediaDir(), { recursive: true }); shell.openPath(mediaDir()); } }, { label: 'Back up now', click: () => cfg().backupDir ? (driveThere(cfg().backupDir) ? runBackup('manual') : dialog.showMessageBox(win, { message: 'Backup drive not connected', detail: 'Plug in ' + driveRoot(cfg().backupDir) + ' and try again.' })) : dialog.showMessageBox(win, { message: 'No backup drive set', detail: 'Choose one in Settings → Storage & backup.' }) }, { type: 'separator' }, { role: 'quit' }] },
  { label: 'Edit', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
  { label: 'Help', submenu: [{ label: 'Check for updates…', click: checkNow }, { label: 'About', click: () => dialog.showMessageBox(win, { message: '3 Gates Trade Journal', detail: 'Version ' + app.getVersion() + '\nData folder: ' + dataDir() + '\nClips folder: ' + mediaDir() + (cfg().backupDir ? '\nBackup: ' + cfg().backupDir : '') }) }] },
  { label: 'View', submenu: [{ role: 'reload' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { type: 'separator' }, { role: 'togglefullscreen' }, { role: 'toggleDevTools' }] }
]));

app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.whenReady().then(() => { protocol.handle('journal-media', serveMedia); createWindow(); setupUpdates(); watchBackupDrive(); });
app.on('window-all-closed', () => app.quit());
