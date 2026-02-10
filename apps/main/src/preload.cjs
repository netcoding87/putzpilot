const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('putzpilot', {
  version: '0.0.0',
  churchtools: {
    login: (payload) => ipcRenderer.invoke('churchtools:login', payload),
    fetchPersons: (baseUrl) => ipcRenderer.invoke('churchtools:persons', baseUrl),
  },
});
