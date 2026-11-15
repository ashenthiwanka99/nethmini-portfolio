# Nethmini Perera — portfolio

A single-page portfolio for Nethmini Perera, graphic designer. Plain HTML, CSS and JavaScript, no build step.

The hero is a small WebGL scene written by hand (`js/orbit.js`): her work orbits her portrait; drag to spin it, click a piece to open it. Smooth scrolling uses Lenis (MIT), kept in `js/vendor/`.

## Folders

| Path | What it is |
| --- | --- |
| `index.html`, `css/`, `js/` | The site. `index.html` is the file to edit. |
| `assets/img/` | Web copies of her work (WebP, quality 92, in 640 / 1200 / full widths). Made by `tools/build_images.py`. |
| `assets/fonts/` | Anton and DM Sans (SIL Open Font License), served from the site itself. |
| `source/` | Her originals under clean names, untouched. **Private: holds her CV with phone number and home address. Never publish this folder** (it is in `.gitignore`). |
| `tools/build_images.py` | Rebuilds `assets/img/` from `source/` (Python with Pillow, numpy, opencv-python). |
| `tools/build_preview.py` | Writes `preview-standalone.html`: the whole site in one file, for viewers that cannot load neighbouring files. |

## Looking at it

- Open `preview-standalone.html` (everything is inside the one file), or
- run `python -m http.server 8000` in this folder and open `http://localhost:8000`.

## Adding a piece

1. Put the original in the right folder under `source/`.
2. Add a line for it to `WORKS` in `tools/build_images.py` and run the script.
3. Copy a neighbouring `<figure>` in `index.html` and change the file names, sizes, title and description.

## Where the material came from

- A folder supplied by her family (her photo, CV and 31 pieces of work).
- Her Tumblr, `nethminiperera.tumblr.com`: the two double exposures, the before/after pair, and larger copies of two Jedel Gaming posts.

## Design research

The direction (the name as a monument, with the portrait between the two words) was chosen after looking at:

- Awwwards, portfolio and graphic-design inspiration pages — https://www.awwwards.com/inspiration/portfolio-page-graphic-design-portfolio-1
- One Page Love, portfolio genre — https://onepagelove.com/inspiration/portfolio
- Muzli, "100 Best Designer Portfolio Websites of 2026" — https://muz.li/blog/top-100-most-creative-and-unique-portfolio-websites-of-2025/
- Designity, "10 Best Graphic Design Portfolio Examples" — https://www.designity.com/blog/graphic-design-portfolio-examples
- The study of 247 Awwwards Sites of the Day and One Page Love sites bundled with the `design-taste-frontend` skill (reference sites for this direction: Produx Design, House of Honey, HAOQI.DESIGN).

The type (a heavy condensed sans for the name, DM Sans for text) and the black-and-white portrait come from her own CV.
