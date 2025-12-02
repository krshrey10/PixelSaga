# PixelSaga Backend

This is the backend for PixelSaga. It serves the static frontend and provides small deterministic procedural generation APIs for maps, quests, and assets.

## Quick start

Ensure Python 3.10+ is installed. From the `backend` directory:

```
python -m venv venv
venv\Scripts\Activate.ps1
pip install -r requirements.txt
python app.py
```

If the UI looks unstyled (plain HTML), try the following:

1. Stop the browser loading the `index.html` file directly — navigate to `http://127.0.0.1:5000` after running the server.
2. Verify the Flask app is running in the `backend` folder (use `python app.py` after activating the venv).
3. Open the devtools (F12 / Ctrl+Shift+I) and check the Network tab for `styles.css`, `script.js` & resource requests. If any return 404, confirm the server is running and that the URL path is `http://127.0.0.1:5000/`.
4. If you do not want to run the server, opening `index.html` locally in the browser now works: we changed asset URLs to `static/` relative paths so the page should render; but you will lose backend functionality like map generation until the Flask server is started.

Open http://127.0.0.1:5000 in a browser.

## Features

- Procedural map generator (`/api/generate-map`)
- Quest generator (`/api/generate-quest`)
- Asset forge (`/api/generate-asset`)
- Static UI at `/` with interactive hologram map, seed controls, export (JSON/PDF), and seed save/load
 - Static UI at `/` with interactive hologram map, seed controls, export (JSON/PDF/Image), and seed save/load

## Notes

- Seeds are deterministic and can be saved locally in `localStorage`.
 - Seeds are deterministic and can be saved locally in `localStorage` or shared via URL parameters.
 - Use the 'Copy Link' button to share the exact seed + theme + size with others.
 - 'Toggle Labels' button hides/shows the letters on the hologram map for clean image exports.
 - Use 'Export Map' to download the current map view as PNG.
 - Toggle 'Auto' in the top-right to prevent auto-regeneration while tweaking options.
- Frontend uses `html2canvas` and `jsPDF` for PDF export.
