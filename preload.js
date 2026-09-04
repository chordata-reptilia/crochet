const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Extended in later tasks (project save/open, PNG/PDF export).
});
