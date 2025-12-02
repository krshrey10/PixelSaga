# backend/app.py

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import os
import random
import hashlib

# -------------------------------------------------------------------
# Flask app + static config
# -------------------------------------------------------------------

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")

app = Flask(__name__, static_folder=STATIC_DIR, static_url_path="/static")
CORS(app, resources={r"/api/*": {"origins": "*"}})

# -------------------------------------------------------------------
# Deterministic RNG helpers
# -------------------------------------------------------------------

def rng_from_string(seed_str: str) -> random.Random:
    """Turn any string/int into a deterministic Random() instance."""
    h = hashlib.sha256(str(seed_str).encode("utf-8")).hexdigest()
    num = int(h[:16], 16)  # 64-bit chunk
    return random.Random(num)


def ensure_user_seed(raw_seed):
    """Take incoming seed or create a new human-readable one."""
    if raw_seed is None or raw_seed == "":
        return random.randint(1, 1_000_000_000)
    return int(str(raw_seed))


# -------------------------------------------------------------------
# MAP CATALOG (tile palette per genre)
# -------------------------------------------------------------------

MAP_CATALOG = {
    "fantasy": [
        {"symbol": "G", "class": "fantasy-grass",   "name": "Grass",    "resources": ["Herbs"],         "difficulty": "Easy",        "flavor": "Open emerald plains."},
        {"symbol": "W", "class": "fantasy-water",   "name": "Water",    "resources": ["Fish"],          "difficulty": "Medium",      "flavor": "Glowing rivers and lakes."},
        {"symbol": "M", "class": "fantasy-mountain","name": "Mountain", "resources": ["Ore"],           "difficulty": "Hard",        "flavor": "Jagged crystal peaks."},
        {"symbol": "F", "class": "fantasy-forest",  "name": "Forest",   "resources": ["Wood"],          "difficulty": "Medium",      "flavor": "Dense neon woods."},
        {"symbol": "T", "class": "fantasy-town",    "name": "Town",     "resources": ["Supplies"],      "difficulty": "Safe",        "flavor": "Soft-lit settlements."},
        {"symbol": "D", "class": "fantasy-dungeon", "name": "Dungeon",  "resources": ["Treasure"],      "difficulty": "Very Hard",   "flavor": "Ancient ruins beneath the surface."},
    ],
    "sci-fi": [
        {"symbol": "H", "class": "scifi-hub",       "name": "Hub",      "resources": ["Credits"],       "difficulty": "Medium",      "flavor": "Central trade nexus."},
        {"symbol": "V", "class": "scifi-vacuum",    "name": "Void",     "resources": ["Dark Matter"],   "difficulty": "Hard",        "flavor": "Exposed starless regions."},
        {"symbol": "B", "class": "scifi-base",      "name": "Outpost",  "resources": ["Fuel"],          "difficulty": "Medium",      "flavor": "Frontier research stations."},
        {"symbol": "A", "class": "scifi-asteroid",  "name": "Field",    "resources": ["Ore"],           "difficulty": "Hard",        "flavor": "Drifting asteroid belts."},
        {"symbol": "L", "class": "scifi-lab",       "name": "Lab",      "resources": ["Data"],          "difficulty": "Easy",        "flavor": "Bright experimental labs."},
        {"symbol": "G", "class": "scifi-gate",      "name": "Gate",     "resources": ["Access"],        "difficulty": "Very Hard",   "flavor": "Heavily shielded jump gates."},
    ],
    "post-apoc": [
        {"symbol": "T", "class": "pa-town",         "name": "Town Ruin","resources": ["Scrap"],         "difficulty": "Medium",      "flavor": "Shattered settlements."},
        {"symbol": "R", "class": "pa-rubble",       "name": "Rubble",   "resources": ["Metal"],         "difficulty": "Easy",        "flavor": "Collapsed structures."},
        {"symbol": "F", "class": "pa-fire",         "name": "Fires",    "resources": ["Heat"],          "difficulty": "Hard",        "flavor": "Burning wastelands."},
        {"symbol": "W", "class": "pa-water",        "name": "Toxic",    "resources": ["Contaminants"],  "difficulty": "Medium",      "flavor": "Irradiated pools."},
        {"symbol": "M", "class": "pa-mine",         "name": "Mine",     "resources": ["Ammo"],          "difficulty": "Hard",        "flavor": "Trapped resource pits."},
        {"symbol": "B", "class": "pa-bunker",       "name": "Bunker",   "resources": ["Tech"],          "difficulty": "Very Hard",   "flavor": "Hidden sealed vaults."},
    ],
    "cyberpunk": [
        {"symbol": "S", "class": "cp-streets",      "name": "Streets",  "resources": ["Credchips"],     "difficulty": "Medium",      "flavor": "Crowded chrome avenues."},
        {"symbol": "C", "class": "cp-commercial",   "name": "Market",   "resources": ["Gear"],          "difficulty": "Safe",        "flavor": "Endless neon stalls."},
        {"symbol": "I", "class": "cp-industrial",   "name": "Industrial","resources": ["Parts"],        "difficulty": "Dangerous",   "flavor": "Smog-filled factories."},
        {"symbol": "R", "class": "cp-residential",  "name": "Residential","resources": ["Contacts"],   "difficulty": "Medium",      "flavor": "Stacked megablocks."},
        {"symbol": "W", "class": "cp-water",        "name": "Waterway", "resources": ["Filtered H₂O"], "difficulty": "Easy",        "flavor": "Underground channels."},
        {"symbol": "H", "class": "cp-hq",           "name": "Corp HQ",  "resources": ["Secrets"],       "difficulty": "Very Hard",   "flavor": "Armoured skyline spires."},
    ],
}

# -------------------------------------------------------------------
# WORLD GENERATION HELPERS
# -------------------------------------------------------------------

def build_map_grid(theme: str, size: str, seed: int):
    """Simple deterministic map generator used by /api/generate-map."""
    palette = MAP_CATALOG.get(theme, MAP_CATALOG["fantasy"])
    rng = rng_from_string(f"map:{theme}:{size}:{seed}")

    if size == "small":
        cell_count, columns = 100, 10
    elif size == "medium":
        cell_count, columns = 225, 15
    else:
        cell_count, columns = 400, 20

    tiles = []
    for _ in range(cell_count):
        tile_def = rng.choice(palette)
        tiles.append(
            {
                "symbol": tile_def["symbol"],
                "class": tile_def["class"],
                "name": tile_def["name"],
                "resources": tile_def["resources"],
                "difficulty": tile_def["difficulty"],
                "flavor": tile_def["flavor"],
            }
        )

    return tiles, columns


def build_quest(theme: str, size: str, seed: int):
    """Deterministic quest beats for /api/generate-quest."""
    rng = rng_from_string(f"quest:{theme}:{size}:{seed}")

    titles = ["Recovery", "Rescue", "Heist", "Escort", "Scan"]
    locations = {
        "fantasy": ["Ancient Ruins", "Crystal Forest", "Sunken Keep"],
        "sci-fi": ["Orbital Relay", "Abandoned Complex", "Crystal Belt"],
        "post-apoc": ["Crater City", "Dust Highway", "Flooded Mall"],
        "cyberpunk": ["Neon District", "Corporate Spire", "Dockside Grid"],
    }
    diffs = ["Easy", "Medium", "Hard"]

    title = rng.choice(titles)
    location = rng.choice(locations.get(theme, locations["fantasy"]))
    difficulty = rng.choice(diffs)

    # Emoji per step (UI: 💠-style beat markers)
    step_icons = ["🧭", "🎯", "🚀", "📦", "🏁"]
    raw_steps = ["Travel to location", "Complete objective", "Return safely"]

    steps = []
    for i, label in enumerate(raw_steps):
        icon = step_icons[i] if i < len(step_icons) else "•"
        steps.append({"label": label, "icon": icon})

    description = f"{title} at {location} (Difficulty: {difficulty})."

    return {
        "status": "success",
        "seed": seed,
        "title": title,
        "location": location,
        "difficulty": difficulty,
        "steps": steps,          # richer structure (with emoji)
        "raw_steps": raw_steps,  # simple list, for backwards compatibility
        "description": description,
        "description_ai": description,
    }


# -------------------------------------------------------------------
# ASSET FORGE – deterministic holo-item generator
# -------------------------------------------------------------------

RARITY_MULTIPLIER = {
    "Common": 1.0,
    "Uncommon": 1.3,
    "Rare": 1.7,
    "Epic": 2.3,
    "Legendary": 3.0,
}

BASE_VALUE = {
    "Weapon": 120,
    "Armor": 140,
    "Artifact": 220,
    "Consumable": 60,
}

ELEMENT_TITLE = {
    "None": "Power",
    "Fire": "Flames",
    "Ice": "Frost",
    "Poison": "Venom",
    "Cyber": "Systems",
}


def build_asset(theme: str, seed: int, data: dict):
    """Core logic for the Asset Forge; deterministic for a given config."""
    asset_type = (data.get("type") or data.get("asset_type") or "Weapon").strip().title()
    material = (data.get("material") or "Iron").strip().title()
    enhancement = (data.get("enhancement") or "None").strip().title()
    rarity = (data.get("rarity") or "Common").strip().title()
    power = int(data.get("power") or 1)
    value_slider = int(data.get("value") or data.get("value_mod") or 1)

    power = max(1, min(power, 10))
    value_slider = max(1, min(value_slider, 10))

    # RNG salted by all parameters → deterministic holo-item
    rng = rng_from_string(f"asset:{theme}:{seed}:{asset_type}:{material}:{rarity}:{power}:{value_slider}")

    rarity_mult = RARITY_MULTIPLIER.get(rarity, 1.0)
    base_val = BASE_VALUE.get(asset_type, 100)

    bonus = int(power * rarity_mult * 1.5)
    final_value = int(base_val * rarity_mult * (0.7 + 0.1 * value_slider))

    element_title = ELEMENT_TITLE.get(enhancement, "Power")

    title = f"{material} {asset_type} of {element_title}"
    desc = f"A {rarity.lower()} {asset_type.lower()} crafted from {material.lower()}."

    # extra flavour per theme / enhancement
    extra = {
        "Fire": "Glows faintly with internal embers.",
        "Ice": "Always feels a few degrees colder than the air.",
        "Poison": "Carries a subtle iridescent sheen along its edges.",
        "Cyber": "Laced with humming circuitry along the core.",
        "None": "Reliable hardware with no visible distortions.",
    }.get(enhancement, "")

    full_flavor = (desc + " " + extra).strip()

    asset = {
        "title": title,
        "name": title,            # alias for old frontend code
        "type": asset_type,
        "material": material,
        "enhancement": enhancement,
        "rarity": rarity,
        "power": power,
        "value_score": value_slider,
        "bonus": f"+{bonus}",
        "numeric_bonus": bonus,
        "value": final_value,
        "description": full_flavor,
        "flavor": full_flavor,
    }

    forge_status = f"Seed {seed} · {rarity.upper()} {asset_type} · Power {power}"

    return asset, forge_status


# -------------------------------------------------------------------
# API ROUTES
# -------------------------------------------------------------------

@app.route("/api/status", methods=["GET"])
def api_status():
    return jsonify({"status": "ok", "service": "pixelsaga", "version": "dev"}), 200


@app.route("/api/generate-map", methods=["POST"])
def api_generate_map():
    data = request.get_json(force=True) or {}
    theme = data.get("theme", "fantasy")
    size = data.get("size", "small")
    user_seed = ensure_user_seed(data.get("seed"))

    tiles, columns = build_map_grid(theme, size, user_seed)

    return jsonify(
        {
            "status": "success",
            "theme": theme,
            "size": size,
            "seed": user_seed,
            "map": tiles,           # original name
            "tiles": tiles,         # alias, in case
            "grid_columns": columns,
        }
    )


@app.route("/api/generate-quest", methods=["POST"])
def api_generate_quest():
    data = request.get_json(force=True) or {}
    theme = data.get("theme", "fantasy")
    size = data.get("size", "small")
    user_seed = ensure_user_seed(data.get("seed"))

    quest = build_quest(theme, size, user_seed)
    return jsonify(quest)


@app.route("/api/generate-asset", methods=["POST"])
def api_generate_asset():
    data = request.get_json(force=True) or {}
    theme = data.get("theme", "fantasy")
    user_seed = ensure_user_seed(
        data.get("seed") or data.get("map_seed") or data.get("quest_seed")
    )

    asset, forge_status = build_asset(theme, user_seed, data)

    # include both new + legacy fields so script.js is happy
    response = {
        "ok": True,
        "status": "success",
        "theme": theme,
        "seed": user_seed,
        "forge_status": forge_status,
        "asset": asset,
        # flattened legacy fields:
        "name": asset["name"],
        "type": asset["type"],
        "material": asset["material"],
        "rarity": asset["rarity"],
        "bonus": asset["bonus"],
        "value": asset["value"],
        "flavor": asset["flavor"],
    }

    return jsonify(response), 200


# -------------------------------------------------------------------
# STATIC / FRONTEND ROUTES
# -------------------------------------------------------------------

@app.route("/", methods=["GET"])
def index_route():
    return send_from_directory(STATIC_DIR, "index.html")


@app.route("/<path:filename>", methods=["GET"])
def serve_static_root(filename):
    path = os.path.join(STATIC_DIR, filename)
    if os.path.exists(path):
        return send_from_directory(STATIC_DIR, filename)
    # SPA fallback → index.html
    return send_from_directory(STATIC_DIR, "index.html")


# -------------------------------------------------------------------
# ENTRY POINT
# -------------------------------------------------------------------

if __name__ == "__main__":
    print("Starting PixelSaga backend. static dir:", STATIC_DIR)
    app.run(host="127.0.0.1", port=5000, debug=True)
