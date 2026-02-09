import { contextBridge } from 'electron';

contextBridge.exposeInMainWorld('putzpilot', {
  version: '0.0.0',
});
