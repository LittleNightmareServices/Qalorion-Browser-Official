const { app, BrowserWindow, ipcMain } = require('electron');
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