import React, { useState, useEffect, useRef } from 'react';
import { Settings, AlertCircle, Maximize, Minimize, RotateCw, Check } from 'lucide-react';
import Hls from 'hls.js';

interface HlsPlayerProps {
  url: string;
}

const HlsPlayer: React.FC<HlsPlayerProps> = ({ url }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [levels, setLevels] = useState<any[]>([]);
  const [currentLevel, setCurrentLevel] = useState<number>(-1);
  const [isAuto, setIsAuto] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [hlsInstance, setHlsInstance] = useState<Hls | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Pinch to zoom states
  const [zoomScale, setZoomScale] = useState(1);
  const [lastTouchDistance, setLastTouchDistance] = useState<number | null>(null);

  useEffect(() => {
    let hls: Hls | null = null;
    const video = videoRef.current;
    
    if (!video) return;
    
    setError(null);
    setLevels([]);
    setCurrentLevel(-1);
    setIsAuto(true);
    setShowSettings(false);
    setZoomScale(1);

    const isHls = url.toLowerCase().includes('.m3u8') || url.includes('/api/stream-proxy');

    if (isHls && Hls.isSupported()) {
      hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 90,
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        maxBufferSize: 100 * 1024 * 1024, // 100MB max
        liveSyncDuration: 1.5,
        liveMaxLatencyDuration: 3,
        abrBandWidthFactor: 0.95,
        abrBandWidthUpFactor: 0.7,
        testBandwidth: true, // Auto-detect bandwidth
      });

      setHlsInstance(hls);
      hls.loadSource(url);
      hls.attachMedia(video);
      
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setLevels(hls?.levels || []);
        video.play().catch(e => console.log('Auto-play prevented:', e));
      });

      hls.on(Hls.Events.LEVEL_SWITCHED, (_, data) => {
        setCurrentLevel(data.level);
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              hls?.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls?.recoverMediaError();
              break;
            default:
              hls?.destroy();
              setError('Fatal stream error.');
              break;
          }
        }
      });
    } else {
      video.src = url;
      video.addEventListener('loadedmetadata', () => {
        video.play().catch(e => console.log('Auto-play prevented:', e));
      });
    }

    return () => {
      if (hls) hls.destroy();
      setHlsInstance(null);
    };
  }, [url]);

  // Fullscreen logic
  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable full-screen mode: ${err.message}`);
      });
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // Pinch to Zoom logic
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const distance = Math.hypot(
        e.touches[0].pageX - e.touches[1].pageX,
        e.touches[0].pageY - e.touches[1].pageY
      );
      setLastTouchDistance(distance);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && lastTouchDistance !== null) {
      const distance = Math.hypot(
        e.touches[0].pageX - e.touches[1].pageX,
        e.touches[0].pageY - e.touches[1].pageY
      );
      const delta = distance - lastTouchDistance;
      const newScale = Math.min(Math.max(zoomScale + delta * 0.01, 1), 5);
      setZoomScale(newScale);
      setLastTouchDistance(distance);
    }
  };

  const handleTouchEnd = () => {
    setLastTouchDistance(null);
  };

  const selectLevel = (levelIndex: number) => {
    if (!hlsInstance) return;
    hlsInstance.currentLevel = levelIndex;
    setIsAuto(levelIndex === -1);
    setCurrentLevel(levelIndex);
    setShowSettings(false);
  };

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-full bg-black group/player overflow-hidden flex items-center justify-center touch-none"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <video
        ref={videoRef}
        style={{ transform: `scale(${zoomScale})`, transition: lastTouchDistance ? 'none' : 'transform 0.2s' }}
        className="w-full h-full object-contain pointer-events-auto"
        playsInline
        autoPlay
      />

      {/* Custom Overlay Controls */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20 opacity-0 group-hover/player:opacity-100 transition-opacity flex flex-col justify-between p-4 pointer-events-none">
        <div className="flex justify-end gap-2 pointer-events-auto">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 bg-black/40 hover:bg-black/80 rounded-full text-white backdrop-blur-md border border-white/10 transition-all cursor-pointer"
          >
            <Settings size={20} className={showSettings ? 'rotate-45' : ''} />
          </button>
          
          <button
            onClick={toggleFullscreen}
            className="p-2 bg-black/40 hover:bg-black/80 rounded-full text-white backdrop-blur-md border border-white/10 transition-all cursor-pointer"
          >
            {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
          </button>
        </div>

        {/* Settings Menu */}
        {showSettings && (
          <div className="absolute top-16 right-4 bg-gray-900/95 border border-white/10 rounded-2xl py-2 w-48 shadow-2xl z-50 pointer-events-auto max-h-64 overflow-y-auto">
            <div className="px-4 py-2 text-[10px] text-gray-500 font-black uppercase tracking-widest border-b border-white/5">Quality / রেজোলিউশন</div>
            <button
              onClick={() => selectLevel(-1)}
              className="w-full flex items-center justify-between px-4 py-3 text-xs hover:bg-cyan-500/10 text-white transition-colors cursor-pointer"
            >
              <span>Auto (স্বয়ংক্রিয়)</span>
              {isAuto && <Check size={14} className="text-cyan-400" />}
            </button>
            {levels.map((level, idx) => (
              <button
                key={idx}
                onClick={() => selectLevel(idx)}
                className="w-full flex items-center justify-between px-4 py-3 text-xs hover:bg-cyan-500/10 text-white transition-colors cursor-pointer"
              >
                <span>{level.height ? `${level.height}p` : `Level ${idx}`}</span>
                {!isAuto && currentLevel === idx && <Check size={14} className="text-cyan-400" />}
              </button>
            ))}
          </div>
        )}
      </div>

      {zoomScale > 1 && (
        <div className="absolute bottom-4 left-4 bg-cyan-500/20 border border-cyan-500/40 text-cyan-400 text-[10px] px-2 py-1 rounded-full backdrop-blur-md font-bold">
          Zoom: {zoomScale.toFixed(1)}x
        </div>
      )}

      {error && (
        <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center p-6 text-center z-50">
          <AlertCircle size={40} className="text-red-500 mb-3" />
          <p className="text-sm text-white max-w-sm mb-4 leading-relaxed Bengali">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="flex items-center gap-2 bg-white/10 hover:bg-white/20 px-4 py-2 rounded-xl transition-all text-xs font-bold"
          >
            <RotateCw size={14} /> Retry
          </button>
        </div>
      )}
    </div>
  );
};

export default HlsPlayer;
