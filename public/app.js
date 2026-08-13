const CIRC = 2 * Math.PI * 44; // matches r=44 in the SVG rings
const POWER_INTERVAL = 120;
const BOUNTY_INTERVAL = 180;

const el = (id) => document.getElementById(id);

function fmtClock(seconds) {
  if (typeof seconds !== 'number') return '00:00';
  const neg = seconds < 0;
  const s = Math.abs(Math.round(seconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${neg ? '-' : ''}${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function prettyName(raw, prefix) {
  if (!raw) return null;
  return raw.replace(prefix, '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function setRing(fgEl, timeLeft, interval) {
  const ratio = Math.max(0, Math.min(1, timeLeft / interval));
  fgEl.style.strokeDashoffset = CIRC * (1 - ratio);
}

function render(state) {
  if (!state || !state.provider) {
    el('disconnected-banner').classList.remove('hidden');
    return;
  }
  el('disconnected-banner').classList.add('hidden');

  const map = state.map || {};
  const player = state.player || {};
  const hero = state.hero || {};
  const abilities = state.abilities || {};
  const items = state.items || {};
  const buildings = state.buildings || {};
  const runes = state.runes || {};

  // Top bar
  el('clock').textContent = fmtClock(map.clock_time ?? map.game_time);
  el('daynight').textContent = map.daytime === false ? '🌙' : '☀';
  el('radiant-score').textContent = map.radiant_score ?? 0;
  el('dire-score').textContent = map.dire_score ?? 0;

  // Rune timers
  el('bounty-time').textContent = fmtClock(runes.bounty_in);
  el('power-time').textContent = fmtClock(runes.power_in);
  setRing(el('bounty-ring-fg'), runes.bounty_in ?? 0, BOUNTY_INTERVAL);
  setRing(el('power-ring-fg'), runes.power_in ?? 0, POWER_INTERVAL);

  // Hero identity
  const name = prettyName(hero.name, 'npc_dota_hero_');
  el('hero-name').textContent = name || '— هنوز هیرویی انتخاب نشده —';
  el('hero-level').textContent = hero.level ?? 0;

  // Bars
  const hp = hero.health ?? 0, hpMax = hero.max_health ?? 0;
  const mp = hero.mana ?? 0, mpMax = hero.max_mana ?? 0;
  el('hp-fill').style.width = hpMax ? `${(hp / hpMax) * 100}%` : '0%';
  el('mp-fill').style.width = mpMax ? `${(mp / mpMax) * 100}%` : '0%';
  el('hp-value').textContent = `${hp} / ${hpMax}`;
  el('mp-value').textContent = `${mp} / ${mpMax}`;

  // Respawn
  const respawnBanner = el('respawn-banner');
  if (hero.alive === false && hero.respawn_seconds) {
    respawnBanner.classList.remove('hidden');
    el('respawn-time').textContent = hero.respawn_seconds;
  } else {
    respawnBanner.classList.add('hidden');
  }

  // Stats
  el('gold').textContent = player.gold ?? 0;
  el('gpm').textContent = player.gpm ?? 0;
  el('xpm').textContent = player.xpm ?? 0;
  el('kda').textContent = `${player.kills ?? 0} / ${player.deaths ?? 0} / ${player.assists ?? 0}`;
  el('lhdn').textContent = `${player.last_hits ?? 0} / ${player.denies ?? 0}`;
  el('buyback').textContent = hero.buyback_cooldown > 0
    ? `${hero.buyback_cooldown}s`
    : (hero.buyback_cost ? `${hero.buyback_cost}g` : '—');

  // Items
  const itemSlots = ['slot0','slot1','slot2','slot3','slot4','slot5','slot6','slot7','slot8','neutral0'];
  const itemsGrid = el('items-grid');
  itemsGrid.innerHTML = '';
  itemSlots.forEach((slotKey) => {
    const it = items[slotKey];
    const div = document.createElement('div');
    div.className = 'slot' + (it && it.name && it.name !== 'empty' ? ' filled' : '');
    if (it && it.name && it.name !== 'empty') {
      div.textContent = prettyName(it.name, 'item_');
      if (it.cooldown > 0) {
        const cd = document.createElement('div');
        cd.className = 'cooldown';
        cd.textContent = it.cooldown;
        div.appendChild(cd);
      }
      if (it.charges) {
        const badge = document.createElement('div');
        badge.className = 'level-badge';
        badge.textContent = `x${it.charges}`;
        div.appendChild(badge);
      }
    }
    itemsGrid.appendChild(div);
  });

  // Abilities
  const abilityKeys = Object.keys(abilities).filter((k) => k.startsWith('ability'));
  const abilitiesGrid = el('abilities-grid');
  abilitiesGrid.innerHTML = '';
  abilityKeys.forEach((k) => {
    const ab = abilities[k];
    const div = document.createElement('div');
    div.className = 'slot' + (ab && ab.name && ab.name !== 'empty' ? ' filled' : '');
    if (ab && ab.name && ab.name !== 'empty') {
      div.textContent = prettyName(ab.name, '');
      if (ab.cooldown > 0) {
        const cd = document.createElement('div');
        cd.className = 'cooldown';
        cd.textContent = ab.cooldown;
        div.appendChild(cd);
      }
      if (typeof ab.level === 'number') {
        const badge = document.createElement('div');
        badge.className = 'level-badge';
        badge.textContent = ab.level;
        div.appendChild(badge);
      }
    }
    abilitiesGrid.appendChild(div);
  });

  // Buildings
  renderBuildings('radiant-buildings', buildings.radiant, 'radiant');
  renderBuildings('dire-buildings', buildings.dire, 'dire');
}

function renderBuildings(containerId, teamBuildings, team) {
  const container = el(containerId);
  container.querySelectorAll('.building-row').forEach((n) => n.remove());
  if (!teamBuildings) return;

  Object.entries(teamBuildings).forEach(([lane, structures]) => {
    Object.entries(structures).forEach(([key, b]) => {
      const pct = b.max_health ? Math.round((b.health / b.max_health) * 100) : 0;
      const row = document.createElement('div');
      row.className = 'building-row' + (b.health <= 0 ? ' dead' : '');
      row.innerHTML = `
        <span class="b-name">${lane} ${key.replace(/_/g, ' ')}</span>
        <div class="building-track"><div class="building-fill" style="width:${pct}%"></div></div>
        <span class="b-pct">${pct}%</span>
      `;
      container.appendChild(row);
    });
  });
}

function connect() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  const ws = new WebSocket(`${proto}://${location.host}/ws`);

  ws.onmessage = (evt) => {
    try {
      render(JSON.parse(evt.data));
    } catch (e) {
      console.error('bad state payload', e);
    }
  };
  ws.onclose = () => setTimeout(connect, 1500);
  ws.onerror = () => ws.close();
}

// Show last known state immediately, then open the live socket
fetch('/state').then((r) => r.json()).then(render).catch(() => {});
connect();
