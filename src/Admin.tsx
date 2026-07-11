import React, { useState, useEffect } from 'react';
import { useAppState, saveAppStateToBackend, AppState, Channel, StreamServer, Category, getApiBaseUrl } from './store';
import { Settings, Plus, Trash2, LogOut, Video, Link as LinkIcon, Image as ImageIcon, Save, AlertCircle, Users, ShieldAlert, VolumeX, MicOff } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
// @ts-ignore
import logoImg from './assets/images/nexarion_logo_1783781161849.jpg';

export default function Admin() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [activeTab, setActiveTab] = useState<'notice' | 'categories' | 'channels' | 'banning'>('notice');

  // Banning & Active viewers states
  const [activeUsers, setActiveUsers] = useState<any[]>([]);
  const [bannedIps, setBannedIps] = useState<any[]>([]);
  const [banIpInput, setBanIpInput] = useState('');
  const [banReasonInput, setBanReasonInput] = useState('Violating terms');

  const { state, loading } = useAppState();
  const [localState, setLocalState] = useState<AppState>(state);
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  useEffect(() => {
    if (!loading) {
      setLocalState(state);
    }
  }, [state, loading]);

  useEffect(() => {
    if (!loading && hasChanges) {
      const timer = setTimeout(async () => {
        setIsSaving(true);
        try {
          await saveAppStateToBackend(localState);
          toast.success('Auto-saved!');
        } catch (e) {
          toast.error('Failed to auto-save');
        }
        setIsSaving(false);
        setHasChanges(false);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [localState, hasChanges, loading]);

  const updateState = (newState: AppState) => {
    setLocalState(newState);
    setHasChanges(true);
  };

  const fetchBanningData = async () => {
    try {
      const authHeader = 'Bearer MUNNA12061';
      
      const usersRes = await fetch(`${getApiBaseUrl()}/api/admin/active-users`, {
        headers: { 'Authorization': authHeader }
      });
      if (usersRes.ok) {
        const uData = await usersRes.json();
        // Combine active voice and active watcher info if desired, or just display voice chatters
        setActiveUsers(uData.voice || []);
      }

      const bansRes = await fetch(`${getApiBaseUrl()}/api/admin/banned-ips`, {
        headers: { 'Authorization': authHeader }
      });
      if (bansRes.ok) {
        const bData = await bansRes.json();
        setBannedIps(bData || []);
      }
    } catch (e) {
      console.error("Error fetching admin data:", e);
    }
  };

  useEffect(() => {
    if (isAuthenticated && activeTab === 'banning') {
      fetchBanningData();
      const interval = setInterval(fetchBanningData, 4000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated, activeTab]);

  const handleBanIp = async (ip: string, reason: string) => {
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/admin/ban-ip`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer MUNNA12061'
        },
        body: JSON.stringify({ ip, reason })
      });
      if (res.ok) {
        toast.success(`IP ${ip} has been banned.`);
        fetchBanningData();
      } else {
        toast.error('Failed to ban IP.');
      }
    } catch (e) {
      toast.error('Error banning IP.');
    }
  };

  const handleUnbanIp = async (ip: string) => {
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/admin/unban-ip`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer MUNNA12061'
        },
        body: JSON.stringify({ ip })
      });
      if (res.ok) {
        toast.success(`IP ${ip} has been unbanned.`);
        fetchBanningData();
      } else {
        toast.error('Failed to unban IP.');
      }
    } catch (e) {
      toast.error('Error unbanning IP.');
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === 'MUNNA12061') {
      setIsAuthenticated(true);
      toast.success('Login successful!');
    } else {
      toast.error('Incorrect password');
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-gray-900 flex items-center justify-center text-cyan-500 font-bold">Loading Admin...</div>;
  }

  const saveChanges = async () => {
    setIsSaving(true);
    try {
      await saveAppStateToBackend(localState);
      toast.success('Changes saved successfully!');
      setHasChanges(false);
    } catch (e) {
      toast.error('Failed to save changes');
    }
    setIsSaving(false);
  };

  const updateNotice = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    updateState({ ...localState, noticeText: e.target.value });
  };

  const addChannel = () => {
    if (localState.categories.length === 0) {
      toast.error('Please create at least one category first.');
      return;
    }
    const newChannel: Channel = {
      id: Date.now().toString(),
      name: 'New Channel',
      logo: '',
      categoryId: localState.categories[0].id,
      servers: []
    };
    updateState({
      ...localState,
      channels: [newChannel, ...localState.channels]
    });
  };

  const updateChannel = (channelId: string, field: keyof Channel, value: any) => {
    updateState({
      ...localState,
      channels: localState.channels.map(c => 
        c.id === channelId ? { ...c, [field]: value } : c
      )
    });
  };

  const deleteChannel = (channelId: string) => {
    if (confirm('Are you sure you want to delete this channel?')) {
      updateState({
        ...localState,
        channels: localState.channels.filter(c => c.id !== channelId)
      });
    }
  };

  const addServerToChannel = (channelId: string) => {
    updateState({
      ...localState,
      channels: localState.channels.map(c => {
        if (c.id === channelId) {
          const newServer: StreamServer = {
            id: Date.now().toString(),
            name: `Server ${c.servers.length + 1}`,
            url: ''
          };
          return { ...c, servers: [...c.servers, newServer] };
        }
        return c;
      })
    });
  };

  const updateServer = (channelId: string, serverId: string, field: keyof StreamServer, value: string) => {
    updateState({
      ...localState,
      channels: localState.channels.map(c => {
        if (c.id === channelId) {
          return {
            ...c,
            servers: c.servers.map(s => 
              s.id === serverId ? { ...s, [field]: value } : s
            )
          };
        }
        return c;
      })
    });
  };

  const removeServer = (channelId: string, serverId: string) => {
    updateState({
      ...localState,
      channels: localState.channels.map(c => {
        if (c.id === channelId) {
          return { ...c, servers: c.servers.filter(s => s.id !== serverId) };
        }
        return c;
      })
    });
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <Toaster position="top-center" />
        <form onSubmit={handleLogin} className="bg-black border border-gray-800 p-8 rounded-xl shadow-2xl max-w-sm w-full">
          <div className="flex justify-center mb-6 text-cyan-500">
            <Settings size={48} />
          </div>
          <h2 className="text-2xl font-bold text-white text-center mb-6">Admin Login</h2>
          <input
            type="password"
            placeholder="Enter Admin Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-gray-900 border border-gray-700 text-white rounded-lg px-4 py-3 mb-4 focus:outline-none focus:border-cyan-500"
          />
          <button type="submit" className="w-full bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-3 px-4 rounded-lg transition-colors">
            Login
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-200">
      <Toaster position="top-right" />
      
      {/* Admin Header */}
      <header className="bg-black border-b border-gray-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <img src={logoImg} alt="Logo" className="w-8 h-8 rounded-full mr-2 border border-cyan-500/30" />
              <h1 className="text-xl font-bold text-white">Nexarion TV Admin</h1>
            </div>
            <div className="flex items-center space-x-4">
               <button 
                onClick={saveChanges}
                className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md transition-colors"
              >
                <Save size={18} />
                <span className="hidden sm:inline">
                  {isSaving ? 'Saving...' : (hasChanges ? 'Unsaved Changes' : 'All changes saved')}
                </span>
              </button>
              <button 
                onClick={() => setIsAuthenticated(false)}
                className="flex items-center space-x-2 text-gray-400 hover:text-white transition-colors"
              >
                <LogOut size={18} />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col md:flex-row gap-8">
        
        {/* Sidebar Nav */}
        <aside className="md:w-64 flex-shrink-0">
          <nav className="space-y-1">
            <button
              onClick={() => setActiveTab('notice')}
              className={`w-full flex items-center px-4 py-3 rounded-lg font-medium transition-colors ${
                activeTab === 'notice' ? 'bg-cyan-900/50 text-cyan-400 border border-cyan-800/50' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <AlertCircle className="mr-3 flex-shrink-0 h-5 w-5" />
              Notice & Coming Soon
            </button>
            <button
              onClick={() => setActiveTab('categories')}
              className={`w-full flex items-center px-4 py-3 rounded-lg font-medium transition-colors ${
                activeTab === 'categories' ? 'bg-cyan-900/50 text-cyan-400 border border-cyan-800/50' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <Settings className="mr-3 flex-shrink-0 h-5 w-5" />
              Categories
            </button>
            <button
              onClick={() => setActiveTab('channels')}
              className={`w-full flex items-center px-4 py-3 rounded-lg font-medium transition-colors ${
                activeTab === 'channels' ? 'bg-cyan-900/50 text-cyan-400 border border-cyan-800/50' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <Video className="mr-3 flex-shrink-0 h-5 w-5" />
              Channels & Servers
            </button>
            <button
              onClick={() => setActiveTab('banning')}
              className={`w-full flex items-center px-4 py-3 rounded-lg font-medium transition-colors ${
                activeTab === 'banning' ? 'bg-red-950/50 text-red-400 border border-red-800/50' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <ShieldAlert className="mr-3 flex-shrink-0 h-5 w-5" />
              Users & Banning
            </button>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1">
          
          {activeTab === 'notice' && (
            <div className="space-y-6">
              {/* Maintenance Mode Toggle Card */}
              <div className="bg-black border border-gray-800 rounded-xl p-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 h-24 w-24 bg-red-500/5 rounded-full blur-2xl" />
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-black text-white flex items-center gap-2">
                      <ShieldAlert className="text-red-500 animate-pulse" size={20} />
                      <span>রক্ষণাবেক্ষণ মোড (Maintenance Mode)</span>
                    </h2>
                    <p className="text-xs text-gray-400 mt-1 max-w-xl leading-normal">
                      এটি চালু থাকলে দর্শকরা সাইটে প্রবেশ করলেই রক্ষণাবেক্ষণ নোটিশটি দেখতে পাবে এবং অন্য কোনো ফিচার ব্যবহার করতে পারবে না।
                    </p>
                  </div>
                  <button
                    onClick={() => updateState({ ...localState, maintenanceMode: !localState.maintenanceMode })}
                    className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      localState.maintenanceMode
                        ? 'bg-red-600 hover:bg-red-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.3)]'
                        : 'bg-gray-800 hover:bg-gray-700 text-gray-300'
                    }`}
                  >
                    {localState.maintenanceMode ? '🔴 ACTIVE (চালু আছে)' : '⚪ INACTIVE (বন্ধ আছে)'}
                  </button>
                </div>
              </div>

              <div className="bg-black border border-gray-800 rounded-xl p-6">
                <h2 className="text-xl font-bold text-white mb-4">Edit Scrolling Notice</h2>
                <textarea
                  value={localState.noticeText}
                  onChange={updateNotice}
                  rows={3}
                  className="w-full bg-gray-900 border border-gray-700 text-white rounded-lg p-4 focus:outline-none focus:border-cyan-500 transition-colors text-sm"
                  placeholder="Enter the notice text here..."
                />
                <p className="mt-2 text-xs text-gray-500 font-medium font-sans">This text will scroll at the top of the TV app.</p>
              </div>

              <div className="bg-black border border-gray-800 rounded-xl p-6">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <Video size={20} className="text-cyan-400" />
                  <span>Offline / Coming Soon Media</span>
                </h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-400 mb-1.5">Media URL (ভিডিও অথবা ছবির লিঙ্ক)</label>
                    <input
                      type="text"
                      value={localState.comingSoonUrl || ''}
                      onChange={(e) => updateState({ ...localState, comingSoonUrl: e.target.value })}
                      placeholder="e.g. https://example.com/coming_soon_match.mp4 or photo.jpg"
                      className="w-full bg-gray-900 border border-gray-700 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-cyan-500 transition-colors"
                    />
                    <p className="mt-1.5 text-xs text-gray-500 leading-normal">
                      যখন কোনো চ্যানেলে খেলা অফলাইন থাকবে, তখন এই ভিডিও অথবা ছবিটি ফুল ডিসপ্লেতে দর্শকরা দেখতে পাবে।
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-400 mb-1.5">Media Type (ফাইলের ধরন)</label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                        <input
                          type="radio"
                          name="comingSoonType"
                          value="video"
                          checked={localState.comingSoonType === 'video'}
                          onChange={() => updateState({ ...localState, comingSoonType: 'video' })}
                          className="accent-cyan-500 cursor-pointer"
                        />
                        <span>Video (ভিডিও)</span>
                      </label>
                      <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                        <input
                          type="radio"
                          name="comingSoonType"
                          value="image"
                          checked={localState.comingSoonType === 'image'}
                          onChange={() => updateState({ ...localState, comingSoonType: 'image' })}
                          className="accent-cyan-500 cursor-pointer"
                        />
                        <span>Image / Banner (ছবি বা ব্যানার)</span>
                      </label>
                      <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                        <input
                          type="radio"
                          name="comingSoonType"
                          value=""
                          checked={!localState.comingSoonType}
                          onChange={() => updateState({ ...localState, comingSoonType: '' })}
                          className="accent-cyan-500 cursor-pointer"
                        />
                        <span>Disabled (বন্ধ)</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'categories' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-white">Manage Categories</h2>
                <button 
                  onClick={() => {
                    const newCategory: Category = { id: Date.now().toString(), label: 'New Category', iconName: undefined };
                    updateState({ ...localState, categories: [...localState.categories, newCategory] });
                  }}
                  className="flex items-center space-x-2 bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium"
                >
                  <Plus size={16} />
                  <span>Add Category</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {localState.categories.map((cat) => (
                  <div key={cat.id} className="bg-black border border-gray-800 rounded-xl p-4 flex items-center justify-between">
                    <div className="flex-1 mr-4">
                      <label className="block text-sm font-medium text-gray-400 mb-1">Label</label>
                      <input
                        type="text"
                        value={cat.label}
                        onChange={(e) => {
                          const val = e.target.value;
                          updateState({
                            ...localState,
                            categories: localState.categories.map(c => c.id === cat.id ? { ...c, label: val } : c)
                          });
                        }}
                        className="w-full bg-gray-900 border border-gray-700 text-white rounded-md px-3 py-2 text-sm focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                    <div className="flex-1 mr-4">
                      <label className="block text-sm font-medium text-gray-400 mb-1">Icon Name (lucide)</label>
                      <input
                        type="text"
                        value={cat.iconName || ''}
                        placeholder="e.g. Heart, Trophy, Tv"
                        onChange={(e) => {
                          const val = e.target.value;
                          updateState({
                            ...localState,
                            categories: localState.categories.map(c => c.id === cat.id ? { ...c, iconName: val || undefined } : c)
                          });
                        }}
                        className="w-full bg-gray-900 border border-gray-700 text-white rounded-md px-3 py-2 text-sm focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                    <button 
                      onClick={() => {
                        if (localState.categories.length <= 1) {
                          toast.error('You must have at least one category.');
                          return;
                        }
                        if(confirm('Are you sure you want to delete this category? All channels in this category will also be deleted.')) {
                          updateState({
                            ...localState,
                            categories: localState.categories.filter(c => c.id !== cat.id),
                            channels: localState.channels.filter(c => c.categoryId !== cat.id)
                          });
                        }
                      }}
                      className="p-2 text-red-500 hover:bg-red-950/30 rounded-lg transition-colors mt-5"
                      title="Delete Category"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'channels' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-white">Manage Channels</h2>
                <button 
                  onClick={addChannel}
                  className="flex items-center space-x-2 bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium"
                >
                  <Plus size={16} />
                  <span>Add Channel</span>
                </button>
              </div>

              {localState.channels.map((channel) => (
                <div key={channel.id} className="bg-black border border-gray-800 rounded-xl p-6">
                  <div className="flex justify-between items-start mb-6">
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Channel Name</label>
                        <input
                          type="text"
                          value={channel.name}
                          onChange={(e) => updateChannel(channel.id, 'name', e.target.value)}
                          className="w-full bg-gray-900 border border-gray-700 text-white rounded-md px-3 py-2 text-sm focus:outline-none focus:border-cyan-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Category</label>
                        <select
                          value={channel.categoryId}
                          onChange={(e) => updateChannel(channel.id, 'categoryId', e.target.value)}
                          className="w-full bg-gray-900 border border-gray-700 text-white rounded-md px-3 py-2 text-sm focus:outline-none focus:border-cyan-500"
                        >
                          {localState.categories.map(cat => (
                            <option key={cat.id} value={cat.id}>{cat.label}</option>
                          ))}
                        </select>
                      </div>

                      {/* Team 1, Team 2 Match Details with automatic country flags */}
                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Team 1 Name (e.g. Argentina, Brazil)</label>
                        <input
                          type="text"
                          value={channel.team1 || ''}
                          onChange={(e) => updateChannel(channel.id, 'team1', e.target.value)}
                          placeholder="Empty if not a vs match"
                          className="w-full bg-gray-900 border border-gray-700 text-white rounded-md px-3 py-2 text-sm focus:outline-none focus:border-cyan-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Team 2 Name (e.g. Bangladesh, India)</label>
                        <input
                          type="text"
                          value={channel.team2 || ''}
                          onChange={(e) => updateChannel(channel.id, 'team2', e.target.value)}
                          placeholder="Empty if not a vs match"
                          className="w-full bg-gray-900 border border-gray-700 text-white rounded-md px-3 py-2 text-sm focus:outline-none focus:border-cyan-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Match Time Description</label>
                        <input
                          type="text"
                          value={channel.matchTime || ''}
                          onChange={(e) => updateChannel(channel.id, 'matchTime', e.target.value)}
                          placeholder="e.g. Today 9:30 PM, LIVE, COMING SOON"
                          className="w-full bg-gray-900 border border-gray-700 text-white rounded-md px-3 py-2 text-sm focus:outline-none focus:border-cyan-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Match Status</label>
                        <select
                          value={channel.status || 'inactive'}
                          onChange={(e) => updateChannel(channel.id, 'status', e.target.value)}
                          className="w-full bg-gray-900 border border-gray-700 text-white rounded-md px-3 py-2 text-sm focus:outline-none focus:border-cyan-500"
                        >
                          <option value="inactive">Inactive / hidden (বন্ধ)</option>
                          <option value="live">Live (লাইভ চলছে)</option>
                          <option value="coming_soon">Coming Soon (অপেক্ষা করুন)</option>
                        </select>
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-400 mb-1 flex items-center">
                          <ImageIcon size={14} className="mr-1" /> Logo URL (Optional, use 'rakib' or 'blue' for default designs)
                        </label>
                        <input
                          type="text"
                          value={channel.logo}
                          onChange={(e) => updateChannel(channel.id, 'logo', e.target.value)}
                          placeholder="https://example.com/logo.png"
                          className="w-full bg-gray-900 border border-gray-700 text-white rounded-md px-3 py-2 text-sm focus:outline-none focus:border-cyan-500"
                        />
                      </div>
                    </div>
                    <button 
                      onClick={() => deleteChannel(channel.id)}
                      className="ml-4 p-2 text-red-500 hover:bg-red-950/30 rounded-lg transition-colors"
                      title="Delete Channel"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>

                  {/* Servers Section for this Channel */}
                  <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-800">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-sm font-bold text-gray-300">Servers (M3U Links)</h3>
                      <button 
                        onClick={() => addServerToChannel(channel.id)}
                        className="flex items-center space-x-1 text-cyan-400 hover:text-cyan-300 text-xs font-medium"
                      >
                        <Plus size={14} />
                        <span>Add Server</span>
                      </button>
                    </div>

                    {channel.servers.length === 0 ? (
                      <p className="text-xs text-gray-500 italic">No servers added yet. Add a server link so users can watch.</p>
                    ) : (
                      <div className="space-y-3">
                        {channel.servers.map((server) => (
                          <div key={server.id} className="flex flex-col sm:flex-row gap-2 items-start sm:items-center bg-black p-3 rounded-md border border-gray-800">
                            <input
                              type="text"
                              value={server.name}
                              onChange={(e) => updateServer(channel.id, server.id, 'name', e.target.value)}
                              placeholder="Server Name"
                              className="w-full sm:w-1/3 bg-gray-900 border border-gray-700 text-white rounded-md px-3 py-1.5 text-xs focus:outline-none focus:border-cyan-500"
                            />
                            <div className="w-full flex-1 flex items-center relative">
                              <LinkIcon size={12} className="absolute left-2.5 text-gray-500" />
                              <input
                                type="text"
                                value={server.url}
                                onChange={(e) => updateServer(channel.id, server.id, 'url', e.target.value)}
                                placeholder="M3U Playlist URL (e.g. http://.../stream.m3u8)"
                                className="w-full pl-8 bg-gray-900 border border-gray-700 text-white rounded-md px-3 py-1.5 text-xs focus:outline-none focus:border-cyan-500"
                              />
                            </div>
                            <button 
                              onClick={() => removeServer(channel.id, server.id)}
                              className="p-1.5 text-red-500 hover:bg-red-950/30 rounded-md transition-colors sm:self-center self-end mt-2 sm:mt-0"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              
              {localState.channels.length === 0 && (
                <div className="text-center py-12 bg-black border border-gray-800 rounded-xl">
                  <Video className="mx-auto h-12 w-12 text-gray-600 mb-4" />
                  <h3 className="text-lg font-medium text-white mb-2">No channels found</h3>
                  <p className="text-gray-400 text-sm mb-4">Get started by adding your first TV channel.</p>
                  <button 
                    onClick={addChannel}
                    className="inline-flex items-center space-x-2 bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium"
                  >
                    <Plus size={16} />
                    <span>Add Channel</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'banning' && (
            <div className="space-y-6">
              {/* Ban an IP Manual Form */}
              <div className="bg-black border border-gray-800 rounded-xl p-6">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <ShieldAlert className="text-red-500" size={20} />
                  <span>নতুন আইপি ব্যান করুন (Ban a New IP)</span>
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 mb-1">IP Address</label>
                    <input
                      type="text"
                      placeholder="e.g. 192.168.1.5"
                      value={banIpInput}
                      onChange={(e) => setBanIpInput(e.target.value)}
                      className="w-full bg-gray-900 border border-gray-700 text-white rounded-lg px-4 py-2.5 text-xs focus:outline-none focus:border-red-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 mb-1">Reason (কারণ)</label>
                    <input
                      type="text"
                      placeholder="e.g. Abusive behavior, multi-accounts"
                      value={banReasonInput}
                      onChange={(e) => setBanReasonInput(e.target.value)}
                      className="w-full bg-gray-900 border border-gray-700 text-white rounded-lg px-4 py-2.5 text-xs focus:outline-none focus:border-red-500"
                    />
                  </div>
                  <button
                    onClick={() => {
                      if (!banIpInput.trim()) {
                        toast.error('Please enter an IP address.');
                        return;
                      }
                      handleBanIp(banIpInput.trim(), banReasonInput.trim());
                      setBanIpInput('');
                    }}
                    className="bg-red-600 hover:bg-red-500 text-white font-bold py-2.5 px-6 rounded-lg text-xs transition-colors cursor-pointer"
                  >
                    Ban IP Address
                  </button>
                </div>
              </div>

              {/* Active Voice Chat Participants */}
              <div className="bg-black border border-gray-800 rounded-xl p-6">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <Users className="text-cyan-400" size={20} />
                  <span>বর্তমানে লাইভ আড্ডায় আছেন (Active Voice Chatters)</span>
                </h2>
                {activeUsers.length === 0 ? (
                  <p className="text-sm text-gray-500 italic py-2 font-sans">বর্তমানে কেউ লাইভ আড্ডায় যুক্ত নেই।</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-gray-300">
                      <thead className="text-xs text-gray-400 uppercase bg-gray-900">
                        <tr>
                          <th className="px-4 py-3">User Name</th>
                          <th className="px-4 py-3">Room / Channel</th>
                          <th className="px-4 py-3">IP Address</th>
                          <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800">
                        {activeUsers.map((user) => (
                          <tr key={user.id} className="hover:bg-gray-950/40">
                            <td className="px-4 py-3 font-semibold text-white flex items-center gap-2">
                              <span className="text-base">{user.avatar || '🎙️'}</span>
                              <span>{user.userName}</span>
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-400">{user.roomId}</td>
                            <td className="px-4 py-3 font-mono text-xs text-gray-400">{user.ip}</td>
                            <td className="px-4 py-3 text-right">
                              <button
                                onClick={() => handleBanIp(user.ip, `Banned via Active Voice Chat panel: ${user.userName}`)}
                                className="bg-red-950/50 hover:bg-red-900/50 border border-red-500/30 text-red-400 font-bold px-3 py-1 rounded-md text-xs transition-colors cursor-pointer"
                              >
                                Ban IP
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Banned IPs Database List */}
              <div className="bg-black border border-gray-800 rounded-xl p-6">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <ShieldAlert className="text-red-500" size={20} />
                  <span>ব্যান করা আইপি তালিকা (Banned IP List)</span>
                </h2>
                {bannedIps.length === 0 ? (
                  <p className="text-sm text-gray-500 italic py-2 font-sans">বর্তমানে কোনো আইপি ব্যান করা নেই।</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-gray-300">
                      <thead className="text-xs text-red-400 bg-red-950/20 border-b border-red-900/30">
                        <tr>
                          <th className="px-4 py-3">IP Address</th>
                          <th className="px-4 py-3">Reason (ব্যানের কারণ)</th>
                          <th className="px-4 py-3">Banned At</th>
                          <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800">
                        {bannedIps.map((b) => (
                          <tr key={b.ip} className="hover:bg-red-950/5">
                            <td className="px-4 py-3 font-mono text-sm text-red-400 font-bold">{b.ip}</td>
                            <td className="px-4 py-3 text-xs text-gray-400">{b.reason || 'No reason specified'}</td>
                            <td className="px-4 py-3 text-xs text-gray-500 font-sans">
                              {b.createdAt ? new Date(b.createdAt).toLocaleString() : 'N/A'}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button
                                onClick={() => handleUnbanIp(b.ip)}
                                className="bg-green-950 hover:bg-green-900 text-green-400 font-bold px-3 py-1 rounded-md text-xs transition-colors cursor-pointer"
                              >
                                Unban
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
          
        </main>
      </div>
    </div>
  );
}
