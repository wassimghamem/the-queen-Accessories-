# The Queen Accessories — Piercing studio website

Bilingual (Français / العربية) one-page site for **The Queen Accessories**, Tunis Palmarium,
with real-time 3D jewellery. No build step, no dependencies to install.

## Structure

| Path | What it is |
|------|-----------|
| `index.html` | Page structure (semantic, accessible). |
| `css/styles.css` | "Nacre" design system: tokens at the top (colour, type, spacing). |
| `js/data.js` | **Edit here:** products, prices, zones, descriptions, all FR/AR text. |
| `js/app.bundle.js` | **What the page runs** — app + 3D engine + Three.js in one file. |
| `js/app.js` | Source: language switch, filters, product sheet, hero showcase. |
| `js/jewel3d.js` | Source: 3D engine (Three.js) — 15 jewel models, studio lighting, metals, sparkles. |
| `build.sh` | Rebuilds `app.bundle.js` after editing `app.js` / `jewel3d.js`. |
| `assets/products/*.jpg` | One real photo per piercing. File name = product `slug`. |
| `assets/vendor/three/` | Three.js source used when rebuilding the bundle. |

## Change a price or text
Open `js/data.js`, find the product by `slug`, edit `price`, `fr` / `ar` names, or descriptions.
Save and refresh — no rebuild needed.

## Add a piercing
1. Add a photo `assets/products/<slug>.jpg`.
2. Add an entry to `PRODUCTS` in `js/data.js` with a `zone` and a `model`
   (`star`, `starDuo`, `roundStar`, `leafCuff`, `captive`, `hoop`, `septum`, `smiley`,
   `industrial`, `tongue`, `curved`, `dermalDuo`, `surface`, `navel`, `huggieDrop`).

## Run locally
Just double-click `index.html`. Everything (including 3D) works without a server.

## Edit the app or 3D code
Edit `js/app.js` or `js/jewel3d.js`, then run `./build.sh` (needs Node.js) to regenerate `js/app.bundle.js`.

## Deploy on GitHub Pages
Push the folder contents to the repo root → **Settings → Pages → Deploy from branch → main / root**.

## Accessibility
WCAG 2.2 AA targets: contrast-checked tokens, visible focus, native `<dialog>` (focus trap + Esc),
keyboard arrows in the product sheet, `prefers-reduced-motion` respected (no auto-rotation or float),
RTL via logical CSS properties, photo fallback when WebGL is unavailable.
