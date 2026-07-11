import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { db } from "./src/db/index.ts";
import { appState, channels, streamServers, categories, bannedIps } from "./src/db/schema.ts";
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { Readable } from "stream";
// @ts-ignore
import NodeMediaServer from 'node-media-server';
import httpProxy from 'http-proxy';
import { WebSocketServer } from 'ws';
import { spawn } from 'child_process';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Initialize Node Media Server
  const nmsConfig = {
    rtmp: {
      port: 1935,
      chunk_size: 60000,
      gop_cache: true,
      ping: 30,
      ping_timeout: 60
    },
    http: {
      port: 8009,
      allow_origin: '*',
      mediaroot: './media',
    },
    trans: {
      ffmpeg: '/usr/bin/ffmpeg',
      tasks: [
        {
          app: 'live',
          hls: true,
          hlsFlags: '[hls_time=2:hls_list_size=3:hls_flags=delete_segments]',
          hlsKeep: false,
        }
      ]
    }
  };

  const nms = new NodeMediaServer(nmsConfig);
  try {
    nms.run();
    console.log("[NMS] Node Media Server started successfully");
  } catch (error) {
    console.error("[NMS] Error starting Node Media Server:", error);
  }

  // Create HTTP Proxy Server for proxying streams from port 8000 to port 3000
  const apiProxy = httpProxy.createProxyServer({
    ws: true
  });

  apiProxy.on('error', (err, req, res) => {
    console.error('[Proxy Error]:', err);
    if (res && 'writeHead' in res) {
      res.writeHead(502);
      res.end('NMS Stream Gateway Error');
    }
  });

  app.use(express.json());

  // Proxy HTTP stream and playlist requests to Node Media Server
  app.all(['/live/*', '/api/nms/*'], (req, res) => {
    apiProxy.web(req, res, { target: 'http://127.0.0.1:8009' });
  });

  // HLS/IPTV Stream Proxy to bypass Mixed Content (HTTP on HTTPS) and CORS issues
  app.get("/api/stream-proxy", async (req, res) => {
    const targetUrl = req.query.url as string;
    if (!targetUrl) {
      return res.status(400).send("Missing url parameter");
    }

    try {
      const urlObj = new URL(targetUrl);
      
      const headers: Record<string, string> = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      };

      if (req.headers.range) {
        headers["Range"] = req.headers.range as string;
      }

      const response = await fetch(targetUrl, { headers });

      if (!response.ok) {
        return res.status(response.status).send(`Failed fetching target URL: ${response.statusText}`);
      }

      const contentType = response.headers.get("content-type") || "";
      if (contentType) {
        res.setHeader("Content-Type", contentType);
      }
      
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Headers", "*");

      const contentRange = response.headers.get("content-range");
      if (contentRange) res.setHeader("Content-Range", contentRange);

      const acceptRanges = response.headers.get("accept-ranges");
      if (acceptRanges) res.setHeader("Accept-Ranges", acceptRanges);

      const contentLength = response.headers.get("content-length");
      if (contentLength) res.setHeader("Content-Length", contentLength);

      const isPlaylist = targetUrl.toLowerCase().includes(".m3u8") || 
                         contentType.toLowerCase().includes("mpegurl") || 
                         contentType.toLowerCase().includes("mpegurl") ||
                         targetUrl.toLowerCase().includes("m3u8");

      if (isPlaylist) {
        const text = await response.text();
        const lines = text.split(/\r?\n/);
        const rewrittenLines = lines.map(line => {
          const trimmed = line.trim();
          if (!trimmed) return line;

          if (trimmed.startsWith("#")) {
            if (trimmed.includes('URI=')) {
              return trimmed.replace(/URI="([^"]+)"/g, (match, uriValue) => {
                try {
                  const resolved = new URL(uriValue, targetUrl).toString();
                  if (resolved.startsWith('http://')) {
                    return `URI="/api/stream-proxy?url=${encodeURIComponent(resolved)}"`;
                  }
                  return `URI="${resolved}"`;
                } catch (e) {
                  return match;
                }
              });
            }
            return line;
          }

          try {
            const resolvedUrl = new URL(trimmed, targetUrl).toString();
            if (resolvedUrl.startsWith('http://')) {
              return `/api/stream-proxy?url=${encodeURIComponent(resolvedUrl)}`;
            }
            return resolvedUrl;
          } catch (e) {
            return line;
          }
        });

        res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
        return res.send(rewrittenLines.join("\n"));
      }

      if (response.body) {
        Readable.fromWeb(response.body as any).pipe(res);
      } else {
        res.end();
      }
    } catch (error) {
      console.error("Stream proxy error:", error);
      res.status(500).send("Error proxying stream: " + String(error));
    }
  });

  // API Routes
  app.get("/api/state", async (req, res) => {
    try {
      const clientIp = (req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || '').split(',')[0].trim();
      const isBanned = await db.select().from(bannedIps).where(eq(bannedIps.ip, clientIp)).limit(1);
      if (isBanned.length > 0) {
        return res.status(403).json({ banned: true, reason: isBanned[0].reason || "Your IP has been banned by the administrator." });
      }

      // Fetch state from db
      let stateRecord = await db.select().from(appState).limit(1);
      
      let isFirstInit = false;
      if (stateRecord.length === 0) {
        isFirstInit = true;
        // Insert default
        const defaultState = {
          id: '1',
          noticeText: 'যেকোনো চ্যানেল চালু করার পর অনুগ্রহ করে ৫-১০ সেকেন্ড অপেক্ষা করুন** লোডিং সম্পন্ন হলে চ্যানেলটি স্বয়ংক্রিয়ভাবে প্লে হবে*** কোনো চ্যানেল না চললে ভিপিএন (VPN) ব্যবহার করুন।',
          comingSoonUrl: '',
          comingSoonType: '',
          maintenanceMode: false,
          updatedAt: new Date()
        };
        await db.insert(appState).values(defaultState);
        stateRecord = [defaultState];
      }

      const allCategories = await db.select().from(categories);
      let activeCategories = allCategories;
      
      if (isFirstInit && allCategories.length === 0) {
        const defaultCats = [
          { id: 'all', label: 'All', iconName: null },
          { id: 'favorites', label: 'Favorites', iconName: 'Heart' },
          { id: 'bangla', label: 'Bangla', iconName: null },
          { id: 'fifa', label: 'FIFA World Cup', iconName: 'Trophy' },
          { id: 'sports', label: 'Sports', iconName: null },
          { id: 'news', label: 'News', iconName: null },
          { id: 'entertainment', label: 'Entertainment', iconName: null },
        ];
        await db.insert(categories).values(defaultCats);
        activeCategories = defaultCats;
      }

      const allChannels = await db.select().from(channels);
      let formattedChannels = [];

      if (isFirstInit && allChannels.length === 0) {
        const c1Id = uuidv4();
        const c2Id = uuidv4();
        const c3Id = uuidv4();

        const defaultChannels = [
          { id: c1Id, name: 'SOCO Live', logo: 'rakib', categoryId: 'sports', active: true, team1: 'Bangladesh', team2: 'India', matchTime: 'LIVE NOW', status: 'live' },
          { id: c2Id, name: 'BTV', logo: 'blue', categoryId: 'bangla', active: false, team1: '', team2: '', matchTime: '', status: 'inactive' },
          { id: c3Id, name: 'Somoy TV', logo: 'rakib', categoryId: 'news', active: false, team1: '', team2: '', matchTime: '', status: 'inactive' }
        ];
        
        await db.insert(channels).values(defaultChannels);

        const defaultServers = [
          { id: uuidv4(), channelId: c1Id, name: 'Server 1', url: 'http://example.com/stream.m3u8' },
          { id: uuidv4(), channelId: c2Id, name: 'Server 1', url: 'http://example.com/btv.m3u8' },
          { id: uuidv4(), channelId: c3Id, name: 'Server 1', url: 'http://example.com/somoy.m3u8' }
        ];

        await db.insert(streamServers).values(defaultServers);
        
        formattedChannels = defaultChannels.map(c => ({
          ...c,
          servers: defaultServers.filter(s => s.channelId === c.id)
        }));
      } else {
        const allServers = await db.select().from(streamServers);
        formattedChannels = allChannels.map(c => ({
          ...c,
          servers: allServers.filter(s => s.channelId === c.id)
        }));
      }

      res.json({
        noticeText: stateRecord[0].noticeText,
        comingSoonUrl: stateRecord[0].comingSoonUrl,
        comingSoonType: stateRecord[0].comingSoonType,
        maintenanceMode: stateRecord[0].maintenanceMode,
        categories: activeCategories,
        channels: formattedChannels,
      });
    } catch (error) {
      console.error('Error fetching state:', error);
      res.status(500).json({ error: "Failed to fetch state", details: String(error) });
    }
  });

  // Admin auth check (basic)
  const requireAdmin = (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    if (authHeader === 'Bearer MUNNA12061') {
      return next();
    }
    return res.status(401).json({ error: 'Unauthorized' });
  };

  app.post("/api/state", requireAdmin, async (req, res) => {
    try {
      const { noticeText, comingSoonUrl, comingSoonType, maintenanceMode, categories: newCategories, channels: newChannels } = req.body;

      if (noticeText !== undefined || comingSoonUrl !== undefined || comingSoonType !== undefined || maintenanceMode !== undefined) {
        await db.update(appState).set({ 
          noticeText, 
          comingSoonUrl: comingSoonUrl || null, 
          comingSoonType: comingSoonType || null, 
          maintenanceMode: maintenanceMode !== undefined ? maintenanceMode : false,
          updatedAt: new Date() 
        }).where(eq(appState.id, '1'));
      }

      if (newChannels) {
        // Simple sync strategy: wipe all and insert
        await db.delete(streamServers);
        await db.delete(channels);
      }

      if (newCategories) {
        await db.delete(categories);
        for (const cat of newCategories) {
          await db.insert(categories).values({
            id: cat.id || uuidv4(),
            label: cat.label,
            iconName: cat.iconName || null
          });
        }
      }

      if (newChannels) {
        for (const channel of newChannels) {
          const cid = channel.id || uuidv4();
          await db.insert(channels).values({
            id: cid,
            name: channel.name,
            logo: channel.logo || null,
            categoryId: channel.categoryId,
            active: channel.active || false,
            team1: channel.team1 || null,
            team2: channel.team2 || null,
            matchTime: channel.matchTime || null,
            status: channel.status || 'inactive'
          });

          for (const server of channel.servers) {
            await db.insert(streamServers).values({
              id: server.id || uuidv4(),
              channelId: cid,
              name: server.name,
              url: server.url
            });
          }
        }
      }

      res.json({ success: true });
    } catch (error) {
      console.error('Error updating state:', error);
      res.status(500).json({ error: "Failed to update state", details: String(error) });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  // Setup WebSocket Server for Live Streaming ingest over WebSockets
  const wss = new WebSocketServer({ noServer: true });

  wss.on('connection', (ws, req) => {
    const urlObj = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
    const streamKey = urlObj.searchParams.get('key') || 'stream';
    console.log(`[Streaming] Client connected for stream key: ${streamKey}`);

    // Transcode incoming fragmented WebM stream chunks to RTMP FLV using FFmpeg
    // We use ultrafast presets with zero latency tuning to keep streaming completely buffer-free.
    const ffmpegArgs = [
      '-i', 'pipe:0',
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
      '-tune', 'zerolatency',
      '-g', '30',
      '-c:a', 'aac',
      '-ar', '44100',
      '-b:a', '64k',
      '-f', 'flv',
      `rtmp://127.0.0.1:1935/live/${streamKey}`
    ];

    console.log(`[Streaming] Spawning FFmpeg to publish to local RTMP: rtmp://127.0.0.1:1935/live/${streamKey}`);
    const ffmpegProcess = spawn('ffmpeg', ffmpegArgs);

    ffmpegProcess.stderr.on('data', (data) => {
      // Keep silent to reduce log spam
    });

    ffmpegProcess.on('close', (code) => {
      console.log(`[Streaming] FFmpeg closed with exit code: ${code}`);
      ws.close();
    });

    ffmpegProcess.on('error', (err) => {
      console.error('[Streaming] FFmpeg start error:', err);
      ws.close();
    });

    ws.on('message', (message) => {
      if (ffmpegProcess.stdin.writable) {
        ffmpegProcess.stdin.write(message);
      }
    });

    ws.on('close', () => {
      console.log(`[Streaming] Client closed websocket. Terminating FFmpeg.`);
      try {
        ffmpegProcess.kill('SIGKILL');
      } catch (e) {}
    });

    ws.on('error', (err) => {
      console.error('[Streaming] Client websocket error:', err);
      try {
        ffmpegProcess.kill('SIGKILL');
      } catch (e) {}
    });
  });

  // Setup WebSocket Server for Watcher Tracking
  const watcherWss = new WebSocketServer({ noServer: true });
  const watchers = new Map<string, { ws: any, ip: string, joinedAt: number }>();

  function broadcastWatcherCount() {
    const count = watchers.size;
    const data = JSON.stringify({ type: 'count', count });
    watchers.forEach(w => {
      try {
        w.ws.send(data);
      } catch (e) {}
    });
  }

  watcherWss.on('connection', async (ws, req) => {
    const id = uuidv4();
    const clientIp = (req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || '').split(',')[0].trim();

    // Check if banned
    const isBannedCheck = await db.select().from(bannedIps).where(eq(bannedIps.ip, clientIp)).limit(1);
    if (isBannedCheck.length > 0) {
      try {
        ws.send(JSON.stringify({ type: 'banned', reason: isBannedCheck[0].reason }));
        ws.close();
      } catch (e) {}
      return;
    }

    watchers.set(id, { ws, ip: clientIp, joinedAt: Date.now() });
    broadcastWatcherCount();

    ws.on('close', () => {
      watchers.delete(id);
      broadcastWatcherCount();
    });

    ws.on('error', () => {
      watchers.delete(id);
      broadcastWatcherCount();
    });
  });

  // Admin Routes for Watchers & Bans
  app.get("/api/admin/active-users", requireAdmin, async (req, res) => {
    try {
      const activeWatchers = Array.from(watchers.values()).map(w => ({
        ip: w.ip,
        joinedAt: w.joinedAt
      }));

      const activeVoice = Array.from(meetingClients.values()).map(c => ({
        id: c.id,
        userName: c.userName,
        ip: c.ip,
        roomId: c.roomId,
        avatar: c.avatar
      }));

      res.json({ watchers: activeWatchers, voice: activeVoice });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.get("/api/admin/banned-ips", requireAdmin, async (req, res) => {
    try {
      const list = await db.select().from(bannedIps);
      res.json(list);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.post("/api/admin/ban-ip", requireAdmin, async (req, res) => {
    const { ip, reason } = req.body;
    if (!ip) return res.status(400).json({ error: "IP is required" });
    try {
      await db.insert(bannedIps).values({ ip, reason: reason || "Banned by admin" }).onConflictDoNothing();
      
      // Immediately disconnect any active watchers with this IP
      watchers.forEach((w, id) => {
        if (w.ip === ip) {
          try { w.ws.send(JSON.stringify({ type: 'banned', reason })); } catch(e){}
          try { w.ws.close(); } catch(e){}
          watchers.delete(id);
        }
      });

      // Immediately disconnect any voice chat clients with this IP
      meetingClients.forEach((c, id) => {
        if (c.ip === ip) {
          try { c.ws.send(JSON.stringify({ type: 'banned', reason })); } catch(e){}
          try { c.ws.close(); } catch(e){}
          meetingClients.delete(id);
        }
      });

      broadcastWatcherCount();
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.post("/api/admin/unban-ip", requireAdmin, async (req, res) => {
    const { ip } = req.body;
    if (!ip) return res.status(400).json({ error: "IP is required" });
    try {
      await db.delete(bannedIps).where(eq(bannedIps.ip, ip));
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // Setup WebSocket Server for Real-time Group Voice/Video Chats and Messages
  const meetingWss = new WebSocketServer({ noServer: true });

  interface MeetingClient {
    id: string;
    ws: any;
    roomId: string;
    userName: string;
    ip: string;
    deviceId: string;
    avatar?: string;
  }

  const meetingClients = new Map<string, MeetingClient>();

  meetingWss.on('connection', async (ws, req) => {
    const clientId = uuidv4();
    let currentRoomId = '';
    let currentUserName = '';
    const clientIp = (req?.headers['x-forwarded-for'] as string || req?.socket.remoteAddress || '').split(',')[0].trim();

    // Check if banned
    const isBannedCheck = await db.select().from(bannedIps).where(eq(bannedIps.ip, clientIp)).limit(1);
    if (isBannedCheck.length > 0) {
      try {
        ws.send(JSON.stringify({ type: 'banned', reason: isBannedCheck[0].reason }));
        ws.close();
      } catch (e) {}
      return;
    }

    ws.on('message', (messageBuffer) => {
      try {
        const message = JSON.parse(messageBuffer.toString());
        
        if (message.type === 'join') {
          currentRoomId = message.roomId || 'lobby';
          currentUserName = message.userName || 'Guest';
          const deviceId = message.deviceId || '';
          const avatar = message.avatar || '';

          // Register client
          meetingClients.set(clientId, {
            id: clientId,
            ws,
            roomId: currentRoomId,
            userName: currentUserName,
            ip: clientIp,
            deviceId: deviceId,
            avatar
          });

          // Get existing peers in the room
          const peers = Array.from(meetingClients.values())
            .filter(c => c.roomId === currentRoomId && c.id !== clientId)
            .map(c => ({ id: c.id, name: c.userName, avatar: c.avatar || '' }));

          // Send init payload to newly joined client
          ws.send(JSON.stringify({
            type: 'init',
            clientId,
            clients: peers
          }));

          // Notify existing peers
          meetingClients.forEach(c => {
            if (c.roomId === currentRoomId && c.id !== clientId) {
              c.ws.send(JSON.stringify({
                type: 'user-joined',
                id: clientId,
                name: currentUserName,
                avatar
              }));
            }
          });

          console.log(`[Meeting] Client ${currentUserName} (${clientId}) joined room ${currentRoomId} with avatar ${avatar}`);
        } else if (message.type === 'signal') {
          const targetClient = meetingClients.get(message.targetId);
          if (targetClient) {
            targetClient.ws.send(JSON.stringify({
              type: 'signal',
              senderId: clientId,
              signal: message.signal
            }));
          }
        } else if (message.type === 'chat') {
          const chatPayload = JSON.stringify({
            type: 'chat',
            senderId: clientId,
            senderName: currentUserName || 'Guest',
            text: message.text,
            timestamp: Date.now()
          });

          meetingClients.forEach(c => {
            if (c.roomId === currentRoomId) {
              c.ws.send(chatPayload);
            }
          });
        }
      } catch (err) {
        console.error('[Meeting] Error processing message:', err);
      }
    });

    const cleanup = () => {
      if (meetingClients.has(clientId)) {
        meetingClients.delete(clientId);
        
        if (currentRoomId) {
          meetingClients.forEach(c => {
            if (c.roomId === currentRoomId) {
              c.ws.send(JSON.stringify({
                type: 'user-left',
                id: clientId
              }));
            }
          });
        }
        console.log(`[Meeting] Client ${currentUserName || 'Guest'} (${clientId}) left room ${currentRoomId}`);
      }
    };

    ws.on('close', cleanup);
    ws.on('error', cleanup);
  });

  // Setup main HTTP server Upgrade listener
  server.on('upgrade', (req, socket, head) => {
    const urlObj = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
    
    if (urlObj.pathname === '/api/stream-upload') {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req);
      });
    } else if (urlObj.pathname === '/api/meeting') {
      meetingWss.handleUpgrade(req, socket, head, (ws) => {
        meetingWss.emit('connection', ws, req);
      });
    } else if (urlObj.pathname === '/api/watcher') {
      watcherWss.handleUpgrade(req, socket, head, (ws) => {
        watcherWss.emit('connection', ws, req);
      });
    } else if (req.url && (req.url.startsWith('/live/') || req.url.startsWith('/api/nms/'))) {
      apiProxy.ws(req, socket, head, { target: 'ws://127.0.0.1:8009' });
    } else {
      socket.destroy();
    }
  });
}

startServer();
