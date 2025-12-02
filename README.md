<p align="center">
  <img src="C:\Users\admin\Downloads\PixelSaga.png" alt="PixelSaga-Procedural World Generation" />
</p>

# 🚀 PixelSaga – Procedural World Generation Engine
AI-Enhanced · Deterministic · Multi-Genre · Research-Level Project

## PixelSaga is a futuristic procedural world generation engine that combines:

✔ Algorithmic world generation (Perlin Noise, WFC-ready architecture)

✔ Deterministic seed system (hash-based PRNG)

✔ Quest generation with structured narrative beats

✔ Asset Forge with deterministic holo-items

✔ Multi-genre holographic map rendering (Fantasy, Cyberpunk, Sci-Fi, Post-Apoc)

✔ Exportable demo outputs (JSON, PDF-ready data)

This project simulates how modern game engines generate maps, quests, and assets, while showcasing AI + algorithms integration, suitable for research, portfolios, and degree evaluations.

# ✨ Features

# 🌍 1. Procedural Map Generation

Each map is generated using a deterministic seed engine, meaning:

The same seed → the same world, every time.

Maps vary by genre:

# 🧙 Fantasy (grass, dungeons, ruins)

# ⚙ Sci-Fi (labs, asteroid fields, jump gates)

# ☣ Post-Apoc (bunkers, toxic pools, wastelands)

# 🌆 Cyberpunk (neon districts, megablocks, corp HQ)

Maps are displayed in a 3D hologram-inspired UI with glowing tile palettes.

# 🧭 2. Quest Timeline Generator

Quest beats are generated deterministically:

1.Quest title

2.Location

3.Difficulty

4.Step-by-step progression

5.Emojis for each quest step (🧭, 🎯, 🚀, 🏁)

# ⚒️ 3. Asset Forge – Deterministic Holo Items

1.Generates futuristic rotating holo-items based on:

2.Type (Weapon, Armor, Artifact…)

3.Material (Titanium, Iron…)

4.Rarity (Common → Legendary)

5.Enhancement (Fire, Ice, Poison, Cyber)

6.Power rating

7.Value slider

8.Seed replay system

## The system produces:

✔ Dynamic item names

✔ Tier scores

✔ Procedural flavor text

✔ Bonus stats

✔ Perfect determinism

# 🔐 4. Deterministic Seed Engine

## PixelSaga implements a hash-based PRNG system:
User Seed → SHA-256 Hash → 64-bit Integer → random.Random()
Why deterministic seeds matter

## Deterministic systems are used in:

Game engines (Minecraft, No Man’s Sky, RimWorld)

Scientific simulations

Procedural artificial intelligence

Distributed simulation replay

## They allow:

✔ 100% reproducibility
✔ Debugging complex generation systems
✔ Shareable world seeds
✔ High-quality procedural content

# 🤖 5. AI + Algorithms Hybrid Architecture (Extensible)

PixelSaga includes hooks for adding:

# 🔮 Future-ready algorithms

1.Perlin/Simplex noise terrain

2.Wave Function Collapse (WFC)

3.Cellular Automata for cave maps

4.Voronoi region biome splitting

# 🧠 Machine Learning Integration (Planned)

1.Difficulty estimation via:

2.Random Forest

3.XGBoost

4.LightGBM

5.Small neural networks

## Uses features such as:

1.Terrain roughness

2.Resource availability

3.Enemy density

4.Distance metrics

# 🏗 Project Architecture
PixelSaga/
│
├── backend/
│   ├── app.py               # Flask backend + deterministic generators
│   ├── static/              # Frontend UI build
│   ├── world_gen.py         # (optional future) Advanced generators
│   └── requirements.txt
│
├── .vscode/                 # Editor settings (ignored)
├── .gitignore               # Prevents committing .venv, caches, etc.
├── README.md                # You are here
└── .venv/ (LOCAL ONLY — not in repo)

# 💡 How It Works (Technical Overview)
## 1️⃣ Seed Normalization

Every incoming seed is normalized:
seed = int(raw_seed or random.randint(1, 1_000_000_000))
## 2️⃣ Hashing
hash = sha256(str(seed))
rng_seed = int(hash[:16], 16)

## 3️⃣ Deterministic Random Stream
rng = random.Random(rng_seed)
tile = rng.choice(tile_palette)

# 📦 Running the Project
# 🔧 Backend
cd backend
pip install -r requirements.txt
python app.py
Backend runs on:
http://127.0.0.1:5000

# 🖥 Frontend
Served automatically from backend/static/.

# 🌟 Screenshots 
<img width="1900" height="929" alt="image" src="https://github.com/user-attachments/assets/a1174a61-9981-4b3c-9892-7509d23786d4" />
<img width="884" height="725" alt="image" src="https://github.com/user-attachments/assets/3fd99c0c-af72-4ccf-b3ba-fa64e3ff257f" />
<img width="868" height="723" alt="image" src="https://github.com/user-attachments/assets/3b1fe2d6-ec29-4b1b-af97-3e0e8ad46ecf" />
<img width="493" height="719" alt="image" src="https://github.com/user-attachments/assets/61f8781b-708a-41b4-a381-7b458f739293" />
![Hologram Map](static/screenshots/map.png)
![Quest Timeline](static/screenshots/quest.png)
![Asset Forge](static/screenshots/forge.png)

# 🌐 Live Demo

<p align="center">
  <img src="C:\Users\admin\OneDrive\Desktop\PixelSaga.gif" width="650" />
</p>


You can deploy PixelSaga using:

Render.com

Railway.app

Vercel (static) + Flask backend

GitHub Pages + API server

🧪 API Endpoints
| Endpoint              | Method | Description                         |
| --------------------- | ------ | ----------------------------------- |
| `/api/generate-map`   | POST   | Create deterministic world grid     |
| `/api/generate-quest` | POST   | Create deterministic quest timeline |
| `/api/generate-asset` | POST   | Generate deterministic holo-item    |
| `/api/status`         | GET    | Health/latency check                |

# 🔥 Why This Project Stands Out

✔ Full procedural generation pipeline
✔ Correct deterministic seed engine
✔ Multi-genre tile palette
✔ Narrative generation structure
✔ Sophisticated cyberpunk UI
✔ Clean backend architecture
✔ Very strong for university evaluation / capstone
✔ Easy extension into ML and more algorithms

# 🙌 Contributors

Shreya K.R (@krshrey10)
Creator, designer, and full-stack developer of PixelSaga.

# 📜 License

MIT License (recommended for open-source game tools).

