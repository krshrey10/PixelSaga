# backend/seed_engine.py
"""
Deterministic seed helpers for PixelSaga.

Goal:
    Same (theme, size, user_seed) -> same RNG streams for
    map, quest and asset generation.
"""

import hashlib
from dataclasses import dataclass
from typing import Tuple
import random


@dataclass(frozen=True)
class SeedBundle:
    """All deterministic seeds derived from a single user seed."""
    base: int        # main seed
    map_seed: int
    quest_seed: int
    asset_seed: int


def _hash_to_int(key: str) -> int:
    """
    Hash a string into a stable 32-bit integer.
    We use sha256 so result is identical on every machine.
    """
    h = hashlib.sha256(key.encode("utf-8")).hexdigest()
    # take first 8 hex chars -> 32 bits
    return int(h[:8], 16)


def derive_seeds(theme: str, size: str, user_seed: int) -> SeedBundle:
    """
    Canonical way to turn (theme, size, user_seed) into deterministic seeds.

    Example key:
        "map|fantasy|small|734974587"
    """
    theme = (theme or "fantasy").lower()
    size = (size or "small").lower()
    user_seed = int(user_seed)

    base_key = f"base|{theme}|{size}|{user_seed}"
    base = _hash_to_int(base_key)

    map_key = f"map|{theme}|{size}|{user_seed}"
    quest_key = f"quest|{theme}|{size}|{user_seed}"
    asset_key = f"asset|{theme}|{size}|{user_seed}"

    return SeedBundle(
        base=base,
        map_seed=_hash_to_int(map_key),
        quest_seed=_hash_to_int(quest_key),
        asset_seed=_hash_to_int(asset_key),
    )


def rng_from_seed(seed: int) -> random.Random:
    """Convenience helper – always use this to create PRNGs."""
    return random.Random(int(seed))
