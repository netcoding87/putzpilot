const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('putzpilot', {
  version: '0.0.0',
  churchtools: {
    login: (payload) => ipcRenderer.invoke('churchtools:login', payload),
    fetchPersons: (baseUrl) => ipcRenderer.invoke('churchtools:persons', baseUrl),
  },
  selection: {
    get: () => ipcRenderer.invoke('selection:get'),
    set: (selection) => ipcRenderer.invoke('selection:set', selection),
  },
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    set: (settings) => ipcRenderer.invoke('settings:set', settings),
  },
  groups: {
    get: () => ipcRenderer.invoke('groups:get'),
    set: (groups) => ipcRenderer.invoke('groups:set', groups),
  },
  plans: {
    get: () => ipcRenderer.invoke('plans:get'),
    set: (plans) => ipcRenderer.invoke('plans:set', plans),
  },
  aliases: {
    get: () => ipcRenderer.invoke('aliases:get'),
    set: (aliases) => ipcRenderer.invoke('aliases:set', aliases),
  },
});
