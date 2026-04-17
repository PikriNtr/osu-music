# osu!radio

A desktop music player that plays songs directly from your local `osu!/Songs` folder. Built with Electron and React.

## Features

- Browse and play songs from your osu! Songs directory
- Displays album art and metadata (artist, title) parsed from `.osu` files
- Search and sort your library by title or artist
- Playback controls: play, pause, stop, previous, next, shuffle
- Volume slider and seekable progress bar

## Tech Stack

- **Electron** — desktop shell and file system access
- **React** — UI and playback logic
- **Howler.js** — audio engine
- **Express** — local HTTP server for streaming `.mp3` files
- **osu-parsers** — reading `.osu` beatmap metadata

## Getting Started

**Prerequisites:** Node.js v16+, Yarn or npm, Windows, and an existing osu! installation.

```bash
git clone https://github.com/PikriNtr/osu-music.git
cd osu-music
yarn install
```

**Development**

```bash
yarn dev
```

**Production**

```bash
yarn build
yarn electron
```

## Usage

Click **"Pick osu! Songs Folder"** and navigate to your Songs directory, typically at:

```
C:\Users\<YourName>\AppData\Local\osu!\Songs
```

The app will list all beatmap sets. Click any song to start playing.


## License

[MIT](LICENSE) — not affiliated with ppy or the official osu! client.
