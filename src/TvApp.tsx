import React, { useState, useEffect, useRef } from 'react';
import { RotateCw, Moon, Heart, Trophy, Tv, AlertCircle, Video, Radio, Sparkles, Mic, Settings, Check, MoreVertical, Search, LayoutGrid } from 'lucide-react';
import Hls from 'hls.js';
import { useAppState } from './store';
import AddaRoom from './components/AddaRoom';

const ICON_MAP: Record<string, any> = {
  Heart,
  Trophy,
  Tv,
  Settings,
  Sparkles,
  LayoutGrid
};

// @ts-ignore
import logoImg from './assets/images/nexarion_logo_1783781161849.jpg';

// Dynamic country flags resolver for Asia/Global countries (Bangla + English support)
const getCountryFlag = (name: string): string => {
  if (!name) return "";
  const clean = name.trim().toLowerCase();
  
  const mapping: Record<string, string> = {
    'bangladesh': '🇧🇩', 'বাংলাদেশ': '🇧🇩', 'bd': '🇧🇩', 'ban': '🇧🇩',
    'india': '🇮🇳', 'ভারত': '🇮🇳', 'ind': '🇮🇳',
    'pakistan': '🇵🇰', 'পাকিস্তান': '🇵🇰', 'pak': '🇵🇰',
    'sri lanka': '🇱🇰', 'শ্রীলঙ্কা': '🇱🇰', 'sl': '🇱🇰', 'srilanka': '🇱🇰',
    'afghanistan': '🇦🇫', 'আফগানিস্তান': '🇦🇫', 'afg': '🇦🇫',
    'nepal': '🇳🇵', 'নেপাল': '🇳🇵', 'nep': '🇳🇵',
    'maldives': '🇲🇻', 'মালদ্বীপ': '🇲🇻', 'mdv': '🇲🇻',
    'bhutan': '🇧🇹', 'ভুটান': '🇧🇹', 'bhu': '🇧🇹',
    'uae': '🇦🇪', 'ইউএই': '🇦🇪', 'united arab emirates': '🇦🇪',
    'oman': '🇴🇲', 'ওমান': '🇴🇲',
    'saudi arabia': '🇸🇦', 'সৌদি আরব': '🇸🇦', 'saudi': '🇸🇦', 'ksa': '🇸🇦',
    'qatar': '🇶🇦', 'কাতার': '🇶🇦',
    'japan': '🇯🇵', 'জাপান': '🇯🇵', 'jpn': '🇯🇵',
    'south korea': '🇰🇷', 'দক্ষিণ কোরিয়া': '🇰🇷', 'korea': '🇰🇷', 'kor': '🇰🇷',
    'china': '🇨🇳', 'চীন': '🇨🇳', 'chn': '🇨🇳',
    'australia': '🇦🇺', 'অস্ট্রেলিয়া': '🇦🇺', 'aus': '🇦🇺',
    'new zealand': '🇳🇿', 'নিউজিল্যান্ড': '🇳🇿', 'nz': '🇳🇿',
    'england': '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'ইংল্যান্ড': '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'eng': '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'uk': '🇬🇧',
    'south africa': '🇿🇦', 'দক্ষিণ আফ্রিকা': '🇿🇦', 'rsa': '🇿🇦', 'sa': '🇿🇦',
    'west indies': '🌴', 'ওয়েস্ট ইন্ডিজ': '🌴', 'wi': '🌴',
    'usa': '🇺🇸', 'ইউএসএ': '🇺🇸', 'america': '🇺🇸', 'united states': '🇺🇸',
    'argentina': '🇦🇷', 'আর্জেন্টিনা': '🇦🇷', 'arg': '🇦🇷',
    'brazil': '🇧🇷', 'ব্রাজিল': '🇧🇷', 'bra': '🇧🇷',
    'germany': '🇩🇪', 'জার্মানি': '🇩🇪', 'ger': '🇩🇪',
    'france': '🇫🇷', 'ফ্রান্স': '🇫🇷', 'fra': '🇫🇷',
    'spain': '🇪🇸', 'স্পেন': '🇪🇸', 'esp': '🇪🇸',
    'portugal': '🇵🇹', 'পর্তুগাল': '🇵🇹', 'por': '🇵🇹',
    'italy': '🇮🇹', 'ইতালি': '🇮🇹', 'ita': '🇮🇹',
  };

  if (mapping[clean]) return mapping[clean];
  for (const [key, flag] of Object.entries(mapping)) {
    if (clean.includes(key) || key.includes(clean)) {
      return flag;
    }
  }
  return "🏳️";
};

const HlsPlayer = ({ url }: { url: string }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [levels, setLevels] = useState<any[]>([]);
  const [currentLevel, setCurrentLevel] = useState<number>(-1);
  const [isAuto, setIsAuto] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [hlsInstance, setHlsInstance] = useState<Hls | null>(null);
  
  // Custom manual streaming engine profiles (8K, 4K, 1080p, etc.)
  const [selectedProfile, setSelectedProfile] = useState<string>("Auto");
  const [isApplyingProfile, setIsApplyingProfile] = useState(false);

  useEffect(() => {
    let hls: Hls | null = null;
    const video = videoRef.current;
    
    if (!video) return;
    
    setError(null);
    setLevels([]);
    setCurrentLevel(-1);
    setIsAuto(true);
    setShowSettings(false);

    if (url.startsWith('http://') && window.location.protocol === 'https:') {
      setError("Mixed content error: Cannot play HTTP stream on HTTPS site. Please use an HTTPS stream or a VPN.");
    }

    const lowerUrl = url.toLowerCase();
    const isHls = lowerUrl.includes('.m3u8') || lowerUrl.includes('m3u8') || lowerUrl.includes('/api/stream-proxy');

    if (isHls && Hls.isSupported()) {
      // High performance fine-tuning for buffer-free playback
      hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 90,
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        maxBufferSize: 60 * 1024 * 1024, // 60MB max
        liveSyncDuration: 1.5,
        liveMaxLatencyDuration: 3,
        maxStarvationDelay: 1,
        maxLoadingDelay: 1,
        abrBandWidthFactor: 0.95,
        abrBandWidthUpFactor: 0.8,
        manifestLoadingTimeOut: 15000,
        manifestLoadingMaxRetry: 10,
        manifestLoadingRetryDelay: 500,
        levelLoadingTimeOut: 15000,
        levelLoadingMaxRetry: 10,
        levelLoadingRetryDelay: 500,
        fragLoadingTimeOut: 30000,
        fragLoadingMaxRetry: 10,
        fragLoadingRetryDelay: 500,
      });

      setHlsInstance(hls);

      hls.loadSource(url);
      hls.attachMedia(video);
      
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setLevels(hls?.levels || []);
        video.play().catch(e => console.log('Auto-play prevented:', e));
      });

      hls.on(Hls.Events.LEVEL_SWITCHED, (event, data) => {
        setCurrentLevel(data.level);
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              setError('Network error. Check your connection or the stream URL.');
              hls?.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              setError('Media error. Trying to recover...');
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
      if (hls) {
        hls.destroy();
      }
      setHlsInstance(null);
    };
  }, [url]);

  const selectLevel = (levelIndex: number) => {
    if (!hlsInstance) return;
    if (levelIndex === -1) {
      hlsInstance.currentLevel = -1;
      setIsAuto(true);
      setSelectedProfile("Auto");
    } else {
      hlsInstance.currentLevel = levelIndex;
      setIsAuto(false);
      setCurrentLevel(levelIndex);
      setSelectedProfile(hlsInstance.levels[levelIndex].height ? `${hlsInstance.levels[levelIndex].height}p` : `Level ${levelIndex}`);
    }
    setShowSettings(false);
  };

  const applyTuningProfile = (profile: string) => {
    if (!hlsInstance) return;
    setIsApplyingProfile(true);
    setSelectedProfile(profile);
    setShowSettings(false);

    const config = hlsInstance.config;
    if (profile === "8K Ultra HD" || profile === "4K Ultra HD") {
      config.maxBufferLength = 90;
      config.maxMaxBufferLength = 180;
      config.maxBufferSize = 250 * 1024 * 1024;
      config.lowLatencyMode = false;
    } else if (profile === "1080p Full HD") {
      config.maxBufferLength = 40;
      config.maxMaxBufferLength = 90;
      config.maxBufferSize = 100 * 1024 * 1024;
      config.lowLatencyMode = true;
    } else {
      config.maxBufferLength = 15;
      config.maxMaxBufferLength = 30;
      config.maxBufferSize = 30 * 1024 * 1024;
      config.lowLatencyMode = true;
    }

    const currentLevelVal = hlsInstance.currentLevel;
    hlsInstance.currentLevel = currentLevelVal;

    setTimeout(() => {
      setIsApplyingProfile(false);
    }, 400);
  };

  const getLevelLabel = (level: any) => {
    const height = level.height ? `${level.height}p` : 'Unknown';
    const bitrate = level.bitrate ? `${(level.bitrate / 1000000).toFixed(1)} Mbps` : '';
    return bitrate ? `${height} (${bitrate})` : height;
  };

  return (
    <div className="relative w-full h-full bg-black group/player">
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        controls
        autoPlay
        playsInline
      />

      {isApplyingProfile && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-30 backdrop-blur-sm">
          <div className="text-center">
            <RotateCw className="w-8 h-8 text-cyan-400 animate-spin mx-auto mb-2" />
            <p className="text-xs text-white font-bold tracking-wider">Applying {selectedProfile} Optimization...</p>
          </div>
        </div>
      )}

      <div className="absolute top-4 right-4 z-20">
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="p-2 bg-black/60 hover:bg-black/90 backdrop-blur-md rounded-full border border-gray-800/40 text-gray-300 hover:text-white transition-all shadow-lg cursor-pointer"
          title="ভিডিও রেজোলিউশন"
        >
          <Settings size={18} className={`${showSettings ? 'rotate-45' : ''} transition-transform duration-300`} />
        </button>

        {showSettings && (
          <div className="absolute right-0 mt-2 bg-[#0d0e12]/95 backdrop-blur-md border border-gray-800/80 rounded-xl py-1.5 w-52 shadow-2xl z-30 transition-all text-left max-h-80 overflow-y-auto">
            <div className="px-3 py-1 border-b border-gray-800/40 text-[10px] text-gray-500 font-bold tracking-wider uppercase">
              ভিডিও রেজোলিউশন ও বাফার
            </div>
            {levels.length > 0 ? (
              <>
                <button
                  onClick={() => selectLevel(-1)}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-cyan-500/10 hover:text-cyan-400 flex items-center justify-between transition-colors cursor-pointer"
                >
                  <span className="font-semibold text-white">Auto (স্বয়ংক্রিয়)</span>
                  {isAuto && <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />}
                </button>
                {levels.map((level, idx) => (
                  <button
                    key={idx}
                    onClick={() => selectLevel(idx)}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-cyan-500/10 hover:text-cyan-400 flex items-center justify-between transition-colors font-mono text-gray-300 cursor-pointer"
                  >
                    <span>{getLevelLabel(level)}</span>
                    {!isAuto && currentLevel === idx && (
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                    )}
                  </button>
                ))}
              </>
            ) : (
              <>
                {[
                  { name: "8K Ultra HD", label: "8K Ultra HD (ম্যাক্স বাফার)" },
                  { name: "4K Ultra HD", label: "4K Ultra HD (সুপার কোয়ালিটি)" },
                  { name: "1080p Full HD", label: "1080p FHD (ফুল এইচডি)" },
                  { name: "720p HD", label: "720p HD (স্ট্যান্ডার্ড)" },
                  { name: "480p SD", label: "480p SD (সুপার ফাস্ট)" }
                ].map((item) => (
                  <button
                    key={item.name}
                    onClick={() => applyTuningProfile(item.name)}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-cyan-500/10 hover:text-cyan-400 flex items-center justify-between transition-colors text-gray-300 cursor-pointer"
                  >
                    <span>{item.label}</span>
                    {selectedProfile === item.name && (
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                    )}
                  </button>
                ))}
              </>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center p-6 text-center z-20">
          <AlertCircle size={32} className="text-red-500 mb-2" />
          <p className="text-xs text-white max-w-sm mb-4 leading-normal">{error}</p>
        </div>
      )}
    </div>
  );
};

export default function TvApp() {
  const { state, loading } = useAppState(15000);
  const { noticeText, categories, channels, comingSoonUrl, comingSoonType, maintenanceMode } = state;
  
  const [activeServerId, setActiveServerId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState('all');
  const [activeChannelId, setActiveChannelId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');

  // Live streaming states
  const [localLiveChannels, setLocalLiveChannels] = useState<any[]>([]);
  const [isAddaOpen, setIsAddaOpen] = useState(false);
  const [isAddaJoined, setIsAddaJoined] = useState(false);
  const [activeWatcherCount, setActiveWatcherCount] = useState<number>(1);

  // Real-time active watcher tracker socket connection
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socketUrl = `${protocol}//${window.location.host}/api/watcher`;
    let ws: WebSocket | null = null;
    let reconnectTimeout: any = null;

    function connect() {
      ws = new WebSocket(socketUrl);
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'count') {
            setActiveWatcherCount(data.count);
          } else if (data.type === 'banned') {
            alert(data.reason || "আপনার আইপি ব্যান করা হয়েছে। আপনি এই ওয়েবসাইটে আর প্রবেশ করতে পারবেন না।");
            window.location.href = "about:blank";
          }
        } catch (e) {
          console.error("Error parsing watcher msg:", e);
        }
      };
      ws.onclose = () => {
        reconnectTimeout = setTimeout(connect, 3000);
      };
      ws.onerror = () => {
        if (ws) ws.close();
      };
    }

    connect();

    return () => {
      if (ws) {
        ws.onclose = null;
        ws.close();
      }
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, []);

  // Poll Node Media Server streams to dynamically register active web streams
  useEffect(() => {
    const fetchLiveStreams = async () => {
      try {
        const response = await fetch('/api/nms/api/streams');
        if (response.ok) {
          const data = await response.json();
          const streamsList: any[] = [];
          if (data && data.live) {
            Object.keys(data.live).forEach((key) => {
              if (data.live[key].publisher) {
                streamsList.push({
                  id: `live_${key}`,
                  name: `🔴 LIVE: ${key.replace(/_/g, ' ')}`,
                  logo: 'live-badge',
                  categoryId: 'live-streams',
                  active: true,
                  servers: [
                    {
                      id: `server_live_${key}`,
                      channelId: `live_${key}`,
                      name: 'Direct Fiber Server',
                      url: `/live/${key}/index.m3u8`
                    }
                  ]
                });
              }
            });
          }
          setLocalLiveChannels(streamsList);
        }
      } catch (e) {
        // Safe silence if server is bootup/recycling
      }
    };

    fetchLiveStreams();
    const interval = setInterval(fetchLiveStreams, 8000);
    return () => clearInterval(interval);
  }, []);

  // Inject the live-streams category dynamically if not present
  const activeCategories = [...categories];
  if (!activeCategories.some(c => c.id === 'live-streams')) {
    activeCategories.splice(2, 0, {
      id: 'live-streams',
      label: 'Live Broadcasts',
      iconName: 'Radio'
    });
  }

  // Combine DB channels and active dynamic live-stream channels
  const combinedChannels = React.useMemo(() => [...channels, ...localLiveChannels], [channels, localLiveChannels]);
  
  useEffect(() => {
    if (!loading && combinedChannels.length > 0 && !activeChannelId) {
      setActiveChannelId(combinedChannels[0].id);
      if (combinedChannels[0].servers?.length > 0) {
        setActiveServerId(combinedChannels[0].servers[0].id);
      }
    }
  }, [loading, combinedChannels, activeChannelId]);

  const activeChannel = combinedChannels.find(c => c.id === activeChannelId) || combinedChannels[0];
  const activeServer = activeChannel?.servers?.find(s => s.id === activeServerId) || activeChannel?.servers?.[0];

  const handleChannelClick = (id: string) => {
    setActiveChannelId(id);
    const channel = combinedChannels.find(c => c.id === id);
    if (channel && channel.servers?.length > 0) {
      setActiveServerId(channel.servers[0].id);
    }
  };

  // 1. Maintenance Mode Notice Overlay Check
  if (!loading && maintenanceMode) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-center p-6 text-white font-sans">
        <div className="relative mb-6">
          <div className="absolute -inset-4 bg-red-500/20 blur-xl rounded-full animate-pulse" />
          <Settings size={64} className="text-red-500 animate-spin" style={{ animationDuration: '6s' }} />
        </div>
        <h1 className="text-2xl sm:text-3xl font-black mb-3 text-red-500 Bengali">সাময়িক রক্ষণাবেক্ষণ চলছে</h1>
        <p className="text-sm text-gray-400 max-w-md mb-6 leading-relaxed Bengali">
          আমাদের সিস্টেমে রক্ষণাবেক্ষণের কাজ চলছে। খুব শীঘ্রই আমরা আবার ফিরে আসবো। সাময়িক এই অসুবিধার জন্য আমরা আন্তরিকভাবে দুঃখিত।
        </p>
        {noticeText && (
          <div className="bg-[#0e0f19] border border-red-500/10 p-4 rounded-xl max-w-lg w-full text-left">
            <div className="text-red-400 text-xs font-bold uppercase tracking-wider mb-1">সর্বশেষ আপডেট নোটিশ:</div>
            <p className="text-xs text-gray-300 leading-normal">{noticeText}</p>
          </div>
        )}
      </div>
    );
  }

  if (loading) {
    return <div className="min-h-screen bg-black flex items-center justify-center text-white">Loading...</div>;
  }

  const filteredChannels = combinedChannels.filter(c => {
    const matchesCategory = activeCategory === 'all' || c.categoryId === activeCategory || (activeCategory === 'favorites' && c.active);
    const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-[#03050c] text-gray-100 font-sans selection:bg-cyan-500/30 flex flex-col lg:flex-row pb-20">
      {/* 1. GORGEOUS DESKTOP SIDEBAR ("সাইডবার / সাইট ১২") */}
      <aside className="hidden lg:flex w-72 bg-[#060813]/95 border-r border-[#151a30]/50 p-6 flex-col justify-between shrink-0 sticky top-0 h-screen z-40 backdrop-blur-xl">
        <div className="space-y-6">
          {/* Brand Logo & Title with Pulse glow */}
          <div className="flex items-center gap-3 py-1">
            <div className="relative">
              <div className="absolute -inset-1 rounded-full bg-cyan-500/30 blur-sm animate-pulse" />
              <img src={logoImg} alt="Logo" className="relative w-10 h-10 rounded-full border border-cyan-500/40" />
            </div>
            <div>
              <h1 className="text-lg font-extrabold tracking-tight bg-gradient-to-r from-cyan-400 via-teal-400 to-blue-500 text-transparent bg-clip-text font-sans">
                Nexarion TV
              </h1>
              <span className="text-[10px] uppercase tracking-widest text-cyan-400 font-bold block">Premium Network</span>
            </div>
          </div>

          <div className="border-t border-[#1a2244]/40 my-2" />

          {/* Search Box inside Sidebar */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-gray-500 w-4 h-4" />
            <input 
              type="text" 
              placeholder="চ্যানেল খুঁজুন..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#0d1127] border border-[#21294d] rounded-xl py-2 pl-9 pr-4 text-xs text-white placeholder-gray-500 outline-none focus:border-cyan-500 transition-all"
            />
          </div>

          {/* Categories List */}
          <div>
            <div className="text-[10px] text-cyan-500/80 font-bold tracking-widest uppercase mb-3 px-1">ক্যাটাগরি সমূহ</div>
            <div className="space-y-1.5 max-h-[50vh] overflow-y-auto pr-1">
              {activeCategories.map((cat) => {
                const Icon = cat.iconName ? ICON_MAP[cat.iconName] : Sparkles;
                const isActive = activeCategory === cat.id;
                return (
                  <button 
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 group cursor-pointer ${
                      isActive 
                        ? 'bg-gradient-to-r from-cyan-950/40 to-blue-950/20 text-cyan-400 border border-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.1)]' 
                        : 'text-gray-400 hover:text-white hover:bg-[#0c0f24] border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      {Icon && <Icon size={14} className={isActive ? 'text-cyan-400' : 'text-gray-500 group-hover:text-cyan-400 transition-colors'} />}
                      <span>{cat.label}</span>
                    </div>
                    {isActive && <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Sidebar Actions */}
        <div className="space-y-3 pt-4 border-t border-[#1a2244]/40">
          <div className="text-[10px] text-gray-500 text-center font-medium font-sans">
            Nexarion TV v2.5 • Live Stream
          </div>
        </div>
      </aside>

      {/* 2. MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Sticky Header for mobile & controls */}
        <header className="flex items-center justify-between px-4 py-3 bg-[#050711] border-b border-[#141b38]/60 backdrop-blur-md sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <button 
              className="text-gray-400 hover:text-cyan-400 transition-colors p-1.5 bg-[#0e122b] border border-[#21294d]/40 rounded-xl cursor-pointer animate-spin-hover" 
              onClick={() => window.location.reload()}
              title="রিফ্রেশ করুন"
            >
              <RotateCw size={15} />
            </button>
            <span className="text-[10px] bg-[#0f1d3a] border border-cyan-500/20 text-cyan-400 px-2.5 py-1 rounded-full font-bold lg:hidden">
              Nexarion TV
            </span>
          </div>

          {/* Logo on mobile only */}
          <div className="flex items-center gap-2 lg:hidden">
            <img src={logoImg} alt="Logo" className="w-7 h-7 rounded-full border border-cyan-500/30" />
            <h1 className="text-base font-extrabold tracking-tight bg-gradient-to-r from-cyan-400 via-teal-400 to-blue-500 text-transparent bg-clip-text font-sans">
              Nexarion TV
            </h1>
          </div>

          {/* Real-time Watcher Count displaying next to Web Logo */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-cyan-950/40 border border-cyan-500/20 rounded-full shadow-[0_0_12px_rgba(6,182,212,0.15)]">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
            </span>
            <span className="text-[10px] font-bold text-cyan-400 font-mono tracking-wide">{activeWatcherCount} Watching</span>
          </div>
        </header>

        {/* Notice Marquee */}
        <div className="flex items-center bg-[#c11c22]/10 border-b border-[#c11c22]/20 h-7 overflow-hidden">
          <div className="bg-gradient-to-r from-red-600 to-red-700 text-white font-extrabold px-3 h-full flex items-center text-[10px] tracking-wider z-10 uppercase shadow-md font-sans shrink-0">
            NOTICE
          </div>
          <div className="overflow-hidden whitespace-nowrap text-[#ffcc00] flex-1 text-xs font-semibold flex items-center">
            {React.createElement('marquee', {
              className: "w-full text-yellow-400 text-xs font-semibold",
              scrollamount: "3"
            }, noticeText)}
          </div>
        </div>

        {/* Player Stage */}
        <div className="p-3 sm:p-5 bg-gradient-to-b from-[#060815] to-[#030408]">
          <div className="max-w-4xl mx-auto">
            
            {/* Match Details Banner above the Player with Flag Resolver */}
            {activeChannel?.team1 && activeChannel?.team2 && (
              <div className="mb-3.5 bg-gradient-to-r from-[#0a1128] via-[#040816] to-[#0a1128] border border-cyan-500/20 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg">
                <div className="flex items-center gap-2.5">
                  <span className="text-xs font-extrabold text-cyan-400 bg-cyan-950/40 border border-cyan-500/30 px-3 py-1 rounded-full uppercase tracking-wider">
                    {activeChannel.status === 'live' ? '🔴 LIVE MATCH' : '⏳ COMING SOON'}
                  </span>
                  <span className="text-xs text-gray-400 font-semibold font-sans">{activeChannel.name}</span>
                </div>

                <div className="flex items-center gap-4 sm:gap-6">
                  <div className="flex items-center gap-2">
                    <span className="text-xl sm:text-2xl">{getCountryFlag(activeChannel.team1)}</span>
                    <span className="text-sm font-extrabold text-white">{activeChannel.team1}</span>
                  </div>
                  <span className="text-xs font-black text-cyan-500 italic bg-cyan-950/30 px-2 py-0.5 rounded border border-cyan-800/20">VS</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-extrabold text-white">{activeChannel.team2}</span>
                    <span className="text-xl sm:text-2xl">{getCountryFlag(activeChannel.team2)}</span>
                  </div>
                </div>

                {activeChannel.matchTime && (
                  <div className="text-xs font-semibold text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 px-3 py-1 rounded-xl">
                    {activeChannel.matchTime}
                  </div>
                )}
              </div>
            )}

            <div className="relative rounded-2xl overflow-hidden border border-[#1e295d]/50 bg-black shadow-[0_0_50px_rgba(6,182,212,0.15)]">
              <div className="aspect-video w-full relative flex justify-center items-center bg-black">
                {activeServer?.url ? (
                  <HlsPlayer url={(activeServer.url.startsWith('http://') && window.location.protocol === 'https:') ? `/api/stream-proxy?url=${encodeURIComponent(activeServer.url)}` : activeServer.url} />
                ) : comingSoonUrl ? (
                  <div className="absolute inset-0 bg-black flex flex-col items-center justify-center overflow-hidden">
                    {comingSoonType === 'video' ? (
                      <video 
                        src={comingSoonUrl} 
                        controls 
                        autoPlay 
                        loop 
                        muted 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <img 
                        src={comingSoonUrl} 
                        alt="Coming Soon" 
                        className="w-full h-full object-contain"
                      />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/30 to-transparent flex flex-col justify-end p-5 text-left">
                      <span className="text-yellow-400 text-xs font-black tracking-[0.2em] uppercase mb-1">Nexarion TV Special</span>
                      <h3 className="text-sm sm:text-base md:text-lg font-extrabold text-white tracking-tight leading-snug Bengali">পরবর্তী ম্যাচ অথবা অনুষ্ঠান খুব শীঘ্রই শুরু হচ্ছে...</h3>
                    </div>
                  </div>
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-[#0c0e1a] to-[#04060f] flex flex-col items-center justify-center p-4">
                    <p className="text-gray-500 mb-1 text-xs uppercase tracking-widest font-sans">Streaming Channel</p>
                    <h2 className="text-xl sm:text-2xl font-black text-white mb-3 text-center">{activeChannel?.name || 'No Channel Selected'}</h2>
                    <span className="text-[10px] text-cyan-400 bg-cyan-950/50 px-3 py-1 rounded-full border border-cyan-800/40 font-semibold uppercase tracking-wider">
                      Server: {activeServer?.name || 'N/A'}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Server selections below the player */}
            <div className="mt-3.5 flex flex-col items-center justify-center">
              <div className="flex flex-wrap items-center justify-center gap-1.5 p-1 bg-[#0b0f22]/80 border border-[#1c244c]/60 rounded-xl max-w-full shadow-inner">
                <span className="text-[9px] text-gray-500 font-bold px-2.5 uppercase tracking-wider font-sans">SERVERS:</span>
                {activeChannel?.servers?.map((server) => (
                  <button 
                    key={server.id}
                    onClick={() => setActiveServerId(server.id)}
                    className={`whitespace-nowrap px-3.5 py-1.5 rounded-lg text-[10px] font-bold tracking-wide transition-all cursor-pointer ${
                      activeServerId === server.id 
                        ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-black shadow-[0_0_12px_rgba(6,182,212,0.4)] font-black' 
                        : 'text-gray-400 hover:text-white hover:bg-[#12193b]'
                    }`}
                  >
                    {server.name}
                  </button>
                ))}
                {!activeChannel?.servers?.length && (
                  <span className="text-gray-600 text-xs px-2 py-1">No active servers</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Mobile categories & Search */}
        <div id="search-trigger" className="px-3 sm:px-4 py-2 space-y-3 lg:hidden bg-gradient-to-b from-[#030408] to-[#050711]">
          {/* Mobile search bar */}
          <div className="relative max-w-md mx-auto">
            <Search className="absolute left-3.5 top-2.5 text-gray-500 w-4 h-4" />
            <input 
              type="text" 
              placeholder="চ্যানেল খুঁজুন..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#0d1022] border border-[#1b234b] text-white rounded-full py-2.5 pl-10 pr-4 outline-none text-xs focus:border-cyan-500/50 transition-all shadow-inner"
            />
          </div>

          {/* Categories Horizontal scrolling for Mobile */}
          <div className="flex overflow-x-auto gap-1.5 pb-2 scrollbar-hide justify-start">
            {activeCategories.map((cat) => {
              const Icon = cat.iconName ? ICON_MAP[cat.iconName] : Sparkles;
              const isActive = activeCategory === cat.id;
              return (
                <button 
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`flex items-center gap-1.5 whitespace-nowrap px-4 py-2 rounded-full text-[11px] font-bold border transition-all cursor-pointer shrink-0 ${
                    isActive 
                      ? 'bg-gradient-to-r from-cyan-500 to-teal-400 text-black border-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.25)]' 
                      : 'bg-[#0d1022] text-gray-300 border-[#1b234b] hover:bg-[#151a3a]'
                  }`}
                >
                  {Icon && (
                    <Icon 
                      size={11} 
                      className={isActive ? 'text-black' : (cat.id === 'favorites' ? 'text-red-500' : 'text-yellow-500')} 
                    />
                  )}
                  <span>{cat.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Channel Grid Section */}
        <div className="flex-1 px-3 sm:px-6 py-4 bg-gradient-to-b from-[#050711] to-[#03050c]">
          <div className="max-w-6xl mx-auto">
            {/* Grid Header */}
            <div className="flex items-center justify-between mb-4 px-1">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-3.5 bg-cyan-500 rounded-full animate-pulse" />
                <h3 className="text-xs sm:text-sm font-extrabold uppercase tracking-widest text-cyan-400 Bengali">সম্প্রচারিত চ্যানেল সমূহ</h3>
              </div>
              <span className="text-[10px] text-gray-500 font-bold tracking-wider font-sans uppercase">
                {filteredChannels.length} Channels Found
              </span>
            </div>

            {filteredChannels.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center p-8 sm:p-12 max-w-md mx-auto my-6 border border-[#1b234b]/40 rounded-2xl bg-[#090d24]/30 backdrop-blur-sm">
                <div className="bg-red-500/10 p-4 rounded-full border border-red-500/20 mb-4 text-red-500 animate-pulse">
                  <Radio size={28} />
                </div>
                <h3 className="text-sm font-bold text-white mb-1.5">কোনো চ্যানেল পাওয়া যায়নি</h3>
                <p className="text-[11px] text-gray-400 leading-relaxed Bengali font-sans">
                  বর্তমানে কোনো লাইভ চ্যানেল সম্প্রচারিত হচ্ছে না। দয়া করে অন্য কোনো ক্যাটাগরি বেছে নিন অথবা একটু পর আবার চেষ্টা করুন।
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
                {filteredChannels.map((channel) => {
                  const isCurrentlyActive = activeChannelId === channel.id;
                  return (
                    <button 
                      key={channel.id}
                      onClick={() => handleChannelClick(channel.id)}
                      className={`relative flex flex-col rounded-xl border-[2px] overflow-hidden cursor-pointer transition-all hover:-translate-y-1 hover:scale-[1.02] active:scale-95 group ${
                        isCurrentlyActive
                          ? 'border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)] bg-[#0b1717]/80' 
                          : 'border-[#1b234b] bg-[#090b16] hover:border-[#354388]/60 shadow-lg'
                      }`}
                    >
                      <div className="bg-[#12162a]/30 aspect-[4/2.5] w-full flex flex-col items-center justify-center p-2.5 relative overflow-hidden border-b border-[#1b234b]/30">
                        {channel.logo && channel.logo !== 'rakib' && channel.logo !== 'blue' && channel.logo !== 'live-badge' && (
                           <img src={channel.logo} alt={channel.name} className="w-full h-full object-contain p-1 rounded-lg transition-transform group-hover:scale-105 duration-300" referrerPolicy="no-referrer" />
                        )}
                        {channel.logo === 'live-badge' && (
                          <div className="w-full h-full flex flex-col items-center justify-center rounded">
                            <div className="bg-red-600/10 p-2 rounded-full border border-red-600/30 mb-0.5 animate-pulse">
                              <Radio size={20} className="text-red-500" />
                            </div>
                            <span className="text-[7px] sm:text-[8px] font-black text-red-500 tracking-wider">LIVE FEED</span>
                          </div>
                        )}
                        {channel.logo === 'rakib' && (
                          <div className="flex flex-col items-center justify-center w-full h-full scale-[1.1]">
                            <div className="bg-cyan-950/40 text-cyan-400 italic font-black text-2xl px-2.5 py-0.5 rounded-tl-xl rounded-br-xl border border-cyan-500/20 leading-none flex items-center justify-center mt-1">
                              N
                            </div>
                            <div className="text-white font-extrabold text-[10px] leading-tight mt-1 tracking-tight">Nexarion</div>
                            <div className="text-cyan-400 text-[5px] tracking-[0.2em] font-bold">PREMIUM</div>
                          </div>
                        )}
                        {channel.logo === 'blue' && (
                          <div className="bg-gradient-to-br from-[#0c1c3f] to-[#044a86] w-[90%] h-[85%] rounded-2xl flex flex-col items-center justify-center text-white border border-[#1b3ca4]/40 shadow-inner">
                            <div className="mb-1">
                              <svg width="20" height="16" viewBox="0 0 24 20" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-cyan-400">
                                <path d="M4 14C4 9.58172 7.58172 6 12 6C16.4183 6 20 9.58172 20 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                                <path d="M8 14C8 11.7909 9.79086 10 12 10C14.2091 10 16 11.7909 16 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                                <circle cx="12" cy="15" r="2" fill="currentColor"/>
                              </svg>
                            </div>
                            <span className="text-[5px] font-bold tracking-widest text-cyan-300">TV NETWORK</span>
                          </div>
                        )}
                        
                        {/* Heart Icon on Card */}
                        {channel.logo !== 'live-badge' && (
                          <Heart 
                            className={`absolute top-1.5 right-1.5 w-4 h-4 p-0.5 z-10 transition-all duration-300 ${
                              isCurrentlyActive || channel.active 
                                ? 'text-red-500 fill-red-500 scale-110 drop-shadow' 
                                : 'text-gray-500 fill-transparent group-hover:text-red-400'
                            }`} 
                          />
                        )}
                      </div>
                      <div className="bg-[#050610] text-gray-300 text-[10px] sm:text-[11px] text-center py-2.5 truncate px-2.5 w-full font-bold transition-colors group-hover:text-white">
                        {channel.name}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3. STUNNING FLOATING BOTTOM NAVIGATION BAR ("নেভিগেশন বাটন / সাইট ১২") */}
      <nav className="fixed bottom-4 left-1/2 -translate-x-1/2 z-45 bg-[#090b16]/90 backdrop-blur-xl border border-white/[0.08] rounded-full px-5 py-2 flex items-center justify-center gap-4 sm:gap-6 shadow-[0_15px_40px_rgba(0,0,0,0.85)] max-w-full w-auto">
        <button 
          onClick={() => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className="flex flex-col items-center gap-0.5 px-3 py-1 text-gray-400 hover:text-cyan-400 transition-colors cursor-pointer"
        >
          <Tv size={16} />
          <span className="text-[8px] font-black tracking-wider uppercase font-sans">Home</span>
        </button>

        <div className="h-4 w-[1px] bg-white/[0.08]" />

        <button 
          onClick={() => setIsAddaOpen(true)}
          className="flex flex-col items-center gap-0.5 px-3 py-1 relative text-cyan-400 hover:text-cyan-300 transition-colors cursor-pointer"
        >
          <span className="absolute -top-1 right-2 flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
          </span>
          <Mic size={16} className="animate-bounce" />
          <span className="text-[8px] font-black tracking-wider uppercase font-sans">Live Adda</span>
        </button>

        <div className="h-4 w-[1px] bg-white/[0.08]" />

        <button 
          onClick={() => {
            const el = document.getElementById('search-trigger');
            if (el) {
              el.scrollIntoView({ behavior: 'smooth' });
            }
          }}
          className="flex flex-col items-center gap-0.5 px-3 py-1 text-gray-400 hover:text-cyan-400 transition-colors cursor-pointer"
        >
          <Search size={16} />
          <span className="text-[8px] font-black tracking-wider uppercase font-sans">Search</span>
        </button>
      </nav>

      {/* Real-time Live Adda Room (Voice/Video Call + Chat) Bottom Sheet */}
      <div className={`fixed bottom-0 left-0 right-0 z-50 bg-[#0c0c0e] border-t border-cyan-500/30 shadow-[0_-10px_35px_rgba(0,0,0,0.95)] h-[450px] sm:h-[480px] max-h-[85vh] flex flex-col max-w-screen-md mx-auto rounded-t-2xl overflow-hidden transition-all duration-300 ${
        isAddaOpen ? 'translate-y-0 opacity-100 pointer-events-auto' : 'translate-y-full opacity-0 pointer-events-none'
      }`}>
        <AddaRoom 
          roomId={activeChannel?.id || 'lobby'} 
          roomName={activeChannel?.name || 'Nexarion TV'} 
          onClose={() => setIsAddaOpen(false)}
          onJoinedStatusChange={(joined) => setIsAddaJoined(joined)}
        />
      </div>

      {/* Floating Status Pill if joined but drawer minimized */}
      {isAddaJoined && !isAddaOpen && (
        <div className="fixed bottom-20 right-4 z-40 animate-bounce">
          <button
            onClick={() => setIsAddaOpen(true)}
            className="flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-white text-xs font-bold py-2.5 px-4 rounded-full shadow-[0_4px_15px_rgba(16,185,129,0.5)] border border-emerald-400/30 cursor-pointer"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
            </span>
            <span>লাইভ আড্ডায় আছেন 🎙️</span>
          </button>
        </div>
      )}
    </div>
  );
}

