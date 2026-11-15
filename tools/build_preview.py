"""Builds preview-standalone.html: the whole site in ONE file (styles, script, fonts and pictures inside it),
for viewers that cannot load neighbouring files. Not for hosting: the real site is index.html + assets/.

Run from the project root:  python tools/build_preview.py
"""
import base64, json, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG = os.path.join(ROOT, "assets", "img")
MIME = {".webp": "image/webp", ".woff2": "font/woff2", ".svg": "image/svg+xml", ".jpg": "image/jpeg"}
PIXEL = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=="


def data_uri(path):
    with open(path, "rb") as f:
        return "data:%s;base64,%s" % (MIME[os.path.splitext(path)[1]], base64.b64encode(f.read()).decode())


def main():
    html = open(os.path.join(ROOT, "index.html"), encoding="utf-8").read()
    css = open(os.path.join(ROOT, "css", "style.css"), encoding="utf-8").read()
    scripts = "\n".join("<script>\n" + open(os.path.join(ROOT, "js", *p), encoding="utf-8").read() + "\n</script>"
                        for p in (("vendor", "lenis.min.js"), ("main.js",), ("orbit.js",)))
    manifest = json.load(open(os.path.join(IMG, "manifest.json")))

    # one copy of each picture: the 1200-wide file where there is one, otherwise the largest
    by_file = {}
    for key, m in manifest.items():
        files = m.get("files", [])
        pick = next((f for f in files if f["w"] in (1200, 1280)), files[-1] if files else None)
        for f in files:
            by_file["assets/img/" + f["src"]] = "assets/img/" + pick["src"]
    for w in (720, 1440):
        by_file[f"assets/img/portrait/portrait-cut-{w}.webp"] = "assets/img/portrait/portrait-cut-1440.webp"

    used = {}
    def key_for(path):
        target = by_file.get(path, path)
        if target not in used:
            used[target] = "p%d" % len(used)
        return used[target]

    html = re.sub(r'\s(?:srcset|sizes)="[^"]*"', "", html)
    html = re.sub(r'<link rel="preload"[^>]*>\n?', "", html)
    html = re.sub(r'<meta property="og:image"[^>]*>\n?', "", html)
    html = re.sub(r'src="(assets/img/[^"]+)"', lambda m: f'src="{PIXEL}" data-pv="{key_for(m.group(1))}"', html)
    html = re.sub(r'data-full="(assets/img/[^"]+)"', lambda m: f'data-full="" data-pvfull="{key_for(m.group(1))}"', html)
    # the pictures the hero scene loads itself (listed as JSON on the canvas)
    html = re.sub(r'&quot;s&quot;:&quot;(assets/img/[^&]+)&quot;', lambda m: '&quot;s&quot;:&quot;pv:%s&quot;' % key_for(m.group(1)), html)
    html = html.replace('loading="lazy"', "")

    css = re.sub(r'url\("\.\./(assets/fonts/[^"]+)"\)', lambda m: 'url("%s")' % data_uri(os.path.join(ROOT, m.group(1))), css)

    table = {k: data_uri(os.path.join(ROOT, path)) for path, k in used.items()}
    loader = ("(function(){var P=window.__PV=" + json.dumps(table) + ";"
              "document.querySelectorAll('[data-pv]').forEach(function(e){e.src=P[e.getAttribute('data-pv')];});"
              "document.querySelectorAll('[data-pvfull]').forEach(function(e){e.setAttribute('data-full',P[e.getAttribute('data-pvfull')]);});})();")

    html = html.replace('<link rel="stylesheet" href="css/style.css">', "<style>\n" + css + "\n</style>")
    html = html.replace('<link rel="icon" href="assets/favicon.svg" type="image/svg+xml">',
                        '<link rel="icon" href="%s">' % data_uri(os.path.join(ROOT, "assets", "favicon.svg")))
    html = html.replace('<script src="js/vendor/lenis.min.js" defer></script>\n', "").replace('<script src="js/orbit.js" defer></script>', "")
    html = html.replace('<script src="js/main.js" defer></script>', "<script>" + loader + "</script>\n" + scripts)
    out = os.path.join(ROOT, "preview-standalone.html")
    with open(out, "w", encoding="utf-8", newline="\n") as f:
        f.write(html)
    left = re.findall(r'(?:src|href)="(?:assets|css|js)/[^"]+"', html)
    print("preview-standalone.html  %.1f MB, %d pictures inside, outside references left: %s" % (os.path.getsize(out) / 1e6, len(table), left))


if __name__ == "__main__":
    main()
