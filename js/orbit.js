/* The hero scene: her work orbits her portrait. Plain WebGL, no library.
   Without WebGL, with reduced motion off or on, the plain portrait in the page stays as it is. */
(function () {
  "use strict";
  var hero = document.querySelector(".hero");
  var fig = document.querySelector(".figure");
  var cut = document.querySelector(".figure__cut");
  var canvas = document.getElementById("orbit");
  if (!hero || !fig || !cut || !canvas) return;

  var opts = { alpha: true, antialias: true, premultipliedAlpha: true, powerPreference: "high-performance" };
  var gl = canvas.getContext("webgl2", opts), gl2 = !!gl;
  if (!gl) gl = canvas.getContext("webgl", opts);
  if (!gl) return;

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var TILES;
  try { TILES = JSON.parse(canvas.getAttribute("data-tiles")); } catch (e) { return; }
  var PV = window.__PV || {};
  var resolve = function (s) { return s.indexOf("pv:") === 0 ? PV[s.slice(3)] : s; };

  /* ---------- shaders ---------- */
  var VS = [
    "attribute vec2 aUV;",
    "uniform mat4 uProj; uniform vec4 uTile; uniform vec3 uCentre; uniform float uTilt; uniform float uFlat; uniform vec4 uRect;",
    "varying vec2 vUV; varying float vDepth;",
    "void main(){",
    "  vec3 p;",
    "  if (uFlat > 0.5) { p = vec3(uRect.x + (aUV.x - 0.5) * uRect.z, uRect.y + (0.5 - aUV.y) * uRect.w, 0.0); vDepth = 1.0; }",
    "  else {",
    "    float a = uTile.x + (aUV.x - 0.5) * uTile.y;",
    "    vec3 q = vec3(sin(a) * uTile.w, (0.5 - aUV.y) * uTile.z, cos(a) * uTile.w);",
    "    float c = cos(uTilt), s = sin(uTilt);",
    "    q = vec3(q.x, q.y * c - q.z * s, q.y * s + q.z * c);",
    "    p = uCentre + q; vDepth = q.z / uTile.w;",
    "  }",
    "  vUV = aUV; gl_Position = uProj * vec4(p, 1.0);",
    "}"].join("\n");
  var FS = [
    "precision mediump float;",
    "uniform sampler2D uTex; uniform float uAlpha; uniform float uFlip;",
    "varying vec2 vUV; varying float vDepth;",
    "void main(){",
    "  vec2 uv = vUV; if (uFlip > 0.5) uv.x = 1.0 - uv.x;",
    "  vec4 c = texture2D(uTex, uv);",
    "  float shade = mix(0.30, 1.0, smoothstep(-1.0, 0.55, vDepth));",
    "  gl_FragColor = vec4(c.rgb * shade, c.a) * uAlpha;",
    "}"].join("\n");
  function compile(type, src) {
    var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
  }
  var vs = compile(gl.VERTEX_SHADER, VS), fs = compile(gl.FRAGMENT_SHADER, FS);
  if (!vs || !fs) return;
  var prog = gl.createProgram(); gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
  gl.useProgram(prog);
  var U = {};
  ["uProj", "uTile", "uCentre", "uTilt", "uFlat", "uRect", "uTex", "uAlpha", "uFlip"].forEach(function (n) { U[n] = gl.getUniformLocation(prog, n); });

  /* one bendable strip, reused for every tile and for the portrait */
  var SEG = 24, verts = [], idx = [];
  for (var i = 0; i <= SEG; i++) { verts.push(i / SEG, 0, i / SEG, 1); }
  for (i = 0; i < SEG; i++) { var a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  var vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.STATIC_DRAW);
  var ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(idx), gl.STATIC_DRAW);
  var loc = gl.getAttribLocation(prog, "aUV"); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  gl.disable(gl.DEPTH_TEST); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  var aniso = gl.getExtension("EXT_texture_filter_anisotropic");

  function texture(src, done) {
    var im = new Image();
    im.decoding = "async";
    im.onload = function () {
      var t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, im);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      if (gl2) { gl.generateMipmap(gl.TEXTURE_2D); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); }
      else gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      if (aniso) gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
      done(t);
    };
    im.src = src;
  }

  var tiles = TILES.map(function (t) { return { key: t.k, ar: t.a, tex: null, born: 0, angle: 0, arc: 0 }; });
  var portrait = { tex: null, born: 0 };
  tiles.forEach(function (t, n) { texture(resolve(TILES[n].s), function (tex) { t.tex = tex; t.born = performance.now(); wake(); }); });
  texture(cut.currentSrc || cut.src, function (tex) { portrait.tex = tex; portrait.born = performance.now(); hero.classList.add("hero--gl"); wake(); });

  /* ---------- layout: everything is measured from the portrait's box in the page ---------- */
  var W = 0, H = 0, dpr = 1, F = { x: 0, y: 0, w: 0, h: 0 }, th = 0, R = 0, dist = 0, proj = new Float32Array(16);
  var FOV = 30 * Math.PI / 180;
  function layout() {
    var hr = hero.getBoundingClientRect(), fr = fig.getBoundingClientRect();
    W = Math.max(1, Math.round(hr.width)); H = Math.max(1, Math.round(hr.height));
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
    F.w = fr.width; F.h = fr.height; F.x = fr.left - hr.left + fr.width / 2 - W / 2; F.y = H / 2 - (fr.top - hr.top + fr.height / 2);
    th = F.h * 0.25;
    var gap = th * 0.22, C = 0;
    tiles.forEach(function (t) { C += t.ar * th + gap; });
    R = C / (2 * Math.PI);
    var at = 0;
    tiles.forEach(function (t) { t.arc = (t.ar * th) / R; t.angle = at + t.arc / 2; at += t.arc + gap / R; });
    dist = (H / 2) / Math.tan(FOV / 2);
    var near = Math.max(10, dist - R * 3), far = dist + R * 3, f = 1 / Math.tan(FOV / 2), asp = W / H;
    var p10 = (far + near) / (near - far), p14 = (2 * far * near) / (near - far);
    proj.set([f / asp, 0, 0, 0, 0, f, 0, 0, 0, 0, p10, -1, 0, 0, p10 * -dist + p14, dist]);
    gl.uniformMatrix4fv(U.uProj, false, proj);
  }

  /* ---------- state ---------- */
  var rot = 0.6, vel = 0, BASE = reduce ? 0 : 0.11;
  var px = 0, py = 0, tpx = 0, tpy = 0, hp = 0, start = 0, visible = true, running = false, last = 0;
  var drag = null, moved = 0, hit = "";

  function ease(x) { return 1 - Math.pow(1 - x, 4); }
  function draw(now) {
    var dt = Math.min(0.05, (now - last) / 1000 || 0.016); last = now;
    var intro = reduce ? 1 : ease(Math.min(1, Math.max(0, (now - start) / 2100)));
    px += (tpx - px) * 0.06; py += (tpy - py) * 0.06;
    if (!drag) { vel += (BASE - vel) * Math.min(1, dt * 1.6); rot += vel * dt; }
    var spin = rot - (1 - intro) * 2.4;
    var radius = R * (1 + (1 - intro) * 0.9 + hp * 0.35);
    var tilt = 0.2 + py * 0.05 + (1 - intro) * 0.25;
    var cx = F.x + px * 14, cy = F.y + F.h / 2 - 0.695 * F.h - hp * H * 0.06;

    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform3f(U.uCentre, cx, cy, 0); gl.uniform1f(U.uTilt, tilt); gl.uniform1i(U.uTex, 0);

    var order = tiles.filter(function (t) { return t.tex; }).map(function (t) {
      var a = t.angle + spin; return { t: t, a: a, z: Math.cos(a) };
    }).sort(function (p, q) { return p.z - q.z; });
    function tile(o) {
      var age = Math.min(1, (now - o.t.born) / 700);
      gl.uniform1f(U.uFlat, 0); gl.uniform1f(U.uFlip, o.z < 0 ? 1 : 0);
      gl.uniform4f(U.uTile, o.a, o.t.arc, th, radius);
      gl.uniform1f(U.uAlpha, age * intro * (1 - hp * 0.5));
      gl.bindTexture(gl.TEXTURE_2D, o.t.tex);
      gl.drawElements(gl.TRIANGLES, idx.length, gl.UNSIGNED_SHORT, 0);
    }
    order.forEach(function (o) { if (o.z < 0) tile(o); });
    if (portrait.tex) {
      var pa = Math.min(1, (now - portrait.born) / 500) * (reduce ? 1 : Math.min(1, Math.max(0, (now - start) / 900)));
      gl.uniform1f(U.uFlat, 1); gl.uniform1f(U.uFlip, 0); gl.uniform1f(U.uAlpha, pa);
      gl.uniform4f(U.uRect, F.x + px * 5, F.y - (1 - intro) * 36 - hp * H * 0.03, F.w, F.h);
      gl.bindTexture(gl.TEXTURE_2D, portrait.tex);
      gl.drawElements(gl.TRIANGLES, idx.length, gl.UNSIGNED_SHORT, 0);
    }
    order.forEach(function (o) { if (o.z >= 0) tile(o); });
    drawn = { order: order, radius: radius, tilt: tilt, cx: cx, cy: cy };
  }
  var drawn = null;

  function frame(now) {
    if (!running) return;
    draw(now);
    if (reduce && portrait.tex && tiles.every(function (t) { return t.tex && now - t.born > 800; })) { running = false; return; }
    requestAnimationFrame(frame);
  }
  function wake() { if (!running && visible && !document.hidden && start) { running = true; last = performance.now(); requestAnimationFrame(frame); } }
  function sleep() { running = false; }

  /* ---------- which tile is under the pointer (near ones first) ---------- */
  function pick(clientX, clientY) {
    if (!drawn) return null;
    var hr = hero.getBoundingClientRect();
    var x = clientX - hr.left - W / 2, y = H / 2 - (clientY - hr.top);
    var ct = Math.cos(drawn.tilt), st = Math.sin(drawn.tilt), best = null;
    for (var n = drawn.order.length - 1; n >= 0; n--) {
      var o = drawn.order[n], qx = Math.sin(o.a) * drawn.radius, qz = Math.cos(o.a) * drawn.radius;
      var wy = -qz * st, wz = qz * ct, s = dist / (dist - wz);
      var sx = (drawn.cx + qx) * s, sy = (drawn.cy + wy) * s;
      var hw = 0.5 * o.t.ar * th * s * Math.max(0.12, Math.abs(Math.cos(o.a))), hh = 0.5 * th * s;
      if (Math.abs(x - sx) < hw && Math.abs(y - sy) < hh) {
        if (o.z < 0 && Math.abs(x - F.x) < F.w * 0.3 && y < F.y + F.h * 0.4) continue;   /* behind her */
        best = o.t; break;
      }
    }
    return best;
  }

  /* ---------- input ---------- */
  canvas.addEventListener("pointerdown", function (e) {
    drag = { x: e.clientX, t: performance.now(), id: e.pointerId }; moved = 0;
    try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
  });
  canvas.addEventListener("pointermove", function (e) {
    var hr = hero.getBoundingClientRect();
    tpx = (e.clientX - hr.left) / hr.width * 2 - 1; tpy = (e.clientY - hr.top) / hr.height * 2 - 1;
    if (drag) {
      var dx = e.clientX - drag.x, now = performance.now(), dt = Math.max(1, now - drag.t) / 1000;
      rot += dx / (R * 1.25); vel = (dx / (R * 1.25)) / dt * 0.6; moved += Math.abs(dx);
      drag.x = e.clientX; drag.t = now; wake();
    } else {
      var h = pick(e.clientX, e.clientY);
      var inRing = drawn && Math.abs((H / 2 - (e.clientY - hr.top)) - drawn.cy) < th * 1.5;
      var state = h ? "tile" : inRing ? "ring" : "";
      if (state !== hit) {
        hit = state; canvas.setAttribute("data-hit", state);
        var label = document.documentElement.classList.contains("has-cursor");
        canvas.style.cursor = !state ? "default" : label ? "none" : state === "tile" ? "pointer" : "grab";
      }
    }
  });
  function release(e) {
    if (!drag) return;
    var wasClick = moved < 6; drag = null;
    vel = Math.max(-4, Math.min(4, vel));
    if (wasClick && e && e.type === "pointerup") {
      var t = pick(e.clientX, e.clientY);
      var btn = t && document.querySelector('[data-key="' + t.key + '"]');
      if (btn) btn.click();
    }
  }
  canvas.addEventListener("pointerup", release);
  canvas.addEventListener("pointercancel", release);
  canvas.addEventListener("pointerleave", function () { tpx = 0; tpy = 0; if (hit) { hit = ""; canvas.setAttribute("data-hit", ""); } });

  var lastY = window.scrollY;
  window.addEventListener("scroll", function () {
    var y = window.scrollY, d = y - lastY; lastY = y;
    hp = Math.min(1, Math.max(0, y / (H || 1)));
    if (!reduce) vel += Math.max(-1.2, Math.min(1.2, d * 0.004));
  }, { passive: true });

  var rz;
  window.addEventListener("resize", function () { clearTimeout(rz); rz = setTimeout(function () { layout(); if (reduce) { running = false; wake(); } }, 120); });
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (es) { visible = es[0].isIntersecting; visible ? wake() : sleep(); }, { threshold: 0 }).observe(hero);
  }
  document.addEventListener("visibilitychange", function () { document.hidden ? sleep() : wake(); });
  canvas.addEventListener("webglcontextlost", function (e) { e.preventDefault(); sleep(); hero.classList.remove("hero--gl"); });

  /* the page says when the curtain has lifted; until then nothing is drawn */
  function begin() { if (start) return; layout(); start = performance.now(); wake(); }
  if (document.documentElement.classList.contains("is-ready")) begin();
  document.addEventListener("hero:start", begin);
  setTimeout(begin, 4500);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { if (start) layout(); });
})();
