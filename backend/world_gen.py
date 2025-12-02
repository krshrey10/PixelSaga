# backend/world_gen.py
"""
World generation module for PixelSaga.

Adds multiple algorithms:
- Perlin/Simplex noise terrain
- Wave Function Collapse (WFC) cities/dungeons
- Cellular Automata caves
- Voronoi biome regions

All functions are deterministic given (seed, theme, size).
"""

import math
import random
from dataclasses import dataclass
from typing import List, Dict, Tuple

try:
    # pip install noise
    from noise import pnoise2
except ImportError:
    pnoise2 = None  # we’ll fall back to simple value noise


# ---------------------------------------------------------
# Common types & helpers
# ---------------------------------------------------------

@dataclass
class TileDef:
    name: str
    symbol: str
    resources: List[str]
    difficulty: str
    flavor: str


# base tiles we can reuse across algorithms
BASE_TILES: Dict[str, TileDef] = {
    "water": TileDef(
        name="Water", symbol="W",
        resources=["Fish"],
        difficulty="Easy",
        flavor="Calm water surface."
    ),
    "deep_water": TileDef(
        name="Deep Water", symbol="W",
        resources=["Fish", "Rare minerals"],
        difficulty="Hard",
        flavor="Dark, unfathomable depths."
    ),
    "grass": TileDef(
        name="Grass", symbol="G",
        resources=["Herbs"],
        difficulty="Easy",
        flavor="Rolling grassy plains."
    ),
    "forest": TileDef(
        name="Forest", symbol="F",
        resources=["Wood", "Fauna"],
        difficulty="Medium",
        flavor="Dense woodland, full of life."
    ),
    "mountain": TileDef(
        name="Mountain", symbol="M",
        resources=["Ore", "Stone"],
        difficulty="Hard",
        flavor="Steep rocky peaks."
    ),
    "town": TileDef(
        name="Town", symbol="T",
        resources=["Supplies", "NPCs"],
        difficulty="Safe",
        flavor="A small settlement with trade opportunities."
    ),
    "dungeon": TileDef(
        name="Dungeon", symbol="D",
        resources=["Loot"],
        difficulty="Hard",
        flavor="Dark corridors and lurking creatures."
    ),
    "ruins": TileDef(
        name="Ruins", symbol="R",
        resources=["Artifacts"],
        difficulty="Medium",
        flavor="Crumbling remains of a forgotten place."
    ),
    "industrial": TileDef(
        name="Industrial Zone", symbol="I",
        resources=["Parts", "Energy"],
        difficulty="Medium",
        flavor="Heavy machinery and humming reactors."
    ),
    "residential": TileDef(
        name="Residential Block", symbol="H",
        resources=["Civilians"],
        difficulty="Safe",
        flavor="Homes stacked into neon-lit towers."
    ),
    "road": TileDef(
        name="Road", symbol="=",  # will get overridden to “R” when we show it
        resources=[],
        difficulty="Safe",
        flavor="Main artery connecting the city sectors."
    ),
    "park": TileDef(
        name="Park", symbol="P",
        resources=["Herbs"],
        difficulty="Easy",
        flavor="A rare patch of green in the neon jungle."
    ),
}


# Map size presets – same as your small/medium/large
SIZE_PRESETS = {
    "small": (18, 12),
    "medium": (24, 16),
    "large": (32, 20),
}


def _pick_size(size: str) -> Tuple[int, int]:
    return SIZE_PRESETS.get(size, SIZE_PRESETS["small"])


def _cell_payload(tile: TileDef, x: int, y: int, biome: str) -> Dict:
    """Convert a TileDef into the JSON object the frontend expects."""
    return {
        "x": x,
        "y": y,
        "name": tile.name,
        "symbol": tile.symbol if tile.symbol != "=" else tile.name[0].upper(),
        "resources": tile.resources,
        "difficulty": tile.difficulty,
        "flavor": tile.flavor,
        "biome": biome,  # CSS hook for different colors
    }


# ---------------------------------------------------------
# 1. Perlin / Simplex Noise terrain
# ---------------------------------------------------------

def _value_noise(x: float, y: float, rng: random.Random) -> float:
    """Very simple fallback noise if `noise` is not installed."""
    # Hash coordinates deterministically with RNG
    key = (int(x * 73856093) ^ int(y * 19349663)) & 0xFFFFFFFF
    rng2 = random.Random(key)
    return rng2.random() * 2.0 - 1.0  # [-1, 1]


def _noise2(x: float, y: float, seed: int) -> float:
    if pnoise2 is not None:
        return pnoise2(x, y, octaves=4, persistence=0.5, lacunarity=2.0, base=seed)
    # fallback: value noise
    rng = random.Random(seed)
    return _value_noise(x, y, rng)


def generate_perlin_world(theme: str, size: str, seed: int) -> Dict:
    """
    Heightmap + moisture noise -> layered biomes.
    Works great for Fantasy / Post-Apoc overworlds.
    """
    width, height = _pick_size(size)
    scale = 12.0  # bigger = smoother

    cells: List[Dict] = []

    for y in range(height):
        for x in range(width):
            nx = x / scale
            ny = y / scale

            h = _noise2(nx, ny, seed)          # height
            m = _noise2(nx + 100, ny + 100, seed + 7)  # moisture

            # Normalize [-1,1] -> [0,1]
            h01 = (h + 1.0) / 2.0
            m01 = (m + 1.0) / 2.0

            # Base thresholds – you can tweak these per theme
            if h01 < 0.25:
                tile = BASE_TILES["deep_water"]
                biome = "ocean"
            elif h01 < 0.32:
                tile = BASE_TILES["water"]
                biome = "coast"
            else:
                # land: use moisture for biome
                if h01 > 0.8:
                    tile = BASE_TILES["mountain"]
                    biome = "mountain"
                elif m01 < 0.25:
                    tile = BASE_TILES["grass"]
                    biome = "steppe"
                elif m01 < 0.55:
                    tile = BASE_TILES["grass"]
                    biome = "plains"
                else:
                    tile = BASE_TILES["forest"]
                    biome = "forest"

            # sprinkle towns / ruins using another noise
            feature_n = _noise2(nx + 200, ny - 200, seed + 13)
            if h01 > 0.35 and feature_n > 0.72:
                tile = BASE_TILES["town"]
                biome = "settlement"
            elif h01 > 0.45 and feature_n < -0.7:
                tile = BASE_TILES["ruins"]
                biome = "ruins"

            cells.append(_cell_payload(tile, x, y, biome))

    return {"grid_columns": width, "map": cells}
    

# ---------------------------------------------------------
# 2. Voronoi regions (biomes / factions)
# ---------------------------------------------------------

def generate_voronoi_world(theme: str, size: str, seed: int, regions: int = 7) -> Dict:
    """
    Large region shards – good for biome / faction overview maps.
    """
    width, height = _pick_size(size)
    rng = random.Random(seed)

    # random region centers
    centers = []
    BIOME_KEYS = ["grass", "forest", "mountain", "water", "town", "ruins"]
    for _ in range(regions):
        cx = rng.randint(0, width - 1)
        cy = rng.randint(0, height - 1)
        biome_key = rng.choice(BIOME_KEYS)
        centers.append((cx, cy, biome_key))

    cells: List[Dict] = []
    for y in range(height):
        for x in range(width):
            # choose closest center
            best = None
            best_dist = 999999
            for cx, cy, biome_key in centers:
                d = (cx - x) ** 2 + (cy - y) ** 2
                if d < best_dist:
                    best_dist = d
                    best = biome_key

            tile = BASE_TILES.get(best, BASE_TILES["grass"])
            cells.append(_cell_payload(tile, x, y, best))

    return {"grid_columns": width, "map": cells}


# ---------------------------------------------------------
# 3. Cellular Automata caves / dungeons
# ---------------------------------------------------------

def generate_cellular_world(theme: str, size: str, seed: int) -> Dict:
    """
    Cave-style dungeon using cellular automata.
    Works well for “Ancient Dungeon”, “Ruined Bunker” etc.
    """
    width, height = _pick_size(size)
    rng = random.Random(seed)

    # initial random fill: True = wall, False = empty
    fill_prob = 0.45
    grid = [[rng.random() < fill_prob for _ in range(width)] for _ in range(height)]

    def wall_neighbors(g, x, y):
        c = 0
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                if dx == 0 and dy == 0:
                    continue
                nx, ny = x + dx, y + dy
                if nx < 0 or nx >= width or ny < 0 or ny >= height:
                    c += 1  # treat outside as wall
                elif g[ny][nx]:
                    c += 1
        return c

    # run smoothing steps
    for _ in range(5):
        new = [[False] * width for _ in range(height)]
        for y in range(height):
            for x in range(width):
                walls = wall_neighbors(grid, x, y)
                if grid[y][x]:
                    new[y][x] = walls >= 4
                else:
                    new[y][x] = walls > 4
        grid = new

    cells: List[Dict] = []
    for y in range(height):
        for x in range(width):
            if grid[y][x]:
                # wall -> rock / mountain / industrial
                tile = BASE_TILES["mountain"]
                biome = "rock"
            else:
                # floor -> dungeon tile
                tile = BASE_TILES["dungeon"]
                biome = "dungeon"
            cells.append(_cell_payload(tile, x, y, biome))

    return {"grid_columns": width, "map": cells}


# ---------------------------------------------------------
# 4. Wave Function Collapse (simple tile WFC)
# ---------------------------------------------------------

# Very tiny tile set for demonstration
WFC_TILES = ["road", "residential", "industrial", "park"]

# Adjacency constraints: TILE -> {dir: [allowed neighbors]}
# dirs: "N", "S", "E", "W"
WFC_RULES = {
    "road": {
        "N": ["road", "residential", "industrial", "park"],
        "S": ["road", "residential", "industrial", "park"],
        "E": ["road", "residential", "industrial", "park"],
        "W": ["road", "residential", "industrial", "park"],
    },
    "residential": {
        "N": ["road", "residential", "park"],
        "S": ["road", "residential", "park"],
        "E": ["road", "residential", "park"],
        "W": ["road", "residential", "park"],
    },
    "industrial": {
        "N": ["road", "industrial"],
        "S": ["road", "industrial"],
        "E": ["road", "industrial"],
        "W": ["road", "industrial"],
    },
    "park": {
        "N": ["road", "residential", "park"],
        "S": ["road", "residential", "park"],
        "E": ["road", "residential", "park"],
        "W": ["road", "residential", "park"],
    },
}


def generate_wfc_world(theme: str, size: str, seed: int) -> Dict:
    """
    Small WFC implementation – great for cyberpunk districts or sci-fi stations.
    """
    width, height = _pick_size(size)
    rng = random.Random(seed)

    # grid of sets – each cell starts as “all tiles possible”
    possibilities = [[set(WFC_TILES) for _ in range(width)] for _ in range(height)]

    def neighbors(x, y):
        for dx, dy, d1, d2 in [
            (0, -1, "N", "S"),
            (0, 1, "S", "N"),
            (1, 0, "E", "W"),
            (-1, 0, "W", "E"),
        ]:
            nx, ny = x + dx, y + dy
            if 0 <= nx < width and 0 <= ny < height:
                yield nx, ny, d1, d2

    def collapse():
        # choose cell with lowest entropy (>1)
        coords = []
        min_entropy = 999
        for y in range(height):
            for x in range(width):
                opts = possibilities[y][x]
                l = len(opts)
                if l == 1:
                    continue
                if l < min_entropy:
                    min_entropy = l
                    coords = [(x, y)]
                elif l == min_entropy:
                    coords.append((x, y))

        if not coords:
            return False  # done

        x, y = rng.choice(coords)
        opts = list(possibilities[y][x])
        choice = rng.choice(opts)
        possibilities[y][x] = {choice}
        return True

    def propagate():
        changed = True
        while changed:
            changed = False
            for y in range(height):
                for x in range(width):
                    current = possibilities[y][x]
                    if not current:
                        continue
                    for nx, ny, d1, d2 in neighbors(x, y):
                        neighbor_opts = possibilities[ny][nx]
                        allowed = set()
                        for t in current:
                            allowed |= set(WFC_RULES[t][d1])
                        new_neighbor = neighbor_opts & allowed
                        if new_neighbor != neighbor_opts:
                            possibilities[ny][nx] = new_neighbor
                            changed = True

    # run WFC – restart if contradictions
    for _ in range(8):
        # reset
        possibilities = [[set(WFC_TILES) for _ in range(width)] for _ in range(height)]
        ok = True
        for _ in range(width * height * 4):
            if not collapse():
                break
            propagate()
            # check contradiction
            for row in possibilities:
                if any(len(c) == 0 for c in row):
                    ok = False
                    break
            if not ok:
                break
        if ok:
            break

    # choose final tile per cell
    cells: List[Dict] = []
    for y in range(height):
        for x in range(width):
            opts = possibilities[y][x]
            if not opts:
                tile_key = "road"
            else:
                tile_key = list(opts)[0]
            base = BASE_TILES[tile_key]
            biome = tile_key
            cells.append(_cell_payload(base, x, y, biome))

    return {"grid_columns": width, "map": cells}


# ---------------------------------------------------------
# High-level dispatcher used by Flask route
# ---------------------------------------------------------

def generate_world_map(theme: str, size: str, seed: int) -> Dict:
    """
    Main entry point used by /api/generate-map.
    Chooses algorithm based on theme.
    """
    theme = (theme or "fantasy").lower()

    # You can tune this mapping however you like:
    if theme in ("fantasy", "post-apocalyptic", "post-apocalyptic"):
        # rich terrain with lakes, forests, mountains
        return generate_perlin_world(theme, size, seed)
    elif theme in ("sci-fi", "sci fi", "sci_fi"):
        # sci-fi overworld: Voronoi territories
        return generate_voronoi_world(theme, size, seed)
    elif theme in ("cyberpunk",):
        # cyberpunk city block: WFC districts
        return generate_wfc_world(theme, size, seed)
    elif theme in ("dungeon", "caves"):
        return generate_cellular_world(theme, size, seed)
    else:
        # fallback
        return generate_perlin_world(theme, size, seed)
