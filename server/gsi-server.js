// Dota2 Plus Live HUD - Desktop (Electron) single-user server
// Simplified from the original multi-user VPS server:
//   - no userKey system (always "default")
//   - binds to 127.0.0.1 only (not reachable from the network)
//   - no landing page (Electron loads the HUD directly)
const express = require("express");
const { WebSocketServer } = require("ws");
const http = require("http");
const path = require("path");

const USER_KEY = "default";
const MAX_EVENTS = 30;

const POWER_RUNE_START = 6 * 60;
const POWER_RUNE_INTERVAL = 2 * 60;
const BOUNTY_RUNE_START = 0;
const BOUNTY_RUNE_INTERVAL = 3 * 60;

function nextRuneTime(gameTime, start, interval) {
  if (gameTime < start) return start;
  const elapsed = gameTime - start;
  const cyclesPassed = Math.floor(elapsed / interval);
  return start + (cyclesPassed + 1) * interval;
}

function computeRuneTimers(gameTime) {
  if (typeof gameTime !== "number") return null;
  const nextPower = nextRuneTime(gameTime, POWER_RUNE_START, POWER_RUNE_INTERVAL);
  const nextBounty = nextRuneTime(gameTime, BOUNTY_RUNE_START, BOUNTY_RUNE_INTERVAL);
  return {
    power_in: Math.max(0, Math.round(nextPower - gameTime)),
    bounty_in: Math.max(0, Math.round(nextBounty - gameTime)),
  };
}

// Single-user state (no Map of users needed on desktop)
const state = {
  lastState: null,
  eventLog: [],
  sockets: new Set(),
  lastMatchId: null,
  roshanKillTime: null,
  aegisPickupTime: null,
};

function broadcast(data) {
  const payload = JSON.stringify(data);
  for (const ws of state.sockets) {
    try {
      if (ws.readyState === 1) ws.send(payload);
    } catch {
      state.sockets.delete(ws);
    }
  }
}

/**
 * Starts the HUD server on 127.0.0.1:port.
 * Returns { server, gsiPath, wsPath } once listening.
 */
function startServer(port) {
  const app = express();
  const server = http.createServer(app);

  app.use(express.json({ limit: "2mb" }));

  const publicPath = path.join(__dirname, "..", "public");
  app.use("/assets", express.static(path.join(publicPath, "assets"), { maxAge: "1d" }));
  app.use(express.static(publicPath, { index: "index.html", maxAge: "1h" }));

  app.post(`/gsi/${USER_KEY}`, (req, res) => {
    const body = req.body;
    const gameTime = body.map && body.map.game_time;
    const runes = computeRuneTimers(gameTime);
    const matchId = body.map && body.map.matchid;

    if (matchId && matchId !== state.lastMatchId) {
      state.eventLog = [];
      state.lastMatchId = matchId;
      state.roshanKillTime = null;
      state.aegisPickupTime = null;
    }

    if (Array.isArray(body.events)) {
      for (const ev of body.events) {
        const dupe = state.eventLog.some(
          (e) => e.game_time === ev.game_time && e.event_type === ev.event_type
            && e.team === ev.team && e.player_id === ev.player_id
        );
        if (!dupe) {
          state.eventLog.push(ev);
          if (ev.event_type === "roshan_killed") state.roshanKillTime = ev.game_time;
          if (ev.event_type === "aegis_picked_up") state.aegisPickupTime = ev.game_time;
          if (ev.event_type === "aegis_denied") state.aegisPickupTime = null;
        }
      }
      state.eventLog = state.eventLog.slice(-MAX_EVENTS);
    }

    const roshanData = state.roshanKillTime !== null ? {
      killed_at: state.roshanKillTime,
      window_start: state.roshanKillTime + 8 * 60,
      window_end: state.roshanKillTime + 11 * 60,
    } : null;

    const aegisData = state.aegisPickupTime !== null ? {
      picked_up_at: state.aegisPickupTime,
      expires_at: state.aegisPickupTime + 5 * 60,
    } : null;

    state.lastState = {
      ...body,
      runes,
      events_log: state.eventLog,
      received_at: Date.now(),
      roshan: roshanData,
      aegis: aegisData,
    };
    broadcast(state.lastState);
    res.send("ok");
  });

  app.get(`/state/${USER_KEY}`, (req, res) => {
    res.json(state.lastState || {});
  });

  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (request, socket, head) => {
    const { pathname } = new URL(request.url, `http://${request.headers.host}`);
    if (pathname === `/ws/${USER_KEY}`) {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws);
      });
    } else {
      socket.destroy();
    }
  });

  wss.on("connection", (ws) => {
    state.sockets.add(ws);
    if (state.lastState) {
      try { ws.send(JSON.stringify(state.lastState)); } catch {}
    }
    const cleanup = () => state.sockets.delete(ws);
    ws.on("close", cleanup);
    ws.on("error", cleanup);
  });

  return new Promise((resolve, reject) => {
    server.on("error", reject);
    // 127.0.0.1 only: not reachable from the local network, unlike the VPS version
    server.listen(port, "127.0.0.1", () => {
      resolve({
        server,
        gsiUrl: `http://127.0.0.1:${port}/gsi/${USER_KEY}`,
        hudUrl: `http://127.0.0.1:${port}/`,
      });
    });
  });
}

module.exports = { startServer, USER_KEY };
