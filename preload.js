const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  saveProjectAs: (jsonString) => ipcRenderer.invoke('project:saveAs', jsonString),
  openProject: () => ipcRenderer.invoke('project:open'),
  exportPng: (dataUrl) => ipcRenderer.invoke('export:png', dataUrl),
  exportPdf: (payload) => ipcRenderer.invoke('export:pdf', payload),
  previewPdf: (payload) => ipcRenderer.invoke('export:pdf-preview', payload),
  readPdfBytes: (filePath) => ipcRenderer.invoke('fs:read-pdf-bytes', filePath),
  exportLegendPdf: (payload) => ipcRenderer.invoke('export:legend-pdf', payload),
  exportLegendPng: (dataUrl) => ipcRenderer.invoke('export:legend-png', dataUrl),
});
