'use strict';
const { contextBridge, ipcRenderer, webUtils } = require('electron');
contextBridge.exposeInMainWorld('desktop', {
  load: () => ipcRenderer.sendSync('journal:load'),
  save: text => ipcRenderer.invoke('journal:save', text),
  saveSync: text => ipcRenderer.sendSync('journal:saveSync', text),
  saveFile: (filename, data) => ipcRenderer.invoke('file:save', filename, data),
  openDataFolder: () => ipcRenderer.invoke('folder:open'),
  pathFor: file => { try { return webUtils.getPathForFile(file) || ''; } catch (e) { return ''; } },
  addMedia: src => ipcRenderer.invoke('media:add', src),
  deleteMedia: files => ipcRenderer.invoke('media:delete', files),
  clip: {
    available: () => ipcRenderer.invoke('clip:available'),
    pick: () => ipcRenderer.invoke('clip:pick'),
    open: p => ipcRenderer.invoke('clip:open', p),
    cut: o => ipcRenderer.invoke('clip:cut', o),
    remux: o => ipcRenderer.invoke('clip:remux', o),
    onProgress: cb => ipcRenderer.on('clip:progress', (e, job, pct) => cb(job, pct))
  },
  storage: {
    get: () => ipcRenderer.invoke('storage:get'),
    pickMedia: () => ipcRenderer.invoke('storage:pickMedia'),
    pickBackup: () => ipcRenderer.invoke('storage:pickBackup'),
    backupNow: () => ipcRenderer.invoke('storage:backupNow'),
    stopBackup: () => ipcRenderer.invoke('storage:stopBackup'),
    open: which => ipcRenderer.invoke('storage:open', which),
    onChange: cb => ipcRenderer.on('storage:changed', (e, info, msg) => cb(info, msg))
  }
});
