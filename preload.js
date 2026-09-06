const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  saveProjectAs: (jsonString) => ipcRenderer.invoke('project:saveAs', jsonString),
  openProject: () => ipcRenderer.invoke('project:open'),
  exportPng: (dataUrl) => ipcRenderer.invoke('export:png', dataUrl),
  exportPdf: (payload) => ipcRenderer.invoke('export:pdf', payload),
  previewPdf: (payload) => ipcRenderer.invoke('export:pdf-preview', payload),
  exportLegendPdf: (chart) => ipcRenderer.invoke('export:legend-pdf', chart),
  exportLegendPng: (dataUrl) => ipcRenderer.invoke('export:legend-png', dataUrl),
});
