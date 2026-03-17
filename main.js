const { app, BrowserWindow, ipcMain, session, Menu } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 400,
    minHeight: 300,
    frame: false, // Disables the default window frame for custom title bar
    titleBarStyle: 'hidden',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false, // Required for easy IPC and webview usage in renderer for this prototype
      webviewTag: true // Enables the <webview> tag for browser tabs
    }
  });

  mainWindow.loadFile('src/index.html');

  // Handle window controls IPC
  ipcMain.on('window-minimize', () => mainWindow.minimize());
  ipcMain.on('window-maximize', () => {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  });
  ipcMain.on('window-close', () => mainWindow.close());
  
  // App restart
  ipcMain.on('restart-app', () => {
    app.relaunch();
    app.exit(0);
  });

  // Handle new windows correctly
  mainWindow.webContents.setWindowOpenHandler((details) => {
    mainWindow.webContents.send('open-new-tab', details.url);
    return { action: 'deny' };
  });

  // Auto Update logic
  autoUpdater.checkForUpdatesAndNotify();

  autoUpdater.on('update-available', () => {
    mainWindow.webContents.send('hyper-notify', { title: 'Update Available', message: 'Downloading new version...' });
  });

  autoUpdater.on('update-downloaded', () => {
    mainWindow.webContents.send('hyper-notify', { title: 'Update Ready', message: 'Restarting soon to install...', duration: 5000 });
    setTimeout(() => {
        autoUpdater.quitAndInstall();
    }, 5000);
  });

  // --- Download Manager Logic ---
  mainWindow.webContents.session.on('will-download', (event, item, webContents) => {
    const fileName = item.getFilename();
    const url = item.getURL();
    const startTime = Date.now();
    
    // Notify renderer about new download
    mainWindow.webContents.send('download-started', {
      filename: fileName,
      url: url,
      startTime: startTime
    });

    item.on('updated', (event, state) => {
      if (state === 'interrupted') {
        mainWindow.webContents.send('download-interrupted', { filename: fileName });
      } else if (state === 'progressing') {
        if (item.isPaused()) {
          mainWindow.webContents.send('download-paused', { filename: fileName });
        } else {
          mainWindow.webContents.send('download-progress', {
            filename: fileName,
            receivedBytes: item.getReceivedBytes(),
            totalBytes: item.getTotalBytes()
          });
        }
      }
    });

    item.on('done', (event, state) => {
      if (state === 'completed') {
        mainWindow.webContents.send('download-completed', {
          filename: fileName,
          path: item.getSavePath()
        });
      } else {
        mainWindow.webContents.send('download-failed', {
          filename: fileName,
          state: state
        });
      }
    });
  });

  // --- Privacy Logic ---
  ipcMain.on('clear-data', (event, dataTypes) => {
    const ses = session.defaultSession;
    const options = {
      storages: dataTypes || ['appcache', 'cookies', 'filesystem', 'indexdb', 'localstorage', 'shadercache', 'websql', 'serviceworkers', 'cachestorage'],
      quotas: ['temporary', 'persistent', 'syncable']
    };
    
    ses.clearStorageData(options).then(() => {
      mainWindow.webContents.send('hyper-notify', { title: 'Privacy', message: 'Browser data cleared successfully.' });
    });
  });

  // --- Helium Mode Logic ---
  ipcMain.on('toggle-helium', (event, enabled) => {
    if (mainWindow) {
      mainWindow.setAlwaysOnTop(enabled, 'floating');
      mainWindow.setOpacity(enabled ? 0.8 : 1.0);
    }
  });

  // --- Context Menu Logic ---
  app.on('web-contents-created', (e, contents) => {
    if (contents.getType() === 'webview') {
      contents.on('context-menu', (event, params) => {
        const menu = new Menu();
        
        // Navigation
        if (params.linkURL) {
          menu.append(new Menu.Item({
            label: 'Open Link in New Tab',
            click: () => { mainWindow.webContents.send('open-new-tab', params.linkURL); }
          }));
          menu.append(new Menu.Item({
            label: 'Copy Link Address',
            role: 'copyLink'
          }));
          menu.append(new Menu.Item({ type: 'separator' }));
        }

        if (params.mediaType === 'image') {
          menu.append(new Menu.Item({
            label: 'Save Image As...',
            click: () => { contents.downloadURL(params.srcURL); }
          }));
          menu.append(new Menu.Item({
            label: 'Copy Image Address',
            click: () => { require('electron').clipboard.writeText(params.srcURL); }
          }));
          menu.append(new Menu.Item({ type: 'separator' }));
        }

        menu.append(new Menu.Item({ label: 'Back', role: 'back', enabled: contents.canGoBack() }));
        menu.append(new Menu.Item({ label: 'Forward', role: 'forward', enabled: contents.canGoForward() }));
        menu.append(new Menu.Item({ label: 'Reload', role: 'reload' }));
        menu.append(new Menu.Item({ type: 'separator' }));
        
        // Edit operations
        menu.append(new Menu.Item({ label: 'Cut', role: 'cut', enabled: params.editFlags.canCut }));
        menu.append(new Menu.Item({ label: 'Copy', role: 'copy', enabled: params.editFlags.canCopy }));
        menu.append(new Menu.Item({ label: 'Paste', role: 'paste', enabled: params.editFlags.canPaste }));
        menu.append(new Menu.Item({ type: 'separator' }));
        
        // DevTools
        menu.append(new Menu.Item({
          label: 'Inspect Element',
          click: () => { contents.inspectElement(params.x, params.y); }
        }));

        menu.popup();
      });
    }
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});