'use strict';
const {app, BrowserWindow, ipcMain, shell, dialog} = require('electron');
const fs = require('node:fs');
const path = require('node:path');
let mainWindow;
let setupWindow;

function configPath() {return path.join(app.getPath('userData'),'ninesoft-server.json')}
function normalizeUrl(input) {
  try {
    const value = String(input || '').trim();
    const u = new URL(value);
    if (u.protocol !== 'https:' && !(u.protocol === 'http:' && ['localhost','127.0.0.1'].includes(u.hostname))) return null;
    if (u.username || u.password || u.search || u.hash || !u.hostname) return null;
    return u.origin + u.pathname.replace(/\/+$/,'');
  } catch {return null}
}
function configuredUrl() {
  const env = normalizeUrl(process.env.NINESOFT_URL);
  if (env) return env;
  try {return normalizeUrl(JSON.parse(fs.readFileSync(configPath(),'utf8')).url)}
  catch {return null}
}
function createWindow() {
  const url = configuredUrl();
  if (!url) {
    setupWindow = new BrowserWindow({
      width:520,height:550,minWidth:450,minHeight:500,resizable:true,title:'إعداد NineSoft',
      webPreferences:{preload:path.join(__dirname,'preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true,webviewTag:false}
    });
    setupWindow.setMenuBarVisibility(false);
    setupWindow.loadFile(path.join(__dirname,'setup.html'));
    return;
  }
  const trusted = new URL(url).origin;
  mainWindow = new BrowserWindow({
    width:1380,height:900,minWidth:900,minHeight:620,title:'NineSoft | ناين سوفت',
    backgroundColor:'#f1f8fd',show:false,
    webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,webviewTag:false,allowRunningInsecureContent:false,webSecurity:true}
  });
  mainWindow.setMenuBarVisibility(false);
  mainWindow.once('ready-to-show',()=>mainWindow.show());
  mainWindow.webContents.on('will-navigate',(event,target)=>{
    if (new URL(target).origin !== trusted) {event.preventDefault();if(target.startsWith('https://'))shell.openExternal(target)}
  });
  mainWindow.webContents.setWindowOpenHandler(({url:target})=>{
    if (target.startsWith('https://'))shell.openExternal(target);
    return {action:'deny'};
  });
  mainWindow.loadURL(url.endsWith('/index.php')?url:url+'/index.php').catch(()=>{
    dialog.showErrorBox('اتصال NineSoft','تعذر الاتصال بخادم ناين سوفت. راجع الرابط والاتصال بالإنترنت.');
  });
}
ipcMain.handle('ns:configure',async(event,raw)=>{
  if (!setupWindow || event.sender.id!==setupWindow.webContents.id) return {ok:false,error:'طلب غير مصرح'};
  const url=normalizeUrl(raw);
  if (!url) return {ok:false,error:'استخدم عنوان HTTPS صحيحاً للخادم'};
  fs.mkdirSync(path.dirname(configPath()),{recursive:true});
  fs.writeFileSync(configPath(),JSON.stringify({url},null,2),{mode:0o600});
  setupWindow.close();setupWindow=null;createWindow();
  return {ok:true};
});
if(!app.requestSingleInstanceLock())app.quit();
else {
 app.on('second-instance',()=>{if(mainWindow){if(mainWindow.isMinimized())mainWindow.restore();mainWindow.focus()}});
 app.whenReady().then(createWindow);
 app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit()});
 app.on('activate',()=>{if(!BrowserWindow.getAllWindows().length)createWindow()});
}
