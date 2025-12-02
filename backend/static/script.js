// backend/static/script.js

document.addEventListener("DOMContentLoaded", () => {
  const API_BASE = `${window.location.origin}/api`;
  let currentGenre = "fantasy";
  let currentSize = "small";
  let lastSeed = null;
  let lastMapData = null;
  let lastQuestData = null;
  let lastAssetData = null;
  let localQuestState = null;
  let questPlayTimer = null;
  let currentQuestIndex = 0;
  let questVariationCounter = 0;
  let soundOn = false;
  let autoGenerate = true;

  // DOM refs -------------------------------------------------------
  const mapGrid = document.getElementById("map-grid");
  const mapLegend = document.getElementById("map-legend");
  const tileInspectorPill = document.getElementById("tile-inspector-pill");

  const questHeader = document.getElementById("quest-header");
  const questTimeline = document.getElementById("quest-timeline");
  const questPlayStatus = document.getElementById('quest-play-status');
  const savedSeedsEl = document.getElementById("saved-seeds");
  const exampleSeedsEl = document.getElementById("example-seeds");
  const latencyChip = document.getElementById("api-latency");
  const seedInput = document.getElementById("seed-input");
  const seedChip = document.getElementById("seed-chip");
  const mapPalette = document.getElementById("map-palette");

  const assetGlyph = document.getElementById("asset-glyph");
  const assetElementGlow = document.getElementById("asset-element-glow");
  const assetGlyphLabel = document.getElementById("asset-glyph-label");
  const tierTrack = document.getElementById("asset-tier-track");
  const assetStatusLine = document.getElementById("asset-status");
  const assetContainer = document.getElementById("asset-container");
  // quest controls
  const exportQuestBtn = document.getElementById('export-quest');
  const regenQuestBtn = document.getElementById('regen-quest');
  const playQuestBtn = document.getElementById('play-quest');
  const pauseQuestBtn = document.getElementById('pause-quest');
  const addStepBtn = document.getElementById('add-step');

  // helpers --------------------------------------------------------
  async function timedFetch(url, options) {
    const start = performance.now();
    const res = await fetch(url, options);
    const end = performance.now();
    latencyChip.textContent = `${Math.round(end - start)} ms`;
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status}${text ? " - " + text : ""}`);
    }
    return res.json();
  }

  function postJson(path, body) {
    return timedFetch(API_BASE + path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {}),
    });
  }

  function setThemeOnBody() {
    document.body.classList.remove(
      "theme-fantasy",
      "theme-sci-fi",
      "theme-post-apocalyptic",
      "theme-cyberpunk"
    );
    const cls =
      currentGenre === "sci-fi"
        ? "theme-sci-fi"
        : currentGenre === "post-apocalyptic"
        ? "theme-post-apocalyptic"
        : currentGenre === "cyberpunk"
        ? "theme-cyberpunk"
        : "theme-fantasy";
    document.body.classList.add(cls);
  }

  function playClick() {
    if (!soundOn) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        ctx.currentTime + 0.09
      );
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.09);
    } catch (_) {
      // ignore
    }
  }

  // MAP RENDER -----------------------------------------------------

  async function generateMap(seed = null) {
    try {
      const btn = document.getElementById("generate-map");
      if (btn) {
        btn.disabled = true;
        var _old = btn.textContent;
        btn.textContent = "Generating...";
      }
      setThemeOnBody();
      const body = { theme: currentGenre, size: currentSize };
      if (seed !== undefined && seed !== null) body.seed = seed;
      const data = await postJson("/generate-map", body);
      lastSeed = data.seed || lastSeed;
      setSeedChip(lastSeed);
      lastMapData = data;
      renderMap(data);
      if (btn) {
        btn.disabled = false;
        btn.textContent = _old;
      }
    } catch (err) {
      console.error(err);
      mapGrid.innerHTML = `<div style="color:#ff9dbb;padding:8px;font-size:12px">Map error: ${err.message}</div>`;
      if (btn) {
        btn.disabled = false;
        btn.textContent = _old;
      }
    }
  }

  function renderMap(data) {
    const cells = data.map || [];
    const cols = data.grid_columns || Math.sqrt(cells.length) || 10;

    mapGrid.innerHTML = "";
    mapGrid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;

    const legendSeen = {};
    const paletteSeen = {};

    cells.forEach((cell, index) => {
      const name = cell.name || "Unknown";
      const symbol = cell.symbol || name.charAt(0) || "?";

      const tile = document.createElement("div");
      tile.className = "map-tile";
      if (cell.class) tile.classList.add(cell.class);
      const span = document.createElement("span");
      span.textContent = symbol.toUpperCase();
      tile.appendChild(span);

      // staggered animation delay
      tile.style.animationDelay = `${index * 0.01}s`;

      tile.addEventListener("click", () => {
        mapGrid
          .querySelectorAll(".map-tile--selected")
          .forEach((t) => t.classList.remove("map-tile--selected"));
        tile.classList.add("map-tile--selected");
        const coords = { row: Math.floor(index / cols), col: index % cols };
        tileInspectorPill.textContent = `${name} · ${coords.row},${coords.col} · Difficulty: ${cell.difficulty || "—"} · Resources: ${(cell.resources || []).join(", ") || "—"}`;
        const flavorEl = document.getElementById('tile-flavor');
        if (flavorEl) { flavorEl.textContent = (cell.flavor || ''); }
        playClick();
      });

        // hover preview
        tile.title = name;
        tile.addEventListener("mouseenter", () => {
          tileInspectorPill.textContent = `${name} · Difficulty: ${
            cell.difficulty || "—"
          }`;
        });
        tile.addEventListener("mouseleave", () => {
          const sel = mapGrid.querySelector('.map-tile--selected');
          if (!sel) tileInspectorPill.textContent = "Click a tile on the hologram table.";
        });

        mapGrid.appendChild(tile);
      legendSeen[name] = true;
      paletteSeen[cell.class || name] = cell.name;
    });

    // legend
    mapLegend.innerHTML = "";
    Object.keys(legendSeen).forEach((name) => {
      const li = document.createElement("div");
      li.className = "legend-item";
      const swatch = document.createElement("div");
      swatch.className = "legend-color";
      swatch.style.background =
        currentGenre === "sci-fi"
          ? "linear-gradient(135deg,#00ff9d,#00b4ff)"
          : currentGenre === "post-apocalyptic"
          ? "linear-gradient(135deg,#ffb347,#ff6a00)"
          : currentGenre === "cyberpunk"
          ? "linear-gradient(135deg,#ff2ea6,#00e6ff)"
          : "linear-gradient(135deg,#7dd3ff,#c4b5fd)";
      const label = document.createElement("span");
      label.textContent = name;
      li.appendChild(swatch);
      li.appendChild(label);
      li.addEventListener("click", () => {
        // dim others
        const tiles = mapGrid.querySelectorAll(".map-tile");
        tiles.forEach((t) => t.classList.add("dim"));
        li.classList.toggle("active");
        if (!li.classList.contains("active")) {
          tiles.forEach((t) => t.classList.remove("dim"));
          return;
        }
      });
      mapLegend.appendChild(li);
    });

    // helper: choose palette color for a tile class/key
    function paletteColorFor(key, genre) {
      const base = (genre === 'sci-fi') ? ['#00ff9d','#00b4ff']
        : (genre === 'post-apocalyptic') ? ['#ffb347','#ff6a00']
        : (genre === 'cyberpunk') ? ['#ff2ea6','#00e6ff']
        : ['#7dd3ff','#c4b5fd'];
      // small deterministic mapping by key string
      const h = Array.from(key).reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
      const c1 = base[h % base.length];
      const c2 = base[(h + 1) % base.length];
      return `linear-gradient(135deg,${c1},${c2})`;
    }

    // map palette pills (ordered by paletteSeen)
    mapPalette.innerHTML = "";
    Object.keys(paletteSeen).forEach((cls) => {
      const label = paletteSeen[cls] || cls;
      const pill = document.createElement('div');
      pill.className = 'legend-item map-palette-item';
      const sw = document.createElement('div');
      sw.className = 'legend-color';
      // color by class name / name → fallback to theme accent
      sw.style.background = paletteColorFor(cls, currentGenre);
      const text = document.createElement('span');
      text.textContent = label;
      pill.appendChild(sw);
      pill.appendChild(text);
      pill.addEventListener('click', () => {
        // toggle active for this pill and recompute dims for all tiles
        pill.classList.toggle('active');
        const activeClasses = Array.from(mapPalette.querySelectorAll('.map-palette-item.active')).map(p => p.dataset.classKey);
        const tiles = mapGrid.querySelectorAll('.map-tile');
        tiles.forEach((t) => {
          if (!activeClasses.length) { t.classList.remove('dim'); return; }
          const matches = activeClasses.some((ac) => t.classList.contains(ac));
          t.classList.toggle('dim', !matches);
        });
      });
      pill.dataset.classKey = cls;
      mapPalette.appendChild(pill);
    });
  }

  // QUEST RENDER ---------------------------------------------------

  async function generateQuest(seed = null) {
    try {
      const btn = document.getElementById("generate-quest");
      if (btn) {
        btn.disabled = true;
        var _oldq = btn.textContent;
        btn.textContent = "Generating...";
      }
      const body = { theme: currentGenre, size: currentSize };
      if (seed !== undefined && seed !== null) body.seed = seed;
      const q = await postJson("/generate-quest", body);
      lastSeed = q.seed || lastSeed;
      setSeedChip(lastSeed);
      lastQuestData = q;
      renderQuest(q);
      if (btn) {
        btn.disabled = false;
        btn.textContent = _oldq;
      }
    } catch (err) {
      console.error(err);
      questTimeline.innerHTML = `<div style="color:#ff9dbb;font-size:12px;padding:6px">Quest error: ${err.message}</div>`;
      if (btn) {
        btn.disabled = false;
        btn.textContent = _oldq;
      }
    }
  }

  function renderQuest(q) {
    questHeader.innerHTML = "";
    questTimeline.innerHTML = "";
    // clone into local state to allow client-side edits without overwriting server data
    localQuestState = JSON.parse(JSON.stringify(q || {}));
    currentQuestIndex = 0;

    const title = document.createElement("div");
    title.className = "quest-header-title";
    title.textContent = q.title || "Generated Quest";

    const meta = document.createElement("div");
    meta.className = "quest-header-meta";
    meta.textContent = `Location: ${q.location || "—"} · Difficulty: ${
      q.difficulty || "—"
    }`;

    questHeader.appendChild(title);
    questHeader.appendChild(meta);
    // computed AI description fallback
    if (!localQuestState.description_ai) localQuestState.description_ai = generateQuestDescription(localQuestState);
    const aiEl = document.createElement('div'); aiEl.className='quest-description-ai'; aiEl.textContent = localQuestState.description_ai; questHeader.appendChild(aiEl);

    const emojis = ["🚶", "🧭", "⚔️", "🧩", "🏁", "✨"];

    const steps = (localQuestState.steps || localQuestState.raw_steps || []).slice();
    steps.forEach((step, idx) => {
      const card = document.createElement("div");
      card.className = "quest-card";
      card.dataset.index = idx;

      const titleRow = document.createElement("div");
      titleRow.className = "quest-step-title";
      const em = document.createElement("span");
      em.className = "quest-step-emoji";
      const icon = (step && step.icon) || emojis[idx] || "⭐";
      const label = (step && (step.label || step)) || String(step);
      em.textContent = icon;
      titleRow.appendChild(em);
      titleRow.append(`Step ${idx + 1}`);

      const body = document.createElement("div");
      body.className = "quest-step-body";
      body.textContent = label;
      // enriched description
      const rich = document.createElement('div');
      rich.className = 'quest-step-meta';
      rich.textContent = enrichStepDescription(label, idx, localQuestState.theme || currentGenre, localQuestState.seed || lastSeed);
      card.appendChild(rich);

      card.appendChild(titleRow);
      card.appendChild(body);

      const total = steps.length - 1;
      if (idx === total && localQuestState.description_ai) {
        const extra = document.createElement("div");
        extra.className = "quest-step-meta";
        extra.textContent = localQuestState.description_ai;
        card.appendChild(extra);
      }

      // add step actions
      const actions = document.createElement('div');
      actions.className = 'quest-step-actions';
      const up = document.createElement('button'); up.className = 'btn ghost'; up.textContent = '▲';
      const down = document.createElement('button'); down.className = 'btn ghost'; down.textContent = '▼';
      const edit = document.createElement('button'); edit.className = 'btn ghost'; edit.textContent = 'Edit';
      const del = document.createElement('button'); del.className = 'btn ghost'; del.textContent = 'Delete';
      const toggle = document.createElement('button'); toggle.className = 'btn ghost'; toggle.textContent = '✔';
      actions.appendChild(up); actions.appendChild(down); actions.appendChild(edit); actions.appendChild(del); actions.appendChild(toggle);
      card.appendChild(actions);

      // listeners
      up.addEventListener('click', () => moveStep(idx, -1));
      down.addEventListener('click', () => moveStep(idx, 1));
      edit.addEventListener('click', () => editStep(idx));
      del.addEventListener('click', () => deleteStep(idx));
      toggle.addEventListener('click', () => toggleStepComplete(idx));

      questTimeline.appendChild(card);
    });
    // populate progress dots
    const progress = document.getElementById('quest-progress');
    if (progress) {
      progress.innerHTML = '';
      const stepsForDots = localQuestState.steps || localQuestState.raw_steps || [];
      stepsForDots.forEach((s, i) => {
        const dot = document.createElement('div'); dot.className = 'dot';
        if (s && s.done) dot.classList.add('active');
        if (i === currentQuestIndex) dot.classList.add('playing');
        progress.appendChild(dot);
      });
    }
    refreshQuestUI();
  }

  function refreshQuestUI() {
    if (!localQuestState) return;
    const steps = localQuestState.steps || localQuestState.raw_steps || [];
    // update dataset stepIndex and classes
    questTimeline.querySelectorAll('.quest-card').forEach((card, i) => {
      const idx = Number(card.dataset.index);
      const s = steps[idx];
      const done = !!(s && s.done);
      card.classList.toggle('completed', done);
      card.classList.toggle('playing', idx === currentQuestIndex);
      // update body text if changed
      const body = card.querySelector('.quest-step-body');
      const label = (s && (s.label || s)) || '';
      if (body && body.textContent !== label) body.textContent = label;
    });
    const doneCount = steps.filter(s => s && s.done).length || 0;
    if (questPlayStatus) questPlayStatus.textContent = `${doneCount}/${steps.length} completed`;
    // update progress dots
    const progress = document.getElementById('quest-progress');
    if (progress) {
      const dots = Array.from(progress.children);
      dots.forEach((d, i) => {
        d.classList.toggle('active', !!(steps[i] && steps[i].done));
        d.classList.toggle('playing', i === currentQuestIndex);
      });
    }
  }

  function generateQuestDescription(q) {
    const title = q.title || 'Quest';
    const location = q.location || currentGenre;
    const difficulty = q.difficulty || 'Medium';
    const steps = (q.steps || q.raw_steps || []).map(s => (s && (s.label || s)) || s).slice();
    const seedNum = normalizeSeed(q.seed || lastSeed) || 0;
    const r = mulberry32(seedNum + 12345);
    const plot = ['An urgent matter', 'A hidden secret', 'A desperate plea', 'An unexpected twist'][Math.floor(r()*4)];
    return `${title} at ${location}. ${plot} leads our heroes through ${steps.length} beats (${steps.join('; ')}). Difficulty: ${difficulty}.`;
  }

  // deterministic JS RNG — lightweight mulberry32
  function mulberry32(seed) {
    return function() {
      let t = seed += 0x6D2B79F5;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
  }

  function enrichStepDescription(stepLabel, idx, theme, seed) {
    const nseed = (typeof seed === 'number') ? seed : normalizeSeed(seed) || 0;
    const r = mulberry32(nseed + idx * 7919);
    const characters = {
      fantasy: ['Eldon the Wise', 'Mira the Scout', 'Thatch the Brewer', 'Rynn the Ranger'],
      'sci-fi': ['Ava-9', 'Captain Juno', 'Dr. Valis', 'X-Carrier'],
      'post-apocalyptic': ['Gravekeeper', 'Lola', 'Scav Ted', 'Commander Rue'],
      cyberpunk: ['Chrome', 'Nika', 'Vektor', 'Nul-3']
    };
    const objectives = ['Recover', 'Escort', 'Rescue', 'Sabotage', 'Scan', 'Investigate'];
    const acts = ['from a hidden cache', 'through the ruins', 'without being detected', 'before nightfall', 'at the beacon', 'while avoiding patrols'];
    const charList = characters[theme] || characters['fantasy'];
    const actor = charList[Math.floor(r()*charList.length)];
    const objective = objectives[Math.floor(r()*objectives.length)];
    const act = acts[Math.floor(r()*acts.length)];
    return `${stepLabel} — ${objective} ${act} (contact: ${actor}).`;
  }

  function moveStep(idx, delta) {
    const steps = localQuestState.steps || localQuestState.raw_steps || [];
    if (idx + delta < 0 || idx + delta >= steps.length) return;
    const [item] = steps.splice(idx, 1);
    steps.splice(idx + delta, 0, item);
    localQuestState.steps = steps;
    renderQuest(localQuestState);
  }

  function editStep(idx) {
    const steps = localQuestState.steps || localQuestState.raw_steps || [];
    const s = steps[idx];
    const prevLabel = s && (s.label || s) || '';
    const newVal = prompt('Edit step', prevLabel);
    if (newVal === null) return;
    // allow icon change
    const newIcon = prompt('Edit icon (emoji)', (s && s.icon) || '');
    if (typeof s === 'string') steps[idx] = newVal;
    else {
      steps[idx].label = newVal;
      if (newIcon !== null) steps[idx].icon = newIcon;
    }
    localQuestState.steps = steps;
    renderQuest(localQuestState);
  }

  function deleteStep(idx) {
    if (!confirm('Delete step?')) return;
    const steps = localQuestState.steps || localQuestState.raw_steps || [];
    steps.splice(idx, 1);
    localQuestState.steps = steps;
    renderQuest(localQuestState);
  }

  function toggleStepComplete(idx) {
    const steps = localQuestState.steps || localQuestState.raw_steps || [];
    if (!steps[idx]) return;
    if (typeof steps[idx] === 'string') steps[idx] = { label: steps[idx], done: true };
    else steps[idx].done = !steps[idx].done;
    localQuestState.steps = steps;
    refreshQuestUI();
  }

  function addStep() {
    const label = prompt('New step text', 'New objective');
    if (!label) return;
    const steps = localQuestState.steps || localQuestState.raw_steps || [];
    steps.push({ label: label, icon: '✨' });
    localQuestState.steps = steps;
    renderQuest(localQuestState);
  }

  function exportQuestJson() {
    if (!localQuestState) return;
    const payload = Object.assign({}, localQuestState, { exported_at: new Date().toISOString() });
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    const url = URL.createObjectURL(blob);
    a.href = url; a.download = `pixelsaga-quest-${lastSeed || 'seed'}.json`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    showToast('Quest exported');
  }

  function playQuest() {
    if (!localQuestState) return;
    const steps = localQuestState.steps || localQuestState.raw_steps || [];
    if (!steps.length) return;
    if (questPlayTimer) return; // already playing
    questPlayStatus.textContent = 'Playing...';
    // start from the first incomplete step
    if (currentQuestIndex >= steps.length || (steps[currentQuestIndex] && steps[currentQuestIndex].done)) {
      currentQuestIndex = steps.findIndex(s => !(s && s.done));
      if (currentQuestIndex === -1) currentQuestIndex = 0;
    }
    questPlayTimer = setInterval(() => {
      const steps = localQuestState.steps || localQuestState.raw_steps || [];
      if (currentQuestIndex >= steps.length) { pauseQuest(); return; }
      // mark current as done
      if (typeof steps[currentQuestIndex] === 'string') steps[currentQuestIndex] = { label: steps[currentQuestIndex], done: true };
      else steps[currentQuestIndex].done = true;
      localQuestState.steps = steps;
      refreshQuestUI();
      currentQuestIndex++;
    }, 1600);
  }

  function pauseQuest() {
    if (questPlayTimer) clearInterval(questPlayTimer);
    questPlayTimer = null;
    if (questPlayStatus) questPlayStatus.textContent = 'Paused';
  }

  // ASSET RENDER ---------------------------------------------------

  async function generateAsset(seed = null) {
    try {
      const btn = document.getElementById("generate-asset");
      if (btn) {
        btn.disabled = true;
        var _olda = btn.textContent;
        btn.textContent = "Generating...";
      }
      const body = {
        theme: currentGenre,
        size: currentSize,
        asset_type: document.getElementById("asset-type").value,
        material: document.getElementById("asset-material").value,
        enhancement: document.getElementById("asset-enhancement").value,
        rarity: document.getElementById("asset-rarity").value,
        power: Number(document.getElementById("asset-power").value),
        value_mod: Number(document.getElementById("asset-value").value),
      };
      if (seed !== undefined && seed !== null) body.seed = seed;
      const a = await postJson("/generate-asset", body);
      lastSeed = a.seed || lastSeed;
      setSeedChip(lastSeed);
      lastAssetData = a;
      renderAsset(a);
      if (btn) {
        btn.disabled = false;
        btn.textContent = _olda;
      }
    } catch (err) {
      console.error(err);
      assetContainer.innerHTML = `<div style="color:#ff9dbb;font-size:12px">Asset error: ${err.message}</div>`;
      if (btn) {
        btn.disabled = false;
        btn.textContent = _olda;
      }
    }
  }

  function setSeedChip(seed) {
    seedChip.textContent = seed || "—";
  }

  function renderAsset(a) {
    // some backends return the asset as `a.asset` (new format) — support both
    const src = a.asset || a;
    const type = (src.type || a.type || "weapon").toLowerCase();
    const rarity = (src.rarity || a.rarity || "common").toLowerCase();
    const enhancement = (src.enhancement || a.enhancement || "none").toLowerCase();
    const power = Number(src.power || a.power || 5);
    const value = Number(src.value || a.value || src.value_score || 1);

    // glyph classes
    assetGlyph.className = `asset-glyph asset-type-${type} asset-rarity-${rarity}`;
    assetElementGlow.className = `asset-element-glow ${
      enhancement !== "none" ? `asset-element-${enhancement}` : ""
    }`;

    // label
    const labelType = type.charAt(0).toUpperCase() + type.slice(1);
    const labelRarity = rarity.toUpperCase();
    assetGlyphLabel.textContent = `${labelRarity} ${labelType}`;

    // tier dots (power 1-10)
    const dots = tierTrack.querySelectorAll(".tier-dot");
    dots.forEach((dot, idx) => {
      if (idx < power) dot.classList.add("active");
      else dot.classList.remove("active");
    });

    // status line — show both power and value for clarity
    assetStatusLine.textContent = `Seed ${
      a.seed || lastSeed || "—"
    } · ${labelRarity} ${labelType} · Power ${power} · Value ${value}`;

    // ensure sliders reflect the generated values
    try {
      powerSlider.value = power;
      powerValueSpan.textContent = power;
      valueSlider.value = value;
      valueValueSpan.textContent = value;
    } catch (_) {}

    // text description
    assetContainer.innerHTML = `
      <div style="font-weight:700;margin-bottom:4px">${src.name || ""}</div>
      <div>Type: ${src.type || ""}</div>
      <div>Material: ${src.material || ""}</div>
      <div>Enhancement: ${src.enhancement || "None"}</div>
      <div>Rarity: ${src.rarity || ""}</div>
      <div>Bonus: ${src.bonus || ""}</div>
      <div>Value: ${src.value || ""}</div>
      <div style="margin-top:6px">${src.flavor || ""}</div>
    `;
  }

  // MATERIAL OPTIONS BY GENRE --------------------------------------

  function updateMaterialOptions() {
    const materials = {
      fantasy: ["iron", "steel", "mythril", "obsidian", "crystal"],
      "sci-fi": ["titanium", "carbon fiber", "plasteel", "neutronium"],
      "post-apocalyptic": ["scrap metal", "salvaged parts", "reclaimed wood"],
      cyberpunk: ["carbon nanotube", "memory alloy", "chrome", "optical fiber"],
    };
    const select = document.getElementById("asset-material");
    select.innerHTML = "";
    (materials[currentGenre] || materials.fantasy).forEach((m) => {
      const o = document.createElement("option");
      o.value = m;
      o.textContent = m
        .split(" ")
        .map((x) => x.charAt(0).toUpperCase() + x.slice(1))
        .join(" ");
      select.appendChild(o);
    });
  }

  // SAVE / LOAD SEEDS -------------------------------------------------

  const SAVED_KEY = "pixelsaga:savedSeeds";

  function saveSeedToStorage(seed, title) {
    if (!seed) return;
    const existing = JSON.parse(localStorage.getItem(SAVED_KEY) || "[]");
    const entry = { seed: String(seed), title: title || `Seed ${seed}`, created: Date.now(), theme: currentGenre, size: currentSize };
    existing.unshift(entry);
    localStorage.setItem(SAVED_KEY, JSON.stringify(existing.slice(0, 30)));
    renderSavedSeeds();
    showToast(`Seed saved: ${seed}`);
  }

  function loadSavedSeeds() {
    return JSON.parse(localStorage.getItem(SAVED_KEY) || "[]");
  }

  function renderSavedSeeds() {
    const list = loadSavedSeeds();
    savedSeedsEl.innerHTML = "";
    if (!list.length) {
      savedSeedsEl.innerHTML = `<div class='seed-empty'>No saved seeds yet.</div>`;
      return;
    }
    list.forEach((e) => {
      const card = document.createElement("div");
      card.className = "seed-card";
      card.innerHTML = `
        <div class="seed-card-main">
          <span class="seed-title">${e.title}</span>
          <span class="seed-seed">${e.seed}</span>
          <div class="saved-meta">${e.theme || ''} · ${e.size || ''}</div>
        </div>
      `;
      const actions = document.createElement("div");
      actions.className = "seed-actions";
      const play = document.createElement("button");
      play.className = "btn ghost";
      play.textContent = "Play";
      play.addEventListener("click", () => applySeed(e.seed));
      const copy = document.createElement("button");
      copy.className = "btn ghost";
      copy.textContent = "Copy";
      copy.addEventListener("click", async () => {
        await navigator.clipboard.writeText(e.seed);
        showToast('Copied seed');
      });
      const del = document.createElement("button");
      del.className = "btn ghost";
      del.textContent = "Delete";
      del.addEventListener("click", () => {
        if (!confirm(`Delete saved seed ${e.seed}?`)) return;
        const filtered = loadSavedSeeds().filter((s) => s.seed !== e.seed);
        localStorage.setItem(SAVED_KEY, JSON.stringify(filtered));
        renderSavedSeeds();
        showToast('Deleted');
      });
      actions.appendChild(play);
      actions.appendChild(copy);
      actions.appendChild(del);
      card.appendChild(actions);
      savedSeedsEl.appendChild(card);
    });
  }

  // EXPORT JSON / PDF -------------------------------------------------

  function exportProjectJson() {
    const payload = {
      seed: lastSeed,
      theme: currentGenre,
      size: currentSize,
      map: lastMapData,
      quest: lastQuestData,
      asset: lastAssetData,
      exported_at: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    const url = URL.createObjectURL(blob);
    a.href = url;
    a.download = `pixelsaga-${lastSeed || "seed"}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function exportProjectPDF() {
    try {
      const container = document.querySelector(".map-3d-container");
      const canvas = await html2canvas(container, { scale: 2 });
      const imgData = canvas.toDataURL("image/png");
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const imgProps = doc.getImageProperties(imgData);
      const imgWidth = pageWidth - 40;
      const imgHeight = (imgProps.height * imgWidth) / imgProps.width;
      doc.addImage(imgData, "PNG", 20, 20, imgWidth, imgHeight);
      doc.save(`pixelsaga-${lastSeed || "seed"}.pdf`);
    } catch (err) {
      console.error("PDF export failed", err);
    }
  }

  async function downloadMapImage() {
    try {
      const container = document.querySelector('.map-3d-container');
      const canvas = await html2canvas(container, { scale: 2 });
      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `pixelsaga-${lastSeed || 'seed'}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      showToast('Map image exported');
    } catch (err) {
      console.error('Download map image failed', err);
      showToast('Map export failed');
    }
  }

  function normalizeSeed(seed) {
    if (!seed && seed !== 0) return null;
    const s = String(seed).trim();
    if (!s) return null;
    if (/^\d+$/.test(s)) return Number(s);
    // fallback: simple deterministic hash -> number
    let n = 0;
    for (let i = 0; i < s.length; i++) {
      n = (n * 1315423911 + s.charCodeAt(i)) % 1000000000;
    }
    return Math.abs(n) || 0;
  }
  // small toast to show feedback for non-blocking actions
  function showToast(msg, ms = 2000) {
    const el = document.createElement('div');
    el.className = 'ps-toast';
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => { el.style.opacity = 0; }, ms - 400);
    setTimeout(() => { el.remove(); }, ms);
  }

  // EXAMPLE SEEDS --------------------------------------------------

  function renderExampleSeeds() {
    const examples = [
      { seed: "12345", title: "Coastal Hamlet" },
      { seed: "8675309", title: "Radioactive Wasteland" },
      { seed: "42", title: "Ancient Dungeon" },
      { seed: "20251118", title: "Royal Road" },
    ];
    exampleSeedsEl.innerHTML = "";
    examples.forEach((e) => {
      const card = document.createElement("div");
      card.className = "seed-card";
      card.innerHTML = `
        <div class="seed-card-main">
          <span class="seed-title">${e.title}</span>
          <span class="seed-seed">${e.seed}</span>
        </div>
      `;
      const actions = document.createElement("div");
      actions.className = "seed-actions";
      const btn = document.createElement("button");
      btn.className = "btn ghost";
      btn.textContent = "Play";
      btn.addEventListener("click", () => applySeed(e.seed));
      const save = document.createElement("button");
      save.className = "btn ghost";
      save.textContent = "Save";
      save.addEventListener("click", () => { saveSeedToStorage(e.seed, e.title); showToast(`Saved ${e.title}`); });
      const copy = document.createElement("button");
      copy.className = "btn ghost";
      copy.textContent = "Copy";
      copy.addEventListener("click", async () => {
        await navigator.clipboard.writeText(e.seed);
        showToast('Copied seed');
      });
      actions.appendChild(btn);
      actions.appendChild(save);
      actions.appendChild(copy);
      card.appendChild(actions);
      exampleSeedsEl.appendChild(card);
    });
  }

  async function applySeed(seed) {
    lastSeed = seed;
    const n = normalizeSeed(seed);
    await generateMap(n);
    await generateQuest(n);
    await generateAsset(n);
  }

  // EVENTS ---------------------------------------------------------

  // genre pills
  document.querySelectorAll("#genre-pills .pill").forEach((pill) => {
    pill.addEventListener("click", () => {
      document
        .querySelectorAll("#genre-pills .pill")
        .forEach((p) => p.classList.remove("active"));
      pill.classList.add("active");
      currentGenre = pill.dataset.genre;
      updateMaterialOptions();
      if (autoGenerate) {
        generateMap();
        generateQuest();
        generateAsset();
      }
    });
  });

  // size pills
  document.querySelectorAll("#size-pills .pill").forEach((pill) => {
    pill.addEventListener("click", () => {
      document
        .querySelectorAll("#size-pills .pill")
        .forEach((p) => p.classList.remove("active"));
      pill.classList.add("active");
      currentSize = pill.dataset.size;
      if (autoGenerate) {
        generateMap();
        generateQuest();
        generateAsset();
      }
    });
  });

  document
    .getElementById("generate-map")
    .addEventListener("click", () => generateMap());

  document
    .getElementById("generate-quest")
    .addEventListener("click", () => generateQuest());

  document
    .getElementById("generate-asset")
    .addEventListener("click", () => generateAsset());

  document
    .getElementById("apply-customization")
    .addEventListener("click", () => generateAsset());

  // top seed controls
  document.getElementById("save-seed").addEventListener("click", () => {
    saveSeedToStorage(lastSeed, `Seed ${lastSeed}`);
  });
  document.getElementById("download-json").addEventListener("click", () => {
    exportProjectJson();
    showToast('JSON exported');
  });
  document.getElementById("export-pdf").addEventListener("click", () => {
    exportProjectPDF();
    showToast('PDF export started');
  });
  document.getElementById('export-map-image').addEventListener('click', () => {
    downloadMapImage();
  });
  document.getElementById('copy-seed-link').addEventListener('click', async () => {
    if (!lastSeed) return showToast('No seed to share');
    const url = `${window.location.origin}${window.location.pathname}?seed=${encodeURIComponent(String(lastSeed))}&theme=${encodeURIComponent(currentGenre)}&size=${encodeURIComponent(currentSize)}`;
    try { await navigator.clipboard.writeText(url); showToast('Link copied'); } catch (_) { showToast('Copy failed'); }
  });
  // quest UI control listeners
  if (exportQuestBtn) exportQuestBtn.addEventListener('click', () => exportQuestJson());
  if (regenQuestBtn) regenQuestBtn.addEventListener('click', async () => {
    const base = normalizeSeed(lastSeed) || 0; questVariationCounter++; const newSeed = base + questVariationCounter; await generateQuest(newSeed);
  });
  if (playQuestBtn) playQuestBtn.addEventListener('click', () => playQuest());
  if (pauseQuestBtn) pauseQuestBtn.addEventListener('click', () => pauseQuest());
  if (addStepBtn) addStepBtn.addEventListener('click', () => addStep());
  document.getElementById('toggle-labels').addEventListener('click', () => {
    mapGrid.classList.toggle('hide-labels');
  });
  document.getElementById('auto-gen-toggle').addEventListener('click', (e) => {
    autoGenerate = !autoGenerate;
    const el = document.getElementById('auto-gen-toggle');
    el.querySelector('.chip-value').textContent = autoGenerate ? 'On' : 'Off';
    showToast(`Auto-generate ${autoGenerate ? 'enabled' : 'disabled'}`);
  });
  document.getElementById("apply-seed").addEventListener("click", async () => {
    const seedVal = seedInput.value.trim();
    if (!seedVal) return await applySeed(null);
    await applySeed(seedVal);
  });
  seedInput.addEventListener('keyup', async (e) => {
    if (e.key === 'Enter') {
      const seedVal = seedInput.value.trim();
      if (!seedVal) return await applySeed(null);
      await applySeed(seedVal);
    }
  });
  document.getElementById("copy-seed").addEventListener("click", async () => {
    if (!lastSeed) return;
    try { await navigator.clipboard.writeText(String(lastSeed)); } catch (_) {}
    showToast('Seed copied');
  });

  // sliders live label
  const powerSlider = document.getElementById("asset-power");
  const valueSlider = document.getElementById("asset-value");
  const powerValueSpan = document.getElementById("power-value");
  const valueValueSpan = document.getElementById("value-value");

  powerSlider.addEventListener("input", () => {
    powerValueSpan.textContent = powerSlider.value;
  });
  valueSlider.addEventListener("input", () => {
    valueValueSpan.textContent = valueSlider.value;
  });

  // sound toggle
  document.getElementById("sound-toggle").addEventListener("click", () => {
    soundOn = !soundOn;
    document.getElementById("sound-state").textContent = soundOn
      ? "On"
      : "Off";
  });

  // cursor glow
  const cursorGlow = document.getElementById("cursor-glow");
  document.addEventListener("mousemove", (e) => {
    cursorGlow.style.left = e.clientX + "px";
    cursorGlow.style.top = e.clientY + "px";
  });

  // 3D map drag rotation
  const mapContainer = document.querySelector('.map-3d-container');
  let dragging = false;
  let startX = 0, startY = 0;
  let rotX = 32, rotY = 0;
  function updateGridTransform() {
    mapGrid.style.transform = `perspective(1400px) rotateX(${rotX}deg) rotateY(${rotY}deg)`;
  }
  updateGridTransform();
  mapContainer.addEventListener('mousedown', (e) => { dragging = true; startX = e.clientX; startY = e.clientY; mapContainer.classList.add('dragging'); });
  window.addEventListener('mouseup', () => { dragging = false; mapContainer.classList.remove('dragging'); });
  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    rotY = Math.max(Math.min(rotY + dx * 0.12, 45), -45);
    rotX = Math.max(Math.min(rotX - dy * 0.12, 60), -10);
    startX = e.clientX; startY = e.clientY;
    updateGridTransform();
  });
  // Touch support
  mapContainer.addEventListener('touchstart', (e) => { const t = e.touches[0]; dragging = true; startX = t.clientX; startY = t.clientY; });
  window.addEventListener('touchend', () => { dragging = false; });
  window.addEventListener('touchmove', (e) => { if (!dragging) return; const t = e.touches[0]; const dx = t.clientX - startX; const dy = t.clientY - startY; rotY = Math.max(Math.min(rotY + dx * 0.12, 45), -45); rotX = Math.max(Math.min(rotX - dy * 0.12, 60), -10); startX = t.clientX; startY = t.clientY; updateGridTransform(); });

  // INIT -----------------------------------------------------------

  updateMaterialOptions();
  renderExampleSeeds();
  renderSavedSeeds();

  // first render
  (async () => {
    // check URL params for seed/theme/size
    const params = new URLSearchParams(window.location.search);
    const seedParam = params.get('seed');
    const themeParam = params.get('theme');
    const sizeParam = params.get('size');
    if (themeParam) {
      currentGenre = themeParam;
      document.querySelectorAll('#genre-pills .pill').forEach(p => p.classList.toggle('active', p.dataset.genre === currentGenre));
      setThemeOnBody();
    }
    if (sizeParam) {
      currentSize = sizeParam;
      document.querySelectorAll('#size-pills .pill').forEach(p => p.classList.toggle('active', p.dataset.size === currentSize));
    }
    if (seedParam) {
      seedInput.value = seedParam;
      await applySeed(seedParam);
    } else {
      await generateMap();
      await generateQuest();
      await generateAsset();
    }
    // initial status ping
    try { await timedFetch(API_BASE + '/status'); } catch (_) {}
  })();

  // Convenience keyboard bindings (g: map, q: quest, a: asset, s: save seed)
  document.addEventListener("keydown", (e) => {
    if (e.key === "g") generateMap();
    if (e.key === "q") generateQuest();
    if (e.key === "a") generateAsset();
    if (e.key === "s") saveSeedToStorage(lastSeed, `Seed ${lastSeed}`);
  });
});
