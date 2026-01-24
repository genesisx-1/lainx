import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

// Expose protected methods that allow the renderer process to use ipcRenderer
contextBridge.exposeInMainWorld('electron', {
  ipcRenderer: {
    invoke: (channel: string, ...args: any[]) => ipcRenderer.invoke(channel, ...args),
    send: (channel: string, ...args: any[]) => ipcRenderer.send(channel, ...args),
    on: (channel: string, func: (...args: any[]) => void) => {
      const subscription = (event: IpcRendererEvent, ...args: any[]) => func(...args);
      ipcRenderer.on(channel, subscription);
      
      return () => {
        ipcRenderer.removeListener(channel, subscription);
      };
    },
    once: (channel: string, func: (...args: any[]) => void) => {
      ipcRenderer.once(channel, (event: IpcRendererEvent, ...args: any[]) => func(...args));
    },
    removeListener: (channel: string, func: (...args: any[]) => void) => {
      ipcRenderer.removeListener(channel, func);
    },
    removeAllListeners: (channel: string) => {
      ipcRenderer.removeAllListeners(channel);
    }
  }
});

// Type definitions for the exposed API
export interface ElectronAPI {
  ipcRenderer: {
    invoke: (channel: string, ...args: any[]) => Promise<any>;
    send: (channel: string, ...args: any[]) => void;
    on: (channel: string, func: (...args: any[]) => void) => () => void;
    once: (channel: string, func: (...args: any[]) => void) => void;
    removeListener: (channel: string, func: (...args: any[]) => void) => void;
    removeAllListeners: (channel: string) => void;
  };
}

declare global {
  interface Window {
    electron: ElectronAPI;
  }
}
