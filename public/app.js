const USER_KEY = window.HUD_USER_KEY || 'default';

const CIRC = 2 * Math.PI * 44;
const POWER_INTERVAL = 120;
const BOUNTY_INTERVAL = 180;
const ASSET_BASE = 'assets/';

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

function heroIconPath(rawName) {
  if (!rawName) return null;
  const key = rawName.replace('npc_dota_hero_', '');
  return `${ASSET_BASE}${key}_icon.png`;
}

const ITEM_ICON_OVERRIDES = {
  blink: 'blink-dagger.jpg',
  ultimate_scepter: 'aghanims-scepter.jpg',
  aghanims_scepter: 'aghanims-scepter.jpg',
  aghanims_scepter_roshan: 'aghanims-scepter.jpg',
  boots: 'boots-of-speed.jpg',
  travel_boots: 'boots-of-travel.jpg',
  travel_boots_2: 'boots-of-travel-2.jpg',
  magic_stick: 'magic-stick.jpg',
  magic_wand: 'magic-wand.jpg',
  power_treads: 'power-treads.jpg',
  black_king_bar: 'black-king-bar.jpg',
  bfury: 'battle-fury.jpg',
  monkey_king_bar: 'monkey-king-bar.jpg',
  heart: 'heart-of-tarrasque.jpg',
  assault: 'assault-cuirass.jpg',
  refresher: 'refresher-orb.jpg',
  sphere: 'linkens-sphere.jpg',
  diffusal_blade: 'diffusal-blade.jpg',
  euls_scepter: 'euls-scepter-of-divinity.jpg',
  pipe: 'pipe-of-insight.jpg',
  vladmir: 'vladmirs-offering.jpg',
  ward_observer: 'observer-ward.jpg',
  ward_sentry: 'sentry-ward.jpg',
  dust: 'dust-of-appearance.jpg',
  tpscroll: 'town-portal-scroll.jpg',
  flask: 'healing-salve.jpg',
  branches: 'iron-branch.jpg',
  smoke_of_deceit: 'smoke-of-deceit.jpg',
  aegis: 'aegis-of-the-immortal.jpg',
  rapier: 'divine-rapier.jpg',
  skadi: 'eye-of-skadi.jpg',
  abyssal_blade: 'abyssal-blade.jpg',
};

function itemIconPath(rawName) {
  if (!rawName || rawName === 'empty') return null;
  const key = rawName.replace('item_', '');
  const filename = ITEM_ICON_OVERRIDES[key] || `${key.replace(/_/g, '-')}.jpg`;
  return `${ASSET_BASE}${filename}`;
}

const GAME_STATE_LABELS = {
  DOTA_GAMERULES_STATE_INIT: 'در حال بارگذاری بازی',
  DOTA_GAMERULES_STATE_WAIT_FOR_PLAYERS_TO_LOAD: 'در انتظار ورود بازیکن‌ها',
  DOTA_GAMERULES_STATE_HERO_SELECTION: 'در حال انتخاب هیرو (پیک/بن)',
  DOTA_GAMERULES_STATE_STRATEGY_TIME: 'زمان استراتژی',
  DOTA_GAMERULES_STATE_PRE_GAME: 'پیش‌بازی — هنوز شروع نشده',
  DOTA_GAMERULES_STATE_GAME_IN_PROGRESS: null,
  DOTA_GAMERULES_STATE_POST_GAME: 'بازی تمام شد',
  DOTA_GAMERULES_STATE_DISCONNECT: 'قطع ارتباط از بازی',
};

const DEBUFF_LABELS = [
  ['stunned', 'استان'],
  ['silenced', 'سایلنس'],
  ['disarmed', 'دیس‌آرم'],
  ['hexed', 'هگز'],
  ['muted', 'میوت'],
  ['break', 'بریک'],
  ['magicimmune', 'ایمیون به جادو'],
  ['smoked', 'اسموک شده'],
];

const EVENT_LABELS = {
  roshan_killed: { text: 'روشان کشته شد', icon: '🐲' },
  aegis_picked_up: { text: 'ایجیس برداشته شد', icon: '🛡️' },
  aegis_denied: { text: 'ایجیس دنای شد', icon: '🚫' },
  courier_killed: { text: 'کوریر کشته شد', icon: '🦌' },
  bounty_rune_pickup: { text: 'بانتی رون گرفته شد', icon: '🪙' },
  tip: { text: 'تیپ (نوش‌آبه) داده شد', icon: '💸' },
};

function eventLabel(ev) {
  const known = EVENT_LABELS[ev.event_type];
  if (known) return known;
  return { text: (ev.event_type || 'رویداد').replace(/_/g, ' '), icon: '📌' };
}

function render(state) {
  const livePill = el('live-dot');
  if (!state || !state.provider) {
    el('disconnected-banner').classList.remove('hidden');
    el('live-text').textContent = 'در انتظار اتصال';
    livePill.classList.remove('connected');
    el('gsi-setup').classList.remove('hidden');
    return;
  }
  el('disconnected-banner').classList.add('hidden');
  el('live-text').textContent = 'متصل';
  livePill.classList.add('connected');
  el('gsi-setup').classList.add('hidden');

  const map = state.map || {};
  const player = state.player || {};
  const hero = state.hero || {};
  const abilities = state.abilities || {};
  const items = state.items || {};
  const buildings = state.buildings || {};
  const runes = state.runes || {};
  const draft = state.draft || null;
  const eventsLog = state.events_log || [];

  el('clock').textContent = fmtClock(map.clock_time ?? map.game_time);
  el('daynight').textContent = map.daytime === false ? '🌙' : '☀';
  const dnTrack = el('daynight-track');
  if (dnTrack) dnTrack.classList.toggle('is-night', map.daytime === false);
  el('radiant-score').textContent = map.radiant_score ?? 0;
  el('dire-score').textContent = map.dire_score ?? 0;

  el('pause-pill').classList.toggle('hidden', map.paused !== true);

  const phaseBanner = el('phase-banner');
  const phaseLabel = GAME_STATE_LABELS[map.game_state];
  if (map.game_state && map.game_state !== 'DOTA_GAMERULES_STATE_POST_GAME' && phaseLabel) {
    phaseBanner.textContent = phaseLabel;
    phaseBanner.classList.remove('hidden');
  } else {
    phaseBanner.classList.add('hidden');
  }

  const postBanner = el('postgame-banner');
  if (map.game_state === 'DOTA_GAMERULES_STATE_POST_GAME') {
    const winner = map.win_team === 'radiant' ? 'Radiant' : map.win_team === 'dire' ? 'Dire' : '—';
    postBanner.textContent = `🏆 بازی تمام شد — برنده: ${winner}`;
    postBanner.classList.remove('hidden');
    postBanner.classList.toggle('radiant-win', map.win_team === 'radiant');
  } else {
    postBanner.classList.add('hidden');
  }

  renderDraft(draft);
  renderEvents(eventsLog);

  el('bounty-time').textContent = fmtClock(runes.bounty_in);
  el('power-time').textContent = fmtClock(runes.power_in);
  setRing(el('bounty-ring-fg'), runes.bounty_in ?? 0, BOUNTY_INTERVAL);
  setRing(el('power-ring-fg'), runes.power_in ?? 0, POWER_INTERVAL);

  const name = prettyName(hero.name, 'npc_dota_hero_');
  el('hero-name').textContent = name || '— هنوز هیرویی انتخاب نشده —';
  el('hero-level').textContent = hero.level ?? 0;

  const heroIcon = el('hero-icon');
  const iconPath = heroIconPath(hero.name);
  if (iconPath) {
    heroIcon.src = iconPath;
    heroIcon.classList.remove('hidden');
    heroIcon.onerror = () => heroIcon.classList.add('hidden');
  } else {
    heroIcon.classList.add('hidden');
  }

  const heroIconBig = el('hero-icon-big');
  if (heroIconBig) {
    if (iconPath) {
      heroIconBig.src = iconPath;
      heroIconBig.style.opacity = 1;
    } else {
      heroIconBig.style.opacity = 0;
    }
  }

  el('agh-scepter-badge').classList.toggle('hidden', hero.aghanims_scepter !== true);
  el('agh-shard-badge').classList.toggle('hidden', hero.aghanims_shard !== true);

  const debuffRow = el('debuff-row');
  debuffRow.innerHTML = '';
  DEBUFF_LABELS.forEach(([key, label]) => {
    if (hero[key] === true) {
      const tag = document.createElement('span');
      tag.className = 'debuff-tag';
      tag.textContent = label;
      debuffRow.appendChild(tag);
    }
  });

  const hp = hero.health ?? 0, hpMax = hero.max_health ?? 0;
  const mp = hero.mana ?? 0, mpMax = hero.max_mana ?? 0;
  el('hp-fill').style.width = hpMax ? `${(hp / hpMax) * 100}%` : '0%';
  el('mp-fill').style.width = mpMax ? `${(mp / mpMax) * 100}%` : '0%';
  el('hp-value').textContent = `${hp} / ${hpMax}`;
  el('mp-value').textContent = `${mp} / ${mpMax}`;

  const respawnBanner = el('respawn-banner');
  if (hero.alive === false && hero.respawn_seconds) {
    respawnBanner.classList.remove('hidden');
    el('respawn-time').textContent = hero.respawn_seconds;
  } else {
    respawnBanner.classList.add('hidden');
  }

  el('gold').textContent = player.gold ?? 0;
  const goldBreakdown = el('gold-breakdown');
  if (typeof player.gold_reliable === 'number' || typeof player.gold_unreliable === 'number') {
    goldBreakdown.textContent = `قابل‌اعتماد ${player.gold_reliable ?? 0} / غیرقابل‌اعتماد ${player.gold_unreliable ?? 0}`;
  } else {
    goldBreakdown.textContent = '';
  }
  el('networth').textContent = player.net_worth ?? 0;
  el('gpm').textContent = player.gpm ?? 0;
  el('xpm').textContent = player.xpm ?? 0;
  el('kda').textContent = `${player.kills ?? 0} / ${player.deaths ?? 0} / ${player.assists ?? 0}`;
  el('lhdn').textContent = `${player.last_hits ?? 0} / ${player.denies ?? 0}`;
  el('buyback').textContent = hero.buyback_cooldown > 0
    ? `${hero.buyback_cooldown}s`
    : (hero.buyback_cost ? `${hero.buyback_cost}g` : '—');
  el('hero-damage').textContent = player.hero_damage ?? 0;
  el('hero-healing').textContent = player.hero_healing ?? 0;
  el('tower-damage').textContent = player.tower_damage ?? 0;

  const itemSlots = ['slot0','slot1','slot2','slot3','slot4','slot5','slot6','slot7','slot8','neutral0'];
  renderItemGrid('items-grid', items, itemSlots);

  const stashSlots = ['stash0','stash1','stash2','stash3','stash4','stash5'];
  renderItemGrid('stash-grid', items, stashSlots);

  const abilityKeys = Object.keys(abilities).filter((k) => k.startsWith('ability'));
  const abilitiesGrid = el('abilities-grid');
  abilitiesGrid.innerHTML = '';
  abilityKeys.forEach((k) => {
    const ab = abilities[k];
    const hasAbility = ab && ab.name && ab.name !== 'empty';
    const div = document.createElement('div');
    div.className = 'slot' + (hasAbility ? ' filled' : '') + (hasAbility && ab.ultimate ? ' ultimate' : '');
    if (hasAbility) {
      div.textContent = prettyName(ab.name, '');
      if (ab.ultimate) {
        const ultBadge = document.createElement('div');
        ultBadge.className = 'ult-badge';
        ultBadge.textContent = 'R';
        div.appendChild(ultBadge);
      }
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

  renderTalents(hero);
  renderBuildings('radiant-buildings', buildings.radiant, 'radiant');
  renderBuildings('dire-buildings', buildings.dire, 'dire');
}

function renderItemGrid(containerId, items, slotKeys) {
  const grid = el(containerId);
  grid.innerHTML = '';
  slotKeys.forEach((slotKey) => {
    const it = items[slotKey];
    const div = document.createElement('div');
    const hasItem = it && it.name && it.name !== 'empty';
    div.className = 'slot' + (hasItem ? ' filled' : '');
    if (hasItem) {
      const iconSrc = itemIconPath(it.name);
      const img = document.createElement('img');
      img.src = iconSrc;
      img.alt = '';
      img.onerror = () => {
        img.remove();
        div.textContent = prettyName(it.name, 'item_');
      };
      div.appendChild(img);
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
      if (it.contains_rune) {
        const rune = document.createElement('div');
        rune.className = 'rune-badge';
        rune.textContent = '🔮';
        div.appendChild(rune);
      }
    }
    grid.appendChild(div);
  });
}

function renderTalents(hero) {
  const tree = el('talent-tree');
  tree.innerHTML = '';
  const tiers = [
    { level: 10, keys: ['talent_1', 'talent_2'] },
    { level: 15, keys: ['talent_3', 'talent_4'] },
    { level: 20, keys: ['talent_5', 'talent_6'] },
    { level: 25, keys: ['talent_7', 'talent_8'] },
  ];
  tiers.forEach((tier) => {
    const row = document.createElement('div');
    row.className = 'talent-tier';

    const label = document.createElement('div');
    label.className = 'tier-label';
    label.textContent = `Lv${tier.level}`;
    row.appendChild(label);

    tier.keys.forEach((key) => {
      const picked = hero[key] === true;
      const box = document.createElement('div');
      box.className = 'talent-choice' + (picked ? ' selected' : '');
      box.textContent = picked ? '✓ انتخاب شد' : '—';
      row.appendChild(box);
    });

    tree.appendChild(row);
  });
}

function renderDraft(draft) {
  const panel = el('draft-panel');
  if (!draft) {
    panel.classList.add('hidden');
    return;
  }

  const teamBlocks = Object.keys(draft)
    .filter((k) => /^team\d+$/.test(k))
    .map((k) => draft[k])
    .filter(Boolean);

  if (teamBlocks.length === 0) {
    panel.classList.add('hidden');
    return;
  }

  const radiantBlock = teamBlocks.find((t) => t.home_team === true) || teamBlocks[0];
  const direBlock = teamBlocks.find((t) => t !== radiantBlock) || teamBlocks[1] || {};

  fillDraftRow('draft-radiant-bans', radiantBlock, 'ban');
  fillDraftRow('draft-radiant-picks', radiantBlock, 'pick');
  fillDraftRow('draft-dire-bans', direBlock, 'ban');
  fillDraftRow('draft-dire-picks', direBlock, 'pick');

  const hasAnything = teamBlocks.some((t) =>
    Object.keys(t).some((k) => /^(pick|ban)\d+_class$/.test(k) && t[k] && t[k] !== 'empty')
  );
  panel.classList.toggle('hidden', !hasAnything);
}

function fillDraftRow(containerId, teamBlock, kind) {
  const row = el(containerId);
  row.innerHTML = '';
  for (let i = 0; i < 10; i++) {
    const heroClass = teamBlock[`${kind}${i}_class`];
    if (heroClass === undefined) continue;
    const slot = document.createElement('div');
    slot.className = 'draft-slot';
    if (heroClass && heroClass !== 'empty') {
      const img = document.createElement('img');
      img.src = heroIconPath(heroClass);
      img.alt = '';
      img.onerror = () => img.remove();
      slot.appendChild(img);
    } else {
      slot.classList.add('empty');
    }
    row.appendChild(slot);
  }
}

function renderEvents(eventsLog) {
  const feed = el('events-feed');
  const empty = el('events-empty');
  if (!eventsLog || eventsLog.length === 0) {
    feed.querySelectorAll('.event-row').forEach((n) => n.remove());
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');
  feed.querySelectorAll('.event-row').forEach((n) => n.remove());
  eventsLog.forEach((ev) => {
    const { text, icon } = eventLabel(ev);
    const row = document.createElement('div');
    row.className = 'event-row' + (ev.team === 2 ? ' radiant' : ev.team === 3 ? ' dire' : '');
    row.innerHTML = `
      <span class="e-time">${fmtClock(ev.game_time)}</span>
      <span class="e-text">${icon} ${text}</span>
    `;
    feed.appendChild(row);
  });
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
  const ws = new WebSocket(`${proto}://${location.host}/ws/${USER_KEY}`);

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

fetch(`/state/${USER_KEY}`).then((r) => r.json()).then(render).catch(() => {});
connect();

(function setupGsiCopyButton() {
  const btn = el('gsi-copy-btn');
  const label = el('gsi-copy-label');
  if (!btn) return;
  const code = el('gsi-code').textContent.trim();

  btn.addEventListener('click', async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(code);
      } else {
        const ta = document.createElement('textarea');
        ta.value = code;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      btn.classList.add('copied');
      label.textContent = 'کپی شد ✅';
    } catch (e) {
      label.textContent = 'خطا در کپی';
    }
    setTimeout(() => {
      btn.classList.remove('copied');
      label.textContent = 'کپی دستور';
    }, 1800);
  });
})();
