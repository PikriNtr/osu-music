import React, { useState, useEffect, useRef } from 'react';
import { Howl } from 'howler';

import {
  PlayIcon,
  PauseIcon,
  StopIcon,
  BackwardIcon,
  ForwardIcon,
  SpeakerWaveIcon,
  SpeakerXMarkIcon,
  ArrowsRightLeftIcon,
} from '@heroicons/react/24/solid';

const ipcRenderer = window?.electron?.ipcRenderer ?? {
  invoke: async () => { throw new Error('Electron ipcRenderer not available'); },
  on: () => {},
};

export default function App() {
  const [songsFolder, setSongsFolder] = useState('');
  const [beatmapSets, setBeatmapSets] = useState([]);
  const [beatmapInfo, setBeatmapInfo] = useState(null);
  const [audioPlayer, setAudioPlayer] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(0.7);
  const [isMuted, setIsMuted] = useState(false);
  const [shuffleMode, setShuffleMode] = useState(false);
  const [currentSongName, setCurrentSongName] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [sortBy, setSortBy] = useState('title');
  const [bgVideoUrl, setBgVideoUrl] = useState(null);

  const songListRef = useRef(null);
  const activeItemRef = useRef(null);
  const shuffleModeRef = useRef(shuffleMode);
  const beatmapSetsRef = useRef(beatmapSets);
  const videoRef = useRef(null);

  useEffect(() => { shuffleModeRef.current = shuffleMode; }, [shuffleMode]);
  useEffect(() => { beatmapSetsRef.current = beatmapSets; }, [beatmapSets]);

  useEffect(() => {
    if (!searchText && activeItemRef.current && songListRef.current) {
      setTimeout(() => {
        activeItemRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }, 50);
    }
  }, [searchText, currentSongName]);

  useEffect(() => {
    return () => { if (audioPlayer) audioPlayer.unload(); };
  }, [audioPlayer]);

  useEffect(() => {
    const iv = setInterval(() => {
      if (audioPlayer && isPlaying) setCurrentTime(audioPlayer.seek());
    }, 500);
    return () => clearInterval(iv);
  }, [audioPlayer, isPlaying]);

  useEffect(() => {
    if (audioPlayer) audioPlayer.volume(isMuted ? 0 : volume);
  }, [volume, isMuted, audioPlayer]);

  // Sync video mute state with audio mute/volume
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = 0; // always muted (bg video)
    }
  }, [bgVideoUrl]);

  const pickFolder = async () => {
    const result = await ipcRenderer.invoke('pick-songs-folder');
    if (result) {
      setSongsFolder(result.folderPath);
      setBeatmapSets(result.subfolders);
      setBeatmapInfo(null);
      setCurrentSongName(null);
      setBgVideoUrl(null);
    }
  };

  const loadInfo = async (name) => {
    const info = await ipcRenderer.invoke('get-beatmap-info', songsFolder, name);
    if (info.error) return console.error(info.error);

    if (audioPlayer) audioPlayer.stop();
    setBeatmapInfo(info);
    setCurrentSongName(name);
    setCurrentTime(0);

    // Check for .mp4 video background
    // info.mp4Url should be provided by the main process if an .mp4 exists in the beatmap folder
    setBgVideoUrl(info.mp4Url ?? null);

    const player = new Howl({
      src: [info.mp3Url],
      html5: true,
      volume: isMuted ? 0 : volume,
      onplay: () => setIsPlaying(true),
      onpause: () => setIsPlaying(false),
      onstop: () => { setIsPlaying(false); setCurrentTime(0); },
      onend: () => {
        const sets = beatmapSetsRef.current;
        if (sets.length === 0) return;
        if (shuffleModeRef.current) {
          loadInfo(sets[Math.floor(Math.random() * sets.length)]);
        } else {
          const idx = sets.indexOf(name);
          loadInfo(sets[(idx + 1) % sets.length]);
        }
      },
    });

    player.play();
    setAudioPlayer(player);
  };

  const handleNextFrom = (fromName) => {
    const sets = beatmapSetsRef.current;
    if (sets.length === 0) return;
    if (shuffleModeRef.current) {
      loadInfo(sets[Math.floor(Math.random() * sets.length)]);
    } else {
      const idx = sets.indexOf(fromName);
      loadInfo(sets[(idx + 1) % sets.length]);
    }
  };

  const handleNext = () => handleNextFrom(currentSongName);

  const handlePrevious = () => {
    const sets = beatmapSetsRef.current;
    if (sets.length === 0) return;
    const idx = sets.indexOf(currentSongName);
    loadInfo(sets[(idx - 1 + sets.length) % sets.length]);
  };

  const duration = audioPlayer ? audioPlayer.duration() : 0;
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const formatTime = (s) => {
    if (!s || isNaN(s)) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  };

  const getArtist = (name) => name.split(' - ')[1] ?? name;
  const getTitle  = (name) => name.split(' - ')[2] ?? name;

  const filtered = [...beatmapSets]
    .filter(n => n.toLowerCase().includes(searchText.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'artist') return getArtist(a).localeCompare(getArtist(b));
      return getTitle(a).localeCompare(getTitle(b));
    });

  const btn = "flex items-center justify-center w-9 h-9 rounded-full bg-white/10 border border-white/15 text-gray-300 hover:bg-white/20 hover:text-white transition";
  const primary = "w-12 h-12 bg-white text-black hover:bg-gray-200 border-none";
  const activeBtn = "bg-white/20 text-white border-white/30";

  return (
    <div className="flex h-screen bg-[#0a0a0a] text-white">

      <aside className="w-[300px] min-w-[300px] bg-[#111111] border-r border-white/10 flex flex-col">

        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <span className="font-bold text-white tracking-wider">osu!radio</span>
          <button
            onClick={pickFolder}
            className="text-xs text-gray-300 hover:text-white bg-white/10 hover:bg-white/20 px-3 py-1 transition"
          >
            Pick folder
          </button>
        </div>

        {songsFolder ? (
          <>
            <div className="flex gap-2 p-3">
              <input
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
                className="flex-1 bg-white/5 border border-white/10 px-2 py-1 text-sm placeholder-gray-600 focus:outline-none focus:border-white/30"
                placeholder="Search..."
              />
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value)}
                className="bg-white/5 border border-white/10 px-2 py-1 text-xs text-gray-300 focus:outline-none"
              >
                <option value="title">Title</option>
                <option value="artist">Artist</option>
              </select>
            </div>

            <ul
              ref={songListRef}
              className="flex-1 overflow-y-auto px-2 space-y-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
            >
              {filtered.map(name => {
                const isActive = name === currentSongName;
                return (
                  <li
                    key={name}
                    ref={isActive ? activeItemRef : null}
                    onClick={() => loadInfo(name)}
                    className={`px-2 py-1 rounded cursor-pointer text-sm transition ${
                      isActive
                        ? 'bg-white/15 text-white font-medium'
                        : 'text-gray-400 hover:bg-white/8 hover:text-white'
                    }`}
                  >
                    {name}
                  </li>
                );
              })}
            </ul>
          </>
        ) : (
          <div className="p-4 text-gray-600">Pick a folder</div>
        )}
      </aside>

      <main className="flex-1 relative flex items-center justify-center overflow-hidden">
        {beatmapInfo && (
          <div className="absolute inset-0 z-0">
            {bgVideoUrl ? (
              <video
                ref={videoRef}
                key={bgVideoUrl}
                src={bgVideoUrl}
                autoPlay
                loop
                muted
                playsInline
                className="absolute inset-0 w-full h-full object-cover"
                style={{ filter: 'blur(28px) brightness(0.25) saturate(0.6)', transform: 'scale(1.1)' }}
              />
            ) : beatmapInfo.albumCoverData ? (
              <img
                src={beatmapInfo.albumCoverData}
                className="absolute inset-0 w-full h-full object-cover"
                style={{ filter: 'blur(28px) brightness(0.25) saturate(0.6)', transform: 'scale(1.1)' }}
                alt=""
              />
            ) : null}
            <div className="absolute inset-0 bg-black/40" />
          </div>
        )}
        {beatmapInfo ? (
          <div className="relative z-10 flex flex-col items-center gap-6 max-w-md w-full p-8">

            {beatmapInfo.albumCoverData && (
              <img
                src={beatmapInfo.albumCoverData}
                className="w-52 h-52 rounded-2xl shadow-2xl object-cover ring-1 ring-white/10"
                alt="Album cover"
              />
            )}

            <div className="text-center">
              <p className="text-gray-400 text-sm">{beatmapInfo.beatmapInfo.artist}</p>
              <h2 className="text-xl font-semibold text-white">{beatmapInfo.beatmapInfo.title}</h2>
            </div>
            <div className="w-full">
              <div className="flex justify-between text-xs text-gray-500 mb-2">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>

              <div className="relative w-full h-4 flex items-center">
                <div className="absolute w-full h-1 bg-white/10 rounded-full" />
                <div
                  className="absolute h-1 bg-white rounded-full pointer-events-none"
                  style={{ width: `${progress}%` }}
                />
                <div
                  className="absolute w-3 h-3 bg-white rounded-full shadow-md pointer-events-none"
                  style={{ left: `${progress}%`, transform: 'translateX(-50%)' }}
                />
                <input
                  type="range"
                  min={0}
                  max={duration || 0}
                  step={0.1}
                  value={currentTime}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    audioPlayer?.seek(v);
                    setCurrentTime(v);
                  }}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button className={btn} onClick={handlePrevious}>
                <BackwardIcon width={16} />
              </button>
              <button
                className={`${btn} ${primary}`}
                onClick={() => {
                  if (!audioPlayer) return;
                  isPlaying ? audioPlayer.pause() : audioPlayer.play();
                }}
              >
                {isPlaying ? <PauseIcon width={20} /> : <PlayIcon width={20} />}
              </button>
              <button className={btn} onClick={handleNext}>
                <ForwardIcon width={16} />
              </button>
              <button className={btn} onClick={() => audioPlayer?.stop()}>
                <StopIcon width={16} />
              </button>
              <button
                className={`${btn} ${shuffleMode ? activeBtn : ''}`}
                onClick={() => setShuffleMode(!shuffleMode)}
              >
                <ArrowsRightLeftIcon width={16} />
              </button>
              <div className="w-px h-6 bg-white/15 mx-1" />
              <button className={`${btn} ${isMuted || volume === 0 ? activeBtn : ''}`} onClick={() => setIsMuted(m => !m)}>
                {isMuted || volume === 0
                  ? <SpeakerXMarkIcon width={16} />
                  : <SpeakerWaveIcon width={16} />}
              </button>
              <div className="relative w-24 h-4 flex items-center">
                <div className="absolute w-full h-1 bg-white/10 rounded-full" />
                <div
                  className="absolute h-1 bg-white rounded-full pointer-events-none"
                  style={{ width: `${(isMuted ? 0 : volume) * 100}%` }}
                />
                <div
                  className="absolute w-3 h-3 bg-white rounded-full shadow pointer-events-none"
                  style={{
                    left: `${(isMuted ? 0 : volume) * 100}%`,
                    transform: 'translateX(-50%)',
                  }}
                />
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={isMuted ? 0 : volume}
                  onChange={(e) => {
                    setVolume(parseFloat(e.target.value));
                    setIsMuted(false);
                  }}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
              </div>
            </div>

          </div>
        ) : (
          <div className="relative z-10 text-center text-gray-600">No track selected</div>
        )}
      </main>
    </div>
  );
}