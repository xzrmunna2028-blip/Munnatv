import React, { useState, useEffect, useRef } from 'react';
import { Video, VideoOff, Radio, Settings, Copy, Check, RefreshCw, X, Play, Square, AlertCircle, Sparkles, ArrowRight, Zap, Volume2 } from 'lucide-react';

interface BroadcastStudioProps {
  onClose: () => void;
  onNewStreamActive: (streamKey: string) => void;
}

export default function BroadcastStudio({ onClose, onNewStreamActive }: BroadcastStudioProps) {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<string>('');
  const [selectedAudio, setSelectedAudio] = useState<string>('');
  const [streamKey, setStreamKey] = useState<string>('Live_Munna');
  const [isStreaming, setIsStreaming] = useState(false);
  const [resolution, setResolution] = useState<'480p' | '720p' | '1080p'>('720p');
  const [fps, setFps] = useState<30 | 60>(30);
  const [status, setStatus] = useState<'idle' | 'connecting' | 'live' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  
  // Real-time Stats
  const [stats, setStats] = useState({
    sentBytes: 0,
    kbps: 0,
    fps: 0,
    duration: 0
  });

  const [copied, setCopied] = useState(false);
  const [copiedPlayerUrl, setCopiedPlayerUrl] = useState(false);

  const previewRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const statsIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const bytesSentSinceLastCheck = useRef<number>(0);

  // Load available camera and mic devices
  const getDevices = async () => {
    try {
      // Request temporary permission to trigger device names listing
      const tempStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      tempStream.getTracks().forEach(track => track.stop());

      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const videoAndAudio = allDevices.filter(d => d.kind === 'videoinput' || d.kind === 'audioinput');
      setDevices(videoAndAudio);

      // Select first options by default
      const firstVideo = videoAndAudio.find(d => d.kind === 'videoinput');
      const firstAudio = videoAndAudio.find(d => d.kind === 'audioinput');
      if (firstVideo) setSelectedVideo(firstVideo.deviceId);
      if (firstAudio) setSelectedAudio(firstAudio.deviceId);
    } catch (e) {
      console.error("Device access error:", e);
      setErrorMessage("Could not access camera/microphone. Please grant permissions.");
      setStatus('error');
    }
  };

  useEffect(() => {
    getDevices();
    return () => {
      stopStreaming();
    };
  }, []);

  // Update preview when selected device changes
  useEffect(() => {
    if (selectedVideo && !isStreaming) {
      startPreview();
    }
  }, [selectedVideo, selectedAudio, resolution, fps]);

  const startPreview = async () => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }

      const videoConstraints: any = {
        deviceId: selectedVideo ? { exact: selectedVideo } : undefined,
        frameRate: { ideal: fps }
      };

      if (resolution === '1080p') {
        videoConstraints.width = { ideal: 1920 };
        videoConstraints.height = { ideal: 1080 };
      } else if (resolution === '720p') {
        videoConstraints.width = { ideal: 1280 };
        videoConstraints.height = { ideal: 720 };
      } else {
        videoConstraints.width = { ideal: 854 };
        videoConstraints.height = { ideal: 480 };
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraints,
        audio: selectedAudio ? { deviceId: { exact: selectedAudio } } : true
      });

      streamRef.current = stream;
      if (previewRef.current) {
        previewRef.current.srcObject = stream;
      }
    } catch (e) {
      console.error("Preview start error:", e);
    }
  };

  const startStreaming = async () => {
    if (!streamKey.trim()) {
      alert("Please enter a stream key");
      return;
    }

    setStatus('connecting');
    setErrorMessage('');
    
    try {
      // Connect to our specialized streaming WebSocket route
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const wsUrl = `${protocol}//${host}/api/stream-upload?key=${encodeURIComponent(streamKey.trim())}`;
      
      const ws = new WebSocket(wsUrl);
      ws.binaryType = 'arraybuffer';
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("[Studio] WebSocket connection established. Starting recorder.");
        setStatus('live');
        setIsStreaming(true);
        bytesSentSinceLastCheck.current = 0;
        
        // Setup MediaRecorder
        if (!streamRef.current) return;
        
        // Try various codecs for maximum compatibility
        let options = { mimeType: 'video/webm;codecs=vp8,opus' };
        if (!MediaRecorder.isTypeSupported(options.mimeType)) {
          options = { mimeType: 'video/webm;codecs=h264,opus' };
        }
        if (!MediaRecorder.isTypeSupported(options.mimeType)) {
          options = { mimeType: 'video/webm' };
        }

        const recorder = new MediaRecorder(streamRef.current, options);
        mediaRecorderRef.current = recorder;

        recorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0 && ws.readyState === WebSocket.OPEN) {
            event.data.arrayBuffer().then(buf => {
              ws.send(buf);
              bytesSentSinceLastCheck.current += buf.byteLength;
              setStats(prev => ({
                ...prev,
                sentBytes: prev.sentBytes + buf.byteLength
              }));
            });
          }
        };

        // Collect and send data chunks every 1000ms for robust buffering-free flow
        recorder.start(1000);

        // Start stats intervals
        let lastCheckTime = Date.now();
        statsIntervalRef.current = setInterval(() => {
          const now = Date.now();
          const duration = (now - lastCheckTime) / 1000;
          const bitsSent = bytesSentSinceLastCheck.current * 8;
          const kbps = Math.round((bitsSent / duration) / 1024);
          
          setStats(prev => ({
            ...prev,
            kbps: kbps,
            fps: fps
          }));
          
          bytesSentSinceLastCheck.current = 0;
          lastCheckTime = now;
        }, 2000);

        let elapsed = 0;
        durationIntervalRef.current = setInterval(() => {
          elapsed += 1;
          setStats(prev => ({ ...prev, duration: elapsed }));
        }, 1000);
      };

      ws.onerror = (e) => {
        console.error("[Studio] WebSocket error:", e);
        setStatus('error');
        setErrorMessage("Streaming connection failed. Check server state.");
        stopStreaming();
      };

      ws.onclose = () => {
        console.log("[Studio] WebSocket connection closed.");
        stopStreaming();
      };

    } catch (e: any) {
      console.error("Failed to start stream:", e);
      setStatus('error');
      setErrorMessage(e?.message || "Failed to initiate live broadcast.");
      stopStreaming();
    }
  };

  const stopStreaming = () => {
    setIsStreaming(false);
    setStatus('idle');

    if (statsIntervalRef.current) clearInterval(statsIntervalRef.current);
    if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
    
    setStats({
      sentBytes: 0,
      kbps: 0,
      fps: 0,
      duration: 0
    });

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {}
    }

    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch (e) {}
    }

    startPreview(); // Restore normal preview stream
  };

  const formatDuration = (sec: number) => {
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const secs = sec % 60;
    return [
      hrs.toString().padStart(2, '0'),
      mins.toString().padStart(2, '0'),
      secs.toString().padStart(2, '0')
    ].join(':');
  };

  const shareUrl = `${window.location.origin}/live/${streamKey}/index.m3u8`;
  const playerPlayKey = `live_${streamKey}`;

  const copyToClipboard = (text: string, flagSetter: (val: boolean) => void) => {
    navigator.clipboard.writeText(text);
    flagSetter(true);
    setTimeout(() => flagSetter(false), 2000);
  };

  const handleWatchNow = () => {
    onNewStreamActive(streamKey);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto font-sans selection:bg-cyan-500/30">
      <div className="bg-[#0e0f12] border border-[#1e2630] rounded-2xl w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col md:flex-row relative">
        
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white bg-black/40 hover:bg-gray-800 p-2 rounded-full transition-colors z-20 cursor-pointer"
        >
          <X size={18} />
        </button>

        {/* Left Side: Video Preview & Status Indicators */}
        <div className="flex-1 bg-black flex flex-col relative aspect-video md:aspect-auto md:min-h-[460px]">
          <video 
            ref={previewRef}
            autoPlay 
            muted 
            playsInline
            className="w-full h-full object-cover rounded-t-2xl md:rounded-l-2xl md:rounded-tr-none"
          />

          {/* Glowing live indicator overlays */}
          {status === 'live' && (
            <div className="absolute top-4 left-4 bg-red-600 text-white font-bold text-xs px-3 py-1 rounded-full flex items-center gap-1.5 shadow-[0_0_15px_rgba(220,38,38,0.7)] animate-pulse">
              <Zap size={12} className="fill-white" />
              LIVE BROADCASTING
            </div>
          )}

          {status === 'connecting' && (
            <div className="absolute top-4 left-4 bg-cyan-600 text-white font-bold text-xs px-3 py-1 rounded-full flex items-center gap-1.5 shadow-[0_0_15px_rgba(6,182,212,0.7)]">
              <RefreshCw size={12} className="animate-spin" />
              CONNECTING ENGINES...
            </div>
          )}

          {status === 'idle' && (
            <div className="absolute top-4 left-4 bg-gray-800 text-gray-300 font-bold text-xs px-3 py-1 rounded-full flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-gray-500" />
              STUDIO OFFLINE
            </div>
          )}

          {/* Stats Bar (Sticky bottom on preview) */}
          {status === 'live' && (
            <div className="absolute bottom-0 left-0 right-0 bg-black/80 backdrop-blur-md px-4 py-2 text-[11px] sm:text-xs text-gray-300 grid grid-cols-4 gap-2 border-t border-gray-800">
              <div className="text-center border-r border-gray-800">
                <span className="block text-gray-400 font-medium">Uptime</span>
                <span className="font-mono text-cyan-400 text-sm font-bold">{formatDuration(stats.duration)}</span>
              </div>
              <div className="text-center border-r border-gray-800">
                <span className="block text-gray-400 font-medium">Bitrate</span>
                <span className="font-mono text-cyan-400 text-sm font-bold">{stats.kbps} kbps</span>
              </div>
              <div className="text-center border-r border-gray-800">
                <span className="block text-gray-400 font-medium">Video</span>
                <span className="font-mono text-cyan-400 text-sm font-bold">{resolution} ({stats.fps}fps)</span>
              </div>
              <div className="text-center">
                <span className="block text-gray-400 font-medium">Data Sent</span>
                <span className="font-mono text-cyan-400 text-sm font-bold">{(stats.sentBytes / (1024 * 1024)).toFixed(2)} MB</span>
              </div>
            </div>
          )}
        </div>

        {/* Right Side: Stream Configuration Controls */}
        <div className="w-full md:w-[350px] p-5 sm:p-6 flex flex-col justify-between border-t md:border-t-0 md:border-l border-[#1e2630]">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="text-cyan-400 w-5 h-5 fill-cyan-400/20" />
              <h2 className="text-lg font-bold text-white tracking-tight uppercase">Nexarion Live Studio</h2>
            </div>
            <p className="text-xs text-gray-400 mb-5 leading-relaxed">
              Start a buffer-free, high-performance live broadcast instantly from your browser using the optimized Node Media Server pipeline.
            </p>

            <div className="space-y-4">
              {/* Stream Name / Key */}
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Stream Name / Key</label>
                <div className="relative">
                  <input 
                    type="text" 
                    value={streamKey}
                    onChange={(e) => setStreamKey(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))}
                    disabled={isStreaming}
                    placeholder="Enter unique stream name..."
                    className="w-full bg-[#161a22] text-white rounded-lg py-2 px-3 pl-8 text-sm outline-none border border-[#2d3846] focus:border-cyan-400/50 transition-colors disabled:opacity-50"
                  />
                  <Radio size={14} className="absolute left-2.5 top-3 text-cyan-400" />
                </div>
              </div>

              {/* Video Source Device */}
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Webcam Device</label>
                <select 
                  value={selectedVideo}
                  onChange={(e) => setSelectedVideo(e.target.value)}
                  disabled={isStreaming}
                  className="w-full bg-[#161a22] text-white rounded-lg py-2 px-3 text-sm outline-none border border-[#2d3846] focus:border-cyan-400/50 transition-colors cursor-pointer"
                >
                  {devices.filter(d => d.kind === 'videoinput').map(d => (
                    <option key={d.deviceId} value={d.deviceId}>{d.label || `Camera ${d.deviceId.slice(0, 5)}`}</option>
                  ))}
                  {devices.filter(d => d.kind === 'videoinput').length === 0 && (
                    <option value="">No Camera Found</option>
                  )}
                </select>
              </div>

              {/* Audio Source Device */}
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Microphone Device</label>
                <select 
                  value={selectedAudio}
                  onChange={(e) => setSelectedAudio(e.target.value)}
                  disabled={isStreaming}
                  className="w-full bg-[#161a22] text-white rounded-lg py-2 px-3 text-sm outline-none border border-[#2d3846] focus:border-cyan-400/50 transition-colors cursor-pointer"
                >
                  {devices.filter(d => d.kind === 'audioinput').map(d => (
                    <option key={d.deviceId} value={d.deviceId}>{d.label || `Microphone ${d.deviceId.slice(0, 5)}`}</option>
                  ))}
                  {devices.filter(d => d.kind === 'audioinput').length === 0 && (
                    <option value="">No Microphone Found</option>
                  )}
                </select>
              </div>

              {/* Streaming Quality Settings Grid */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Resolution</label>
                  <select 
                    value={resolution}
                    onChange={(e: any) => setResolution(e.target.value)}
                    disabled={isStreaming}
                    className="w-full bg-[#161a22] text-white rounded-lg py-2 px-3 text-xs outline-none border border-[#2d3846] focus:border-cyan-400/50 transition-colors cursor-pointer"
                  >
                    <option value="480p">480p (Fast)</option>
                    <option value="720p">720p (HD)</option>
                    <option value="1080p">1080p (FHD)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Framerate</label>
                  <select 
                    value={fps}
                    onChange={(e: any) => setFps(Number(e.target.value) as any)}
                    disabled={isStreaming}
                    className="w-full bg-[#161a22] text-white rounded-lg py-2 px-3 text-xs outline-none border border-[#2d3846] focus:border-cyan-400/50 transition-colors cursor-pointer"
                  >
                    <option value={30}>30 FPS</option>
                    <option value={60}>60 FPS</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-gray-800/80">
            {errorMessage && (
              <div className="mb-4 text-xs bg-red-950/40 text-red-400 border border-red-900/50 rounded-lg p-2.5 flex items-start gap-1.5 leading-relaxed">
                <AlertCircle size={14} className="mt-0.5 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* In-Studio Stream Output URLs */}
            {status === 'live' && (
              <div className="mb-4 space-y-2 bg-[#161a22] p-2.5 rounded-lg border border-gray-800/80">
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-gray-400 font-medium">HLS Playlist (.m3u8)</span>
                  <button 
                    onClick={() => copyToClipboard(shareUrl, setCopied)}
                    className="text-cyan-400 hover:text-cyan-300 font-medium flex items-center gap-1 cursor-pointer"
                  >
                    {copied ? <Check size={10} /> : <Copy size={10} />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
                
                {/* Watch Now Call to Action */}
                <button 
                  onClick={handleWatchNow}
                  className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs py-1.5 rounded-md flex items-center justify-center gap-1.5 cursor-pointer mt-2 shadow-[0_2px_10px_rgba(6,182,212,0.3)] hover:scale-[1.01] transition-transform"
                >
                  <Play size={12} className="fill-white" />
                  WATCH NOW IN PLAYER
                  <ArrowRight size={12} />
                </button>
              </div>
            )}

            {/* Primary Action Button */}
            {!isStreaming ? (
              <button 
                onClick={startStreaming}
                disabled={status === 'connecting'}
                className="w-full bg-[#10b981] hover:bg-[#059669] text-black font-black uppercase text-sm py-3 px-4 rounded-xl flex items-center justify-center gap-2 tracking-wider transition-all cursor-pointer shadow-[0_4px_15px_rgba(16,185,129,0.3)] active:scale-95 disabled:opacity-50"
              >
                <Radio size={16} className="animate-pulse" />
                START BROADCAST
              </button>
            ) : (
              <button 
                onClick={stopStreaming}
                className="w-full bg-red-600 hover:bg-red-700 text-white font-black uppercase text-sm py-3 px-4 rounded-xl flex items-center justify-center gap-2 tracking-wider transition-all cursor-pointer shadow-[0_4px_15px_rgba(220,38,38,0.3)] active:scale-95"
              >
                <Square size={14} className="fill-white" />
                STOP BROADCAST
              </button>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
