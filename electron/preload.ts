// import { ipcRenderer, contextBridge } from 'electron'
import { V2NIMClient } from "node-nim";

declare global {
  interface Window {
    v2: V2NIMClient;
  }
}

// window.v2 = new V2NIMClient()

export {};
