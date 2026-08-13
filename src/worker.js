// Dota Live HUD — Cloudflare Workers version
// Replaces the old Node/Express/ws server. No local Node.js install needed —
// this whole file runs inside Cloudflare's own infrastructure.
//
// - The Durable Object (GameStateHub) holds the "current game state" in memory
//   and keeps the live list of connected dashboard WebSocket clients. Workers
//   themselves are stateless per-request, so a Durable Object is what gives us
//   a single, persistent place to store state and fan out broadcasts.
// - The default export is the normal Worker fetch handler. It only runs for
//   requests that don't match a static file in /public (index.html, app.js,
//   style.css are served automatically by the Workers "assets" feature).

const POWER_RUNE_START = 6 * 60; // first power rune at 6:00
const POWER_RUNE_INTERVAL = 2 * 60; // then every 2 minutes
const BOUNTY_RUNE_START = 0; // bounty runes spawn at 0:00
const BOUNTY_RUNE_INTERVAL = 3 * 60; // then every 3 minutes

function nextRuneTime(gameTime, start, interval) {
  if (gameTime < start) return start;
  const elapsed = gameTime - start;
  const cyclesPassed = Math.floor(elapsed / interval);
  return start + (cyclesPassed + 1) * interval;
}

function computeRuneTimers(gameTime) {
  if (typeof gameTime !== 'number') return null;
  const nextPower = nextRuneTime(gameTime, POWER_RUNE_START, POWER_RUNE_INTERVAL);
  const nextBounty = nextRuneTime(gameTime, BOUNTY_RUNE_START, BOUNTY_RUNE_INTERVAL);
  return {
    power_in: Math.max(0, Math.round(nextPower - gameTime)),
    bounty_in: Math.max(0, Math.round(nextBounty - gameTime)),
  };
}

export class GameStateHub {
  constructor(state) {
    this.state = state;
    this.sockets = new Set();
    this.lastState = null;
  }

  async fetch(request) {
    const url = new URL(request.url);

    // Dashboard connects here for live push updates
    if (url.pathname === '/ws') {
      if (request.headers.get('Upgrade') !== 'websocket') {
        return new Response('Expected websocket', { status: 426 });
      }
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      server.accept();
      this.sockets.add(server);
      if (this.lastState) {
        server.send(JSON.stringify(this.lastState));
      }
      const cleanup = () => this.sockets.delete(server);
      server.addEventListener('close', cleanup);
      server.addEventListener('error', cleanup);
      return new Response(null, { status: 101, webSocket: client });
    }

    // Dota 2's GSI client POSTs here — point the .cfg "uri" at
    // https://<your-worker>.workers.dev/gsi
    if (url.pathname === '/gsi' && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const gameTime = body.map && body.map.game_time;
      const runes = computeRuneTimers(gameTime);
      this.lastState = { ...body, runes, received_at: Date.now() };
      this.broadcast(this.lastState);
      return new Response('ok');
    }

    // Lets the dashboard fetch the last known state on page load/reconnect
    if (url.pathname === '/state') {
      return new Response(JSON.stringify(this.lastState || {}), {
        headers: { 'content-type': 'application/json' },
      });
    }

    return new Response('not found', { status: 404 });
  }

  broadcast(data) {
    const payload = JSON.stringify(data);
    for (const ws of this.sockets) {
      try {
        ws.send(payload);
      } catch {
        this.sockets.delete(ws);
      }
    }
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/gsi' || url.pathname === '/ws' || url.pathname === '/state') {
      // Single shared instance so every request hits the same in-memory state
      const id = env.GAME_HUB.idFromName('singleton');
      const stub = env.GAME_HUB.get(id);
      return stub.fetch(request);
    }

    // Anything else (index.html, app.js, style.css, favicon, ...) is already
    // served by the Workers static assets layer before this code even runs.
    // If we get here, the path genuinely doesn't exist.
    return new Response('Not found', { status: 404 });
  },
};
