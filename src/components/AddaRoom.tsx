import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, Mic, MicOff, Send, Users, PhoneOff, User, Volume2, VolumeX, X } from 'lucide-react';
import toast from 'react-hot-toast';

interface AddaRoomProps {
  roomId: string;
  roomName: string;
  onClose?: () => void;
  onJoinedStatusChange?: (isJoined: boolean) => void;
}

interface ChatMessage {
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
}

interface PeerInfo {
  id: string;
  name: string;
  avatar?: string;
  stream?: MediaStream;
}

const PRESET_AVATARS = [
  { id: 'av1', label: 'Cyan Glow', url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&h=150&q=80' },
  { id: 'av2', label: 'Emerald Tech', url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&h=150&q=80' },
  { id: 'av3', label: 'Amethyst Star', url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&h=150&q=80' },
  { id: 'av4', label: 'Ruby Neon', url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&h=150&q=80' },
  { id: 'av5', label: 'Gold Aura', url: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=150&h=150&q=80' },
  { id: 'av6', label: 'Sapphire Wave', url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=150&h=150&q=80' },
];

export default function AddaRoom({ roomId, roomName, onClose, onJoinedStatusChange }: AddaRoomProps) {
  const [userName, setUserName] = useState('');
  const [isJoined, setIsJoined] = useState(false);
  const [deviceId, setDeviceId] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState(PRESET_AVATARS[0].url);
  const [customAvatarUrl, setCustomAvatarUrl] = useState('');
  
  // Individual peer mute state (Record of peer ID -> isMuted)
  const [mutedPeers, setMutedPeers] = useState<Record<string, boolean>>({});

  const toggleMutePeer = (peerId: string) => {
    setMutedPeers(prev => {
      const updated = {
        ...prev,
        [peerId]: !prev[peerId]
      };
      if (updated[peerId]) {
        toast.success('এই ইউজারের সাউন্ড আপনার জন্য মিউট করা হয়েছে।');
      } else {
        toast.success('এই ইউজারের সাউন্ড আনমিউট করা হয়েছে।');
      }
      return updated;
    });
  };
  
  // Media states
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);

  // Group call & Chat states
  const [peers, setPeers] = useState<Record<string, PeerInfo>>({});
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [participantCount, setParticipantCount] = useState(0);

  // Refs
  const socketRef = useRef<WebSocket | null>(null);
  const pcsRef = useRef<Record<string, RTCPeerConnection>>({});
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  // Auto-fill random username if empty
  useEffect(() => {
    const savedName = localStorage.getItem('adda_user_name');
    if (savedName) {
      setUserName(savedName);
    } else {
      const randomId = Math.floor(1000 + Math.random() * 9000);
      setUserName(`দর্শক_${randomId}`);
    }

    const savedAvatar = localStorage.getItem('adda_user_avatar');
    if (savedAvatar) {
      setSelectedAvatar(savedAvatar);
      // Check if it's not preset, then set custom
      const isPreset = PRESET_AVATARS.some(p => p.url === savedAvatar);
      if (!isPreset) {
        setCustomAvatarUrl(savedAvatar);
      }
    }

    let devId = localStorage.getItem('adda_device_id');
    if (!devId) {
      devId = 'dev_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();
      localStorage.setItem('adda_device_id', devId);
    }
    setDeviceId(devId);
  }, []);

  // Inform parent of join status
  useEffect(() => {
    if (onJoinedStatusChange) {
      onJoinedStatusChange(isJoined);
    }
  }, [isJoined, onJoinedStatusChange]);

  // Handle roomId change - auto leave room if joined
  useEffect(() => {
    if (isJoined) {
      leaveRoom();
      toast.success('চ্যানেল পরিবর্তনের কারণে আড্ডা রুম পরিবর্তন করা হয়েছে');
    }
  }, [roomId]);

  // Scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const joinRoom = async () => {
    if (!userName.trim()) {
      toast.error('অনুগ্রহ করে আপনার নাম লিখুন');
      return;
    }
    const finalAvatar = customAvatarUrl.trim() || selectedAvatar;
    localStorage.setItem('adda_user_name', userName.trim());
    localStorage.setItem('adda_user_avatar', finalAvatar);

    // 1. Get user media (Audio only)
    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false
      });
      setLocalStream(stream);
      localStreamRef.current = stream;
      setIsMuted(false);
    } catch (err) {
      console.warn('Media devices not accessible, joining as chat-only', err);
      toast.error('অডিও ডিভাইস অ্যাক্সেস করা যায়নি। শুধুমাত্র চ্যাটে জয়েন করা হয়েছে।');
    }

    // 2. Establish WebSocket connection
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/meeting`;
      const socket = new WebSocket(wsUrl);
      socketRef.current = socket;

      socket.onopen = () => {
        socket.send(JSON.stringify({
          type: 'join',
          roomId,
          userName: userName.trim(),
          deviceId,
          avatar: finalAvatar
        }));
        setIsJoined(true);
        toast.success('সরাসরি লাইভ আড্ডায় যুক্ত হয়েছেন!');
      };

      socket.onmessage = async (event) => {
        const message = JSON.parse(event.data);

        switch (message.type) {
          case 'duplicate-join': {
            toast.error(message.message || 'আপনার এই ডিভাইস থেকে ইতিমধ্যে জয়েন করা আছে!');
            cleanupMeeting();
            setIsJoined(false);
            break;
          }
          case 'init': {
            const existingPeers = message.clients as { id: string, name: string, avatar?: string }[];
            setParticipantCount(existingPeers.length + 1);

            // Connect to each existing peer (we make the offer)
            for (const peer of existingPeers) {
              await createPeerConnection(peer.id, peer.name, true, peer.avatar);
            }
            break;
          }

          case 'user-joined': {
            toast.success(`${message.name} আড্ডায় যুক্ত হয়েছেন`);
            setPeers(prev => ({
              ...prev,
              [message.id]: { id: message.id, name: message.name, avatar: message.avatar }
            }));
            setParticipantCount(prev => prev + 1);
            break;
          }

          case 'user-left': {
            setPeers(prev => {
              const updated = { ...prev };
              delete updated[message.id];
              return updated;
            });
            setParticipantCount(prev => Math.max(1, prev - 1));

            if (pcsRef.current[message.id]) {
              pcsRef.current[message.id].close();
              delete pcsRef.current[message.id];
            }
            break;
          }

          case 'signal': {
            const { senderId, signal } = message;
            let pc = pcsRef.current[senderId];

            if (!pc) {
              const peerName = peers[senderId]?.name || 'সহ-দর্শক';
              const peerAvatar = peers[senderId]?.avatar;
              pc = await createPeerConnection(senderId, peerName, false, peerAvatar);
            }

            if (signal.sdp) {
              await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
              if (signal.sdp.type === 'offer') {
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                socket.send(JSON.stringify({
                  type: 'signal',
                  targetId: senderId,
                  signal: { sdp: pc.localDescription }
                }));
              }
            } else if (signal.candidate) {
              try {
                await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
              } catch (e) {
                console.error('Error adding ICE candidate', e);
              }
            }
            break;
          }

          case 'chat': {
            setMessages(prev => [...prev, message]);
            break;
          }
        }
      };

      socket.onclose = () => {
        cleanupMeeting();
      };

      socket.onerror = (e) => {
        console.error('Signalling socket error', e);
        toast.error('কানেকশন বিচ্ছিন্ন হয়েছে!');
        cleanupMeeting();
      };

    } catch (err) {
      console.error('Socket init failed', err);
      toast.error('আড্ডা সার্ভারের সাথে সংযুক্ত হওয়া যায়নি');
    }
  };

  const createPeerConnection = async (peerId: string, peerName: string, isInitiator: boolean, peerAvatar?: string): Promise<RTCPeerConnection> => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    });

    pcsRef.current[peerId] = pc;

    // Add local tracks to peer connection
    const currentStream = localStreamRef.current;
    if (currentStream) {
      currentStream.getTracks().forEach(track => {
        pc.addTrack(track, currentStream);
      });
    }

    // Handle remote track
    pc.ontrack = (event) => {
      const [remoteStream] = event.streams;
      setPeers(prev => ({
        ...prev,
        [peerId]: {
          ...prev[peerId],
          id: peerId,
          name: peerName,
          avatar: prev[peerId]?.avatar || peerAvatar,
          stream: remoteStream
        }
      }));
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({
          type: 'signal',
          targetId: peerId,
          signal: { candidate: event.candidate }
        }));
      }
    };

    if (isInitiator) {
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socketRef.current?.send(JSON.stringify({
          type: 'signal',
          targetId: peerId,
          signal: { sdp: pc.localDescription }
        }));
      } catch (err) {
        console.error('Failed to create RTC offer', err);
      }
    }

    setPeers(prev => ({
      ...prev,
      [peerId]: { 
        ...prev[peerId], 
        id: peerId, 
        name: peerName, 
        avatar: prev[peerId]?.avatar || peerAvatar 
      }
    }));

    return pc;
  };

  const sendChatMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: 'chat',
        text: inputText.trim()
      }));
      setInputText('');
    } else {
      toast.error('সার্ভারের সাথে কানেকশন নেই');
    }
  };

  const toggleMute = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
        toast.success(audioTrack.enabled ? 'মাইক্রোফোন চালু করা হয়েছে' : 'মাইক্রোফোন মিউট করা হয়েছে');
      }
    }
  };

  const leaveRoom = () => {
    cleanupMeeting();
    setIsJoined(false);
    toast.success('আড্ডা রুম থেকে বের হয়েছেন');
  };

  const cleanupMeeting = () => {
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    setLocalStream(null);

    Object.values(pcsRef.current).forEach(pc => pc.close());
    pcsRef.current = {};

    setPeers({});
    setParticipantCount(0);
  };

  // Helper renderer for Remote stream streams (audio only, with individual mute option)
  const RemoteStreamView = ({ peer }: { peer: PeerInfo }) => {
    const isPeerMutedByMe = mutedPeers[peer.id] || false;

    return (
      <div className="flex flex-col items-center justify-center p-1.5 bg-[#12131a] border border-gray-800/60 rounded-xl relative group shrink-0 min-w-[70px] transition-all duration-300 hover:border-cyan-500/30">
        <div className="relative">
          {/* Pulsing ring animation for active speaking */}
          <div className={`absolute -inset-1 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 opacity-20 blur-sm ${!isPeerMutedByMe && peer.stream ? 'animate-pulse' : 'hidden'}`} />
          
          <div className="relative w-10 h-10 rounded-full bg-[#1c1d26] border border-gray-700/80 flex items-center justify-center text-white font-bold text-xs shadow-md overflow-hidden">
            {peer.avatar ? (
              <img src={peer.avatar} alt={peer.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              peer.name[0]?.toUpperCase() || <User size={14} />
            )}
          </div>

          {/* Peer volume/mute button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleMutePeer(peer.id);
            }}
            className={`absolute -bottom-1 -right-1 p-0.5 rounded-full transition-all cursor-pointer z-20 shadow-md ${
              isPeerMutedByMe 
                ? 'bg-red-600 text-white border border-red-500' 
                : 'bg-[#181920] border border-gray-800 text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
            title={isPeerMutedByMe ? 'আনমিউট করুন' : 'মিউট করুন'}
          >
            {isPeerMutedByMe ? <VolumeX size={9} /> : <Volume2 size={9} />}
          </button>
        </div>

        <div className="text-[9px] font-medium text-gray-300 mt-1 max-w-[60px] truncate text-center">
          {peer.name}
        </div>

        {peer.stream && (
          <audio
            ref={(el) => {
              if (el && peer.stream) {
                el.srcObject = peer.stream;
              }
            }}
            autoPlay
            muted={isPeerMutedByMe}
          />
        )}
      </div>
    );
  };

  // If user is not joined yet, show super compact sign-in
  if (!isJoined) {
    const finalAvatarPreview = customAvatarUrl.trim() || selectedAvatar;
    return (
      <div className="flex flex-col h-full p-4 justify-between bg-[#0b0c10] overflow-y-auto">
        {onClose && (
          <div className="flex justify-end w-full">
            <button
              onClick={onClose}
              type="button"
              className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-800/40 transition-colors cursor-pointer"
              title="বন্ধ করুন"
            >
              <X size={18} />
            </button>
          </div>
        )}
        <div className="flex-1 flex flex-col justify-start items-center py-2 text-center max-w-sm mx-auto w-full">
          <div className="w-10 h-10 bg-gradient-to-tr from-cyan-500 via-blue-600 to-purple-600 rounded-xl flex items-center justify-center text-white mb-1 shadow-[0_0_15px_rgba(6,182,212,0.2)] border border-cyan-400/20">
            <Mic className="w-5 h-5 animate-pulse" />
          </div>
          <h3 className="text-sm font-bold text-white mb-0.5 tracking-wide">
            লাইভ অডিও আড্ডা (Live Adda) 🎙️
          </h3>
          <p className="text-[10px] text-gray-400 leading-normal mb-2.5">
            অন্যান্য দর্শকদের সাথে সরাসরি লাইভ অডিও কলে কথা বলুন এবং লাইভ চ্যাট করুন!
          </p>

          {/* Form */}
          <div className="w-full space-y-3 text-left">
            <div>
              <label className="block text-[10px] font-semibold text-gray-400 mb-1 pl-1">
                আপনার নাম
              </label>
              <input
                type="text"
                placeholder="নাম লিখুন..."
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                maxLength={20}
                className="w-full bg-[#16171d] border border-gray-800 focus:border-cyan-500/50 rounded-xl px-3 py-1.5 text-xs text-white placeholder-gray-600 outline-none transition-all text-center"
              />
            </div>

            {/* Avatar Selector Option */}
            <div>
              <label className="block text-[10px] font-semibold text-gray-400 mb-1 pl-1">
                প্রোফাইল পিকচার পছন্দ করুন (মিট কলের মতো)
              </label>
              <div className="grid grid-cols-6 gap-1.5 mb-2">
                {PRESET_AVATARS.map((av) => (
                  <button
                    key={av.id}
                    type="button"
                    onClick={() => {
                      setSelectedAvatar(av.url);
                      setCustomAvatarUrl('');
                    }}
                    className={`w-9 h-9 rounded-full overflow-hidden border-2 cursor-pointer transition-transform ${
                      selectedAvatar === av.url && !customAvatarUrl
                        ? 'border-cyan-500 scale-105 shadow-[0_0_8px_rgba(6,182,212,0.5)]'
                        : 'border-gray-800 hover:border-gray-600'
                    }`}
                  >
                    <img src={av.url} alt={av.label} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>

              <div>
                <label className="block text-[9px] text-gray-500 mb-1 pl-1">
                  অথবা নিজের ছবির লিংক দিন (Custom Image URL)
                </label>
                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    placeholder="https://example.com/my-photo.jpg"
                    value={customAvatarUrl}
                    onChange={(e) => setCustomAvatarUrl(e.target.value)}
                    className="flex-1 bg-[#16171d] border border-gray-800 focus:border-cyan-500/50 rounded-xl px-3 py-1.5 text-[10px] text-white placeholder-gray-700 outline-none transition-all"
                  />
                  {finalAvatarPreview && (
                    <div className="w-8 h-8 rounded-full overflow-hidden border border-gray-800 shrink-0">
                      <img src={finalAvatarPreview} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </div>
                  )}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={joinRoom}
              className="w-full bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white font-bold py-2 px-4 rounded-xl shadow-[0_4px_15px_rgba(6,182,212,0.25)] transition-all cursor-pointer text-xs flex items-center justify-center gap-1.5"
            >
              <Mic size={12} />
              আড্ডায় যোগ দিন
            </button>
          </div>
        </div>

        <div className="text-[9px] text-gray-600 text-center border-t border-gray-900/40 pt-2 mt-2 flex items-center justify-center gap-1 shrink-0">
          <Users size={10} /> Nexarion TV Audio Network
        </div>
      </div>
    );
  }

  // Active meeting screen
  const peersList = Object.values(peers);

  return (
    <div className="flex flex-col h-full bg-[#0a0a0c] text-white">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-[#0e0f14] border-b border-gray-900 shrink-0">
        <div className="flex items-center gap-2">
          <div className="relative flex items-center justify-center">
            <span className="absolute inline-flex h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </div>
          <span className="text-xs font-bold text-gray-200 truncate max-w-[130px]">
            {roomName} আড্ডা
          </span>
          <span className="bg-cyan-950 text-cyan-400 text-[10px] px-1.5 py-0.5 rounded-full font-bold flex items-center gap-0.5">
            <Users size={10} /> {participantCount || 1}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={leaveRoom}
            className="flex items-center gap-1 text-red-500 hover:text-red-400 text-xs font-bold px-2 py-1 rounded-lg hover:bg-red-500/10 transition-colors cursor-pointer"
          >
            <PhoneOff size={11} />
            <span>আড্ডা ত্যাগ</span>
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white p-1 rounded hover:bg-gray-800 transition-colors cursor-pointer"
              title="বন্ধ করুন"
            >
              <X size={15} />
            </button>
          )}
        </div>
      </div>

      {/* Call Participants list (Horizontal scrolling, very clean and compact) */}
      <div className="p-2 border-b border-gray-950 bg-[#070709] shrink-0">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {/* Local Participant */}
          <div className="flex flex-col items-center justify-center p-1.5 bg-[#12131a]/60 border border-cyan-500/20 rounded-xl relative shrink-0 min-w-[70px]">
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-cyan-950 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-bold text-xs shadow-[0_0_10px_rgba(6,182,212,0.15)] overflow-hidden">
                {customAvatarUrl.trim() || selectedAvatar ? (
                  <img src={customAvatarUrl.trim() || selectedAvatar} alt={userName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  userName[0]?.toUpperCase() || 'Me'
                )}
              </div>
              <button
                onClick={toggleMute}
                className={`absolute -bottom-1 -right-1 p-0.5 rounded-full transition-all cursor-pointer z-20 shadow-md ${
                  isMuted 
                    ? 'bg-red-600 text-white border border-red-500' 
                    : 'bg-cyan-600 border border-cyan-500 text-white hover:bg-cyan-500'
                }`}
                title={isMuted ? 'আনমিউট করুন' : 'মিউট করুন'}
              >
                {isMuted ? <MicOff size={9} /> : <Mic size={9} />}
              </button>
            </div>
            <div className="text-[9px] font-bold text-cyan-400 mt-1 max-w-[60px] truncate text-center">
              আমি
            </div>
          </div>

          {/* Remote Participants */}
          {peersList.map((peer) => (
            <RemoteStreamView key={peer.id} peer={peer} />
          ))}
        </div>
        
        {/* Helper instruction tooltip for muting noise */}
        <div className="text-[10px] text-cyan-400/90 bg-cyan-950/20 border border-cyan-950/50 rounded-lg px-2.5 py-1 mt-1 text-center font-medium">
          💡 আড্ডায় অন্য কোনো ইউজারের গোলমাল বা নয়েজ বন্ধ করতে তার ছবির নিচে থাকা লাল/ধূসর স্পিকার বাটনে ক্লিক করে তাকে মিউট করুন।
        </div>
      </div>

      {/* Real-time Messages Feed */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 flex flex-col justify-end">
        <div className="overflow-y-auto space-y-2.5 flex-1 pr-1" style={{ maxHeight: '100%' }}>
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-gray-600 py-4">
              <MessageSquare size={20} className="mb-1 text-gray-800" />
              <p className="text-[10px] Bengali text-gray-500">কোনো মেসেজ নেই। প্রথম মেসেজটি লিখুন!</p>
            </div>
          ) : (
            messages.map((msg, index) => {
              const msgIsMe = msg.senderName === userName;
              return (
                <div key={index} className={`flex flex-col ${msgIsMe ? 'items-end' : 'items-start'}`}>
                  <span className="text-[9px] text-gray-500 font-medium mb-0.5 pl-1 pr-1">
                    {msg.senderName}
                  </span>
                  <div className={`px-2.5 py-1.5 rounded-2xl text-[11px] max-w-[85%] break-words shadow-sm leading-relaxed ${
                    msgIsMe 
                      ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-tr-none' 
                      : 'bg-[#16171d] border border-gray-800 text-gray-200 rounded-tl-none'
                  }`}>
                    {msg.text}
                  </div>
                </div>
              );
            })
          )}
          <div ref={chatEndRef} />
        </div>
      </div>

      {/* Control Buttons & Input Panel */}
      <div className="p-2 bg-[#0e0f14] border-t border-gray-900 shrink-0">
        {/* Text Input Message Form with integrated mute button */}
        <form onSubmit={sendChatMessage} className="flex gap-2 items-center">
          <button
            type="button"
            onClick={toggleMute}
            className={`p-2 rounded-xl cursor-pointer transition-all ${
              isMuted 
                ? 'bg-red-600 text-white shadow-[0_0_8px_rgba(220,38,38,0.2)]' 
                : 'bg-[#16171d] border border-gray-800 text-gray-400 hover:text-white'
            }`}
            title={isMuted ? 'আনমিউট করুন' : 'মিউট করুন'}
          >
            {isMuted ? <MicOff size={13} /> : <Mic size={13} />}
          </button>

          <input
            type="text"
            placeholder="একটি মেসেজ লিখুন..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            className="flex-1 bg-[#16171d] border border-gray-800 focus:border-cyan-500/50 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-600 outline-none transition-all"
          />
          <button
            type="submit"
            className="p-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white cursor-pointer transition-all shrink-0"
          >
            <Send size={12} />
          </button>
        </form>
      </div>
    </div>
  );
}
