"""Builds the web images in assets/img from the untouched originals in source/.

Run from the project root:  python tools/build_images.py
Needs Pillow, numpy and opencv-python. Originals are never modified.
Output: WebP at quality 92 (sharp chroma), full size plus 1200 and 640 wide copies,
and assets/img/manifest.json with every file's pixel size.
"""
import io, json, os
import numpy as np, cv2
from PIL import Image, ImageCms, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC, OUT = os.path.join(ROOT, "source"), os.path.join(ROOT, "assets", "img")
SWOP = r"C:\Windows\System32\spool\drivers\color\RSWOP.icm"  # only for CMYK files that carry no profile
Q = 92
WIDTHS = (640, 1200)

# id -> (source path, longest side of the full-size copy)
WORKS = {
    "print/wok-food": ("print-banners/wok-food-takeaway-30x42in.jpeg", 2200),
    "print/kola-kenda": ("print-banners/kola-kenda-36x24in.jpeg", 2200),
    "print/bath-menu": ("print-banners/bath-kade-menu-42x24in.jpeg", 2200),
    "print/maths-class": ("print-banners/ganithaya-class-48x60in.jpeg", 2400),
    "social/jedel-gaming-mouse-pad": ("social-media/matheesha-computer/from-tumblr/jedel-gaming-mouse-pad-2048.jpg", 1600),
    "social/jedel-smooth-mouse-pad": ("social-media/matheesha-computer/from-tumblr/jedel-smooth-mouse-pad-2048.jpg", 1600),
    "social/jedel-faster-keyboard": ("social-media/matheesha-computer/jedel-faster-keyboard.jpeg", 1600),
    "social/mixx-art-grow": ("social-media/mixx-art/grow-your-business-blue.jpeg", 1600),
    "social/mixx-art-boost": ("social-media/mixx-art/boost-your-business-navy.jpeg", 1600),
    "social/cake-bake-brown": ("social-media/cake-and-bake-academy/part-time-course-brown.jpeg", 1600),
    "social/cake-bake-peach": ("social-media/cake-and-bake-academy/part-time-course-peach.jpeg", 1600),
    "social/klarheit-germany": ("social-media/klarheit-consultancy/germany-dream.jpeg", 1600),
    "social/bsm-campus": ("social-media/bsm-campus/special-need-education.jpeg", 1600),
    "social/rathnaweera-sewing": ("social-media/rathnaweera-trading/sewing-machines.jpeg", 1600),
    "forest-heaven/life-with-nature": ("forest-heaven-eco-resort/resort-life-with-nature.jpeg", 1600),
    "forest-heaven/eco-life": ("forest-heaven-eco-resort/resort-eco-life.jpeg", 1600),
    "forest-heaven/night-cabin": ("forest-heaven-eco-resort/resort-night-cabin.jpeg", 1600),
    "forest-heaven/green-retreat": ("forest-heaven-eco-resort/resort-green-retreat.jpeg", 1600),
    "forest-heaven/best-relaxation": ("forest-heaven-eco-resort/resort-best-relaxation.jpeg", 1600),
    "forest-heaven/bakers-bend": ("forest-heaven-eco-resort/places-bakers-bend.jpeg", 1600),
    "forest-heaven/leopards": ("forest-heaven-eco-resort/places-leopards.jpeg", 1600),
    "forest-heaven/samanalawewa": ("forest-heaven-eco-resort/places-samanalawewa.jpeg", 1600),
    "forest-heaven/horton-plains": ("forest-heaven-eco-resort/places-horton-plains.jpeg", 1600),
    "forest-heaven/pahantudawa": ("forest-heaven-eco-resort/places-pahantudawa.jpeg", 1600),
    "forest-heaven/devils-staircase": ("forest-heaven-eco-resort/places-devils-staircase.jpeg", 1600),
    "posters/break-the-silence": ("posters-editorial/break-the-silence-poster.jpeg", 1600),
    "posters/magazine-cover-study": ("posters-editorial/magazine-cover-study.jpeg", 1600),
    "posters/magazine-layout-study": ("posters-editorial/magazine-layout-study.jpeg", 1600),
    "posters/typographic-portrait": ("posters-editorial/typographic-portrait.jpeg", 2400),
    "posters/warrior-tee-white": ("apparel/awaken-warrior-tee-white.jpeg", 1600),
    "posters/warrior-tee-black": ("apparel/awaken-warrior-tee-black.jpeg", 1600),
    "photoshop/double-exposure-forest": ("photoshop/from-tumblr/double-exposure-forest.jpg", 1600),
    "photoshop/double-exposure-mountain": ("photoshop/from-tumblr/double-exposure-mountain.jpg", 1600),
}


def to_srgb(im):
    if im.mode == "CMYK":
        icc = im.info.get("icc_profile")
        src = ImageCms.ImageCmsProfile(io.BytesIO(icc)) if icc else ImageCms.getOpenProfile(SWOP)
        return ImageCms.profileToProfile(
            im, src, ImageCms.createProfile("sRGB"), outputMode="RGB",
            renderingIntent=ImageCms.Intent.RELATIVE_COLORIMETRIC,
            flags=ImageCms.Flags.BLACKPOINTCOMPENSATION,
        )
    return im.convert("RGB")


def save(im, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    try:
        im.save(path, "WEBP", quality=Q, method=6, use_sharp_yuv=True)
    except TypeError:
        im.save(path, "WEBP", quality=Q, method=6)


def variants(im, key, manifest, long_side):
    w, h = im.size
    s = min(1.0, long_side / max(w, h))
    full = im if s == 1.0 else im.resize((round(w * s), round(h * s)), Image.LANCZOS)
    files = []
    for tw in WIDTHS:
        if tw < full.width * 0.9:
            v = full.resize((tw, round(full.height * tw / full.width)), Image.LANCZOS)
            p = f"{key}-{tw}.webp"
            save(v, os.path.join(OUT, p))
            files.append({"src": p, "w": v.width, "h": v.height})
    p = f"{key}-{full.width}.webp"
    save(full, os.path.join(OUT, p))
    files.append({"src": p, "w": full.width, "h": full.height})
    manifest[key] = {"w": full.width, "h": full.height, "files": files}


def cut_portrait(src, S=2):
    """Cuts the portrait out of its white studio ground with no white fringe: dark hair and blazer on white."""
    im = Image.open(src).convert("RGB")
    im = im.resize((im.width * S, im.height * S), Image.LANCZOS)
    a = np.asarray(im).astype(np.float32)
    H, W = a.shape[:2]
    g = 0.299 * a[..., 0] + 0.587 * a[..., 1] + 0.114 * a[..., 2]          # 0..255
    w = a.min(axis=2)

    # 1. background = the white studio ground reached from the frame, plus every white or light gap between
    #    strands of hair. Light is only kept where it belongs to her: face, earrings, neck and shirt (the keep zone).
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    head = ((xx - 0.515 * W) / (0.225 * W)) ** 2 + ((yy - 0.35 * H) / (0.135 * H)) ** 2 < 1.0   # face and earrings, not the hair above
    torso = (yy > 0.44 * H) & (xx > 0.33 * W) & (xx < 0.70 * W)
    keep = head | torso
    white = (w > 214).astype(np.uint8)
    ff = white.copy()
    mask = np.zeros((H + 2, W + 2), np.uint8)
    for x, y in [(x, 0) for x in range(0, W, 8)] + [(0, y) for y in range(0, H, 8)] + [(W - 1, y) for y in range(0, H, 8)]:
        if ff[y, x] == 1:
            cv2.floodFill(ff, mask, (x, y), 2)
    outer = (ff == 2).astype(np.uint8)
    n, lab, stats, cent = cv2.connectedComponentsWithStats(((white == 1) & (outer == 0)).astype(np.uint8), connectivity=8)
    gap_ids = [i for i in range(1, n) if not keep[int(cent[i][1]), int(cent[i][0])]]
    bg = ((outer == 1) | np.isin(lab, gap_ids)).astype(np.uint8)
    shirt = ((white == 1) & (bg == 0)).astype(np.uint8)
    shirt = cv2.dilate(shirt, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9)))

    # 2. the edge band: within a few pixels of any background, plus any light sliver in the hair outside the keep
    #    zone. Everything on the outline is dark (hair, blazer), so there the picture is
    #    seen = alpha * dark + (1 - alpha) * white  and alpha follows from the brightness.
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (25, 25))
    band = (cv2.dilate(bg, k) == 1) & (shirt == 0)
    sliver = (g > 165) & ~keep & (shirt == 0)
    sliver = cv2.dilate(sliver.astype(np.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))) == 1
    band = band | (sliver & ~keep)
    dark = cv2.erode(g, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (31, 31)))   # local darkest = the hair itself
    dark = cv2.GaussianBlur(dark, (0, 0), 6)
    dark = np.minimum(dark, 28.0)     # a thin stray strand is still dark hair, however pale it photographed
    alpha_band = np.clip((250.0 - g) / (250.0 - dark), 0, 1)
    alpha_band = np.clip((alpha_band - 0.06) / 0.94, 0, 1) ** 1.15                # choke a little: no haze
    alpha = np.where(band, alpha_band, 1.0).astype(np.float32)
    alpha[bg == 1] = 0.0
    alpha = cv2.GaussianBlur(alpha, (0, 0), 0.7)
    alpha[bg == 1] = 0.0

    # 3. colour: inside it is the photograph; in the band it is the dark it was made of (never the white behind it)
    al = np.clip(alpha, 0.02, 1)
    solved = np.clip((g - (1 - al) * 255.0) / al, 0, 255)                          # brightness with the white taken out
    edge = np.minimum(solved, dark * 1.5 + 12)
    inside = cv2.GaussianBlur((~band).astype(np.float32), (0, 0), 4)               # 0 at the edge .. 1 well inside
    lum = np.where(band, edge * (1 - inside) + np.minimum(solved, g) * inside, g)
    lum = np.where(band & (alpha_band < 0.97), edge, lum)   # anything see-through takes the hair's own dark, never a light grey

    # close to the outline (outside face and shirt) nothing may be lighter than the hair's own dark: the limit
    # rises from that dark at the very edge to "anything" about 20 px in, so hair shine further inside stays
    dist = cv2.distanceTransform((bg == 0).astype(np.uint8), cv2.DIST_L2, 5)
    t = np.clip(dist / 44.0, 0, 1) ** 1.5
    cap = (dark * 1.5 + 12) * (1 - t) + 255.0 * t
    lum = np.where(~keep & (shirt == 0), np.minimum(lum, cap), lum)

    # 4. black and white with a touch more contrast; sharpen the inside only
    lum = lum / 255.0
    lum = np.clip((lum - 0.5) * 1.12 + 0.5, 0, 1) ** 1.05
    blur = cv2.GaussianBlur(lum, (0, 0), 1.6)
    sharp = np.clip(lum + 0.55 * (lum - blur), 0, 1)
    core = cv2.erode((alpha > 0.98).astype(np.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9))).astype(np.float32)
    core = cv2.GaussianBlur(core, (0, 0), 3)
    lum = sharp * core + lum * (1 - core)
    lum = np.maximum(lum, 0.04)                 # never darker than the page it stands on (#0a0a0a)
    lum = np.where(alpha < 0.02, 0.04, lum)     # what is cut away carries the page's black, so nothing white can bleed back in

    # 5. melt into the page at the bottom
    fade = np.clip((H - np.arange(H, dtype=np.float32)) / (0.16 * H), 0, 1) ** 1.4
    alpha = alpha * fade[:, None]
    g8 = (np.clip(lum, 0, 1) * 255).astype(np.uint8)
    return Image.fromarray(np.dstack([g8, g8, g8, (np.clip(alpha, 0, 1) * 255).astype(np.uint8)]), "RGBA")


def portrait(manifest):
    """The plain black-and-white portrait for About, and the cut-out the hero scene draws over black."""
    im = Image.open(os.path.join(SRC, "portrait", "nethmini-perera-portrait.jpeg")).convert("RGB")
    # the plain black-and-white portrait for the About section
    g = im.convert("L")
    plain = Image.merge("RGB", (g, g, g)).resize((1080, 1920), Image.LANCZOS)
    plain = plain.filter(ImageFilter.UnsharpMask(1.4, 50, 2))
    save(plain, os.path.join(OUT, "portrait", "portrait-bw-1080.webp"))
    save(plain.resize((640, 1138), Image.LANCZOS), os.path.join(OUT, "portrait", "portrait-bw-640.webp"))
    manifest["portrait/portrait-bw"] = {"w": 1080, "h": 1920, "files": [
        {"src": "portrait/portrait-bw-640.webp", "w": 640, "h": 1138},
        {"src": "portrait/portrait-bw-1080.webp", "w": 1080, "h": 1920}]}

    cut = cut_portrait(os.path.join(SRC, "portrait", "nethmini-perera-portrait.jpeg"))
    W, H = cut.size
    for tw in (720, 1440):
        # resize with the colour multiplied by its alpha, so the edge is not mixed with what was cut away
        v = cut if tw == W else cut.convert("RGBa").resize((tw, round(H * tw / W)), Image.LANCZOS).convert("RGBA")
        v.save(os.path.join(OUT, "portrait", f"portrait-cut-{tw}.webp"), "WEBP", lossless=True, method=6, exact=True)
    manifest["portrait/portrait-cut"] = {"w": W, "h": H}


def before_after(manifest):
    b = Image.open(os.path.join(SRC, "photoshop", "from-tumblr", "before-after-1-before.jpg")).convert("RGB")
    a = Image.open(os.path.join(SRC, "photoshop", "from-tumblr", "before-after-2-after.jpg")).convert("RGB")
    size = (1280, 1600)  # both at one size so the slider lines up
    for name, im in (("before", b), ("after", a)):
        full = im.resize(size, Image.LANCZOS)
        if name == "after":
            full = full.filter(ImageFilter.UnsharpMask(1.2, 40, 2))  # it is the smaller original
        files = []
        for tw in (640, 1280):
            v = full if tw == 1280 else full.resize((640, 800), Image.LANCZOS)
            p = f"photoshop/{name}-{tw}.webp"
            save(v, os.path.join(OUT, p))
            files.append({"src": p, "w": v.width, "h": v.height})
        manifest[f"photoshop/{name}"] = {"w": 1280, "h": 1600, "files": files}


def main():
    manifest = {}
    for key, (rel, long_side) in WORKS.items():
        variants(to_srgb(Image.open(os.path.join(SRC, rel))), key, manifest, long_side)
        print(key, manifest[key]["w"], manifest[key]["h"])
    portrait(manifest)
    before_after(manifest)
    with open(os.path.join(OUT, "manifest.json"), "w") as f:
        json.dump(manifest, f, indent=1)
    total = sum(os.path.getsize(os.path.join(dp, x)) for dp, _, fs in os.walk(OUT) for x in fs)
    print("total MB:", round(total / 1e6, 1))


if __name__ == "__main__":
    main()
