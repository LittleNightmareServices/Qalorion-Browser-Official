const { app, BrowserWindow, ipcMain, session } = require('electron');
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

  // --- Media Sniffer Logic ---
  const filter = {
    urls: ['*://*/*']
  };

  session.defaultSession.webRequest.onResponseStarted(filter, (details) => {
    const contentType = details.responseHeaders['content-type']?.[0] || '';
    const resourceType = details.resourceType;
    
    // Check for media types
    if (contentType.startsWith('video/') || 
        contentType.startsWith('audio/') || 
        (contentType.startsWith('image/') && parseInt(details.responseHeaders['content-length']?.[0] || '0') > 100000)) { // Filter small images
      
      mainWindow.webContents.send('media-detected', {
        url: details.url,
        type: resourceType,
        mimeType: contentType,
        size: details.responseHeaders['content-length']?.[0] || 'Unknown'
      });
    }
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