'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('desktop', {
  load: () => ipcRenderer.sendSync('journal:load'),
  save: text => ipcRenderer.invoke('journal:save', text),
  saveSync: text => ipcRenderer.sendSync('journal:saveSync', text),
  saveFile: (filename, data) => ipcRenderer.invoke('file:save', filename, data),
  openDataFolder: () => ipcRenderer.invoke('folder:open')
});
