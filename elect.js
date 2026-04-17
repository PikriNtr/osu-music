// elect.js
console.log('[main] elect.js loaded');
const { app, BrowserWindow, ipcMain, dialog, nativeImage } = require('electron'); // nanti tambahin nativeImage buat Windows taskbar thumbnail preview w/toolbar-buttons
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { parseOsuMetadata } = require('./osuParser');



const fileServer = express();
const EXPRESS_PORT = 3002;
let songsRoot = null;

fileServer.use(cors());

const buildPath = path.join(__dirname, 'build');
fileServer.use(express.static(buildPath));
fileServer.get('/', (req, res) => {
  res.sendFile(path.join(buildPath, 'index.html'));
});

fileServer.listen(EXPRESS_PORT, () => {
  console.log(`[main] Songs server listening on http://localhost:${EXPRESS_PORT}/songs`);
});


let mainWindow;
function createWindow() {
  console.log('[main] createWindow()');
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,  
    },
  });

  const isDev = !app.isPackaged;
  const frontendURL = isDev
  ? 'http://localhost:3001'
  : `http://localhost:${EXPRESS_PORT}`;
  mainWindow.loadURL(frontendURL);
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => (mainWindow = null));
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});


ipcMain.handle('pick-songs-folder', async () => {
  console.log('[main] pick-songs-folder handler called');
  try {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory'] });
    if (result.canceled) return null;

    songsRoot = result.filePaths[0];
    console.log('[main] user picked folder:', songsRoot);


    fileServer.use('/songs', express.static(songsRoot));
    console.log('[main] mounted /songs →', songsRoot);

    const subfolders = fs
      .readdirSync(songsRoot, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);

    return { folderPath: songsRoot, subfolders };
  } catch (error) {
    console.error('Error picking folder:', error);
    return null;
  }
});


ipcMain.handle('get-beatmap-info', async (event, songsFolder, name) => {
  console.log('[main] get-beatmap-info handler called:', songsFolder, name);
  try {
    const beatmapFolderPath = path.join(songsFolder, name);
    if (!fs.existsSync(beatmapFolderPath)) {
      throw new Error('Beatmap folder does not exist');
    }

    const files = fs.readdirSync(beatmapFolderPath);
    const mp3File = files.find(f => f.endsWith('.mp3'));
    if (!mp3File) {
      throw new Error('Missing required .mp3 file in beatmap folder');
    }


    const mp3Url = `http://localhost:${EXPRESS_PORT}/songs/${encodeURIComponent(name)}/${encodeURIComponent(mp3File)}`;
    console.log('[main] will serve mp3 at →', mp3Url);


    const albumCover = files.find(f => f.endsWith('.jpg') || f.endsWith('.png'));
    let albumCoverData = null;
    if (albumCover) {
      const fullPath = path.join(beatmapFolderPath, albumCover);
      const ext = path.extname(fullPath).slice(1).toLowerCase();
      const mime = ext === 'png' ? 'image/png' : 'image/jpeg';
      const b64 = fs.readFileSync(fullPath, 'base64');
      albumCoverData = `data:${mime};base64,${b64}`;
    }


    // Find the first .osu file
  const osuFile = files.find(f => f.endsWith('.osu'));
  let artist = 'Unknown';
  let title = 'Unknown';

  if (osuFile) {
    const osuPath = path.join(beatmapFolderPath, osuFile);
    const osuContent = fs.readFileSync(osuPath, 'utf-8');
    const metadata = await parseOsuMetadata(osuContent);

    artist = metadata.Artist || 'Unknown';
    title  = metadata.Title  || 'Unknown';
  }


    const beatmapInfo = {
      artist: artist.trim(),
      title:  title.trim(),
    };

    return {
      beatmapInfo,
      mp3Url,
      albumCoverData,
    };
  } catch (error) {
    console.error('Error in get-beatmap-info:', error);
    return { error: error.message };
  }
});
