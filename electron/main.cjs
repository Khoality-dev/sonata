const { app, BrowserWindow, session, Menu } = require('electron')
const path = require('path')

const isDev = !app.isPackaged
const DEV_URL = process.env.VITE_DEV_SERVER_URL || 'http://127.0.0.1:5173'

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 880,
    minHeight: 520,
    backgroundColor: '#0b0d12',
    autoHideMenuBar: true,
    title: 'my-piano-app',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  if (isDev) {
    win.loadURL(DEV_URL)
    win.webContents.openDevTools({ mode: 'detach' })
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }
}

app.whenReady().then(() => {
  // Auto-grant Web MIDI access (the user is the only consumer of this app)
  const allowedPermissions = new Set([
    'midi',
    'midiSysex',
    'media',
    'mediaKeySystem',
    'audioCapture',
  ])
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(allowedPermissions.has(permission))
  })
  session.defaultSession.setPermissionCheckHandler((_wc, permission) => {
    return allowedPermissions.has(permission)
  })

  if (!isDev) Menu.setApplicationMenu(null)
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
