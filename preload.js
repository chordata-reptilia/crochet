const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  saveProjectAs: (jsonString) => ipcRenderer.invoke('project:saveAs', jsonString),
  openProject: () => ipcRenderer.invoke('project:open'),
  exportPng: (dataUrl) => ipcRenderer.invoke('export:png', dataUrl),
  exportPdf: (payload) => ipcRenderer.invoke('export:pdf', payload),
});
