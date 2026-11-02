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
  deleteMedia: files => ipcRenderer.invoke('media:delete', files)
});
