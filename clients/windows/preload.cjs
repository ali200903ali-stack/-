'use strict';
const {contextBridge,ipcRenderer} = require('electron');
contextBridge.exposeInMainWorld('ninesoftSetup',Object.freeze({
 configure:(url)=>ipcRenderer.invoke('ns:configure',String(url||''))
}));
