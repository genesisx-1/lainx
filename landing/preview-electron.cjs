const { app, BrowserWindow } = require('electron');

const URL_TO_OPEN = process.env.LAIN_LANDING_URL || 'https://lain-landing.netlify.app';

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    backgroundColor: '#07070a',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.loadURL(URL_TO_OPEN);
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  app.quit();
});

