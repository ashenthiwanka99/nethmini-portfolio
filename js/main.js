/* Nethmini Perera — portfolio. Everything here is an enhancement:
   the page reads and works with scripts off. (The hero's 3D scene is in orbit.js.) */
(function () {
  "use strict";
  var doc = document.documentElement;
  doc.classList.add("js");
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  var wide = window.matchMedia("(min-width: 821px)");
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };

  /* ---- headings rise word by word; the name rises letter by letter ---- */
  $$("h2.reveal, h2.split").forEach(function (h) {
    var label = h.textContent.replace(/\s+/g, " ").trim(), n = 0;
    var lines = h.innerHTML.split(/<br\s*\/?>/i).map(function (line) {
      var tmp = document.createElement("div"); tmp.innerHTML = line;
      return tmp.textContent.trim().split(/\s+/).map(function (w) {
        var e = document.createElement("span"); e.textContent = w;
        return '<span class="w" aria-hidden="true"><span style="--i:' + (n++) + '">' + e.innerHTML + "</span></span>";
      }).join(" ");
    });
    h.innerHTML = lines.join("<br>");
    h.setAttribute("aria-label", label);
    h.classList.add("is-split", "reveal");
  });
  var name = $(".name");
  if (name && !reduce) {
    var count = 0;
    name.setAttribute("aria-label", name.textContent.replace(/\s+/g, " ").trim());
    $$("span", name).forEach(function (word) {
      var t = word.textContent; word.setAttribute("aria-hidden", "true");
      word.innerHTML = t.split("").map(function (ch) {
        return '<span class="l"><span style="--i:' + (count++) + '">' + ch + "</span></span>";
      }).join("");
    });
    name.classList.add("is-split");
  }

  /* ---- the curtain: a short lift once the type is ready ---- */
  function ready() {
    if (doc.classList.contains("is-ready")) return;
    doc.classList.add("is-ready");
    document.dispatchEvent(new Event("hero:start"));
  }
  if (reduce) ready();
  else {
    var curtain = document.createElement("div");
    curtain.className = "curtain"; curtain.setAttribute("aria-hidden", "true");
    curtain.innerHTML = "<span></span>";
    document.body.appendChild(curtain);
    var t0 = performance.now(), lifted = false;
    var lift = function () {
      if (lifted) return; lifted = true;
      setTimeout(function () {
        curtain.classList.add("is-up"); ready();
        setTimeout(function () { curtain.remove(); }, 800);
      }, Math.max(0, 220 - (performance.now() - t0)));
    };
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(lift);
    setTimeout(lift, 2200);
  }

  /* ---- smooth scrolling with a mouse or trackpad (touch keeps the phone's own scrolling) ---- */
  var lenis = null;
  if (window.Lenis && !reduce && fine) {
    try {
      lenis = new window.Lenis({ lerp: 0.1, wheelMultiplier: 1 });
      var loop = function (t) { lenis.raf(t); requestAnimationFrame(loop); };
      requestAnimationFrame(loop);
    } catch (e) { lenis = null; }
  }
  $$('a[href^="#"]').forEach(function (a) {
    a.addEventListener("click", function (e) {
      var target = $(a.getAttribute("href"));
      if (!target || !lenis) return;
      e.preventDefault();
      lenis.scrollTo(target, { duration: 1.4 });
      history.replaceState(null, "", a.getAttribute("href"));
    });
  });

  /* ---- reveal as things enter the screen ---- */
  var targets = $$(".reveal, .wipe, .swing");
  if (!("IntersectionObserver" in window) || reduce) {
    targets.forEach(function (el) { el.classList.add("in"); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    targets.forEach(function (el) { io.observe(el); });
  }

  /* ---- social media: the row travels sideways as you scroll down (wide screens) ---- */
  var social = $(".social"), track = $(".social .mosaic"), travel = 0;
  function sizeTrack() {
    if (!social || !track) return;
    var on = wide.matches && !reduce;
    social.classList.toggle("is-track", on);
    if (!on) { social.style.height = ""; track.style.transform = ""; return; }
    travel = Math.max(0, track.scrollWidth - window.innerWidth);
    social.style.height = (window.innerHeight + travel) + "px";
  }

  /* ---- things that follow the scroll ---- */
  var hero = $(".hero"), foot = $(".foot"), progress = $(".progress");
  var passers = $$(".posters__pass figure"), drifters = $$("[data-drift]");
  var marquee = $(".marquee__row"), mx = 0, mdir = -1, mvel = 0, lastY = window.scrollY, mw = 0;
  function onScroll() {
    var y = window.scrollY, vh = window.innerHeight, max = doc.scrollHeight - vh;
    mvel += (y - lastY) * 0.35; if (y !== lastY) mdir = y > lastY ? -1 : 1; lastY = y;
    if (progress) progress.style.transform = "scaleX(" + (max > 0 ? clamp(y / max, 0, 1) : 0).toFixed(4) + ")";
    if (hero) hero.style.setProperty("--hp", clamp(y / (hero.offsetHeight || vh), 0, 1).toFixed(4));
    if (foot) {
      var fr = foot.getBoundingClientRect();
      foot.style.setProperty("--fp", clamp((vh - fr.top) / Math.min(vh, fr.height), 0, 1).toFixed(4));
    }
    if (social && social.classList.contains("is-track")) {
      var sr = social.getBoundingClientRect(), p = clamp(-sr.top / Math.max(1, sr.height - vh), 0, 1);
      track.style.transform = "translate3d(" + (-p * travel).toFixed(1) + "px,0,0)";
      social.style.setProperty("--p", p.toFixed(4));
    }
    if (wide.matches) {
      passers.forEach(function (f, n) {
        var r = f.getBoundingClientRect(), o = clamp((r.top + r.height / 2 - vh / 2) / vh, -1.2, 1.2);
        f.style.transform = "rotate(" + (o * (n % 2 ? 5 : -5)).toFixed(2) + "deg)";
      });
      drifters.forEach(function (el) {
        var k = parseFloat(el.getAttribute("data-drift")) || 0, was = el._dy || 0;
        var r = el.getBoundingClientRect(), o = (r.top - was + r.height / 2 - vh / 2);
        el._dy = clamp(o * k, -120, 120);
        el.style.transform = "translate3d(0," + el._dy.toFixed(1) + "px,0)";
      });
    }
  }
  var ticking = false;
  function requestScroll() { if (!ticking) { ticking = true; requestAnimationFrame(function () { ticking = false; onScroll(); }); } }
  if (!reduce) {
    window.addEventListener("scroll", requestScroll, { passive: true });
    window.addEventListener("resize", function () { sizeTrack(); requestScroll(); });
    window.addEventListener("load", function () { sizeTrack(); requestScroll(); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { sizeTrack(); requestScroll(); });
    sizeTrack(); onScroll();
  }

  /* ---- the running line of skills: it speeds up and turns with the scroll ---- */
  if (marquee && !reduce) {
    marquee.innerHTML += marquee.innerHTML;
    var seen = true, lastT = 0;
    if ("IntersectionObserver" in window) new IntersectionObserver(function (es) { seen = es[0].isIntersecting; }).observe(marquee.parentNode);
    var run = function (t) {
      var dt = Math.min(0.05, (t - lastT) / 1000 || 0.016); lastT = t;
      if (seen) {
        if (!mw) mw = marquee.scrollWidth / 2;
        mx += mdir * (70 + Math.abs(mvel) * 14) * dt; mvel *= 0.9;
        if (mx <= -mw) mx += mw; if (mx > 0) mx -= mw;
        marquee.style.transform = "translate3d(" + mx.toFixed(1) + "px,0,0)";
      }
      requestAnimationFrame(run);
    };
    requestAnimationFrame(run);
    window.addEventListener("resize", function () { mw = 0; });
  }

  /* ---- with a mouse: pieces tilt toward the pointer, buttons lean toward it ---- */
  if (fine && !reduce) {
    $$(".zoom").forEach(function (z) {
      z.addEventListener("pointermove", function (e) {
        var r = z.getBoundingClientRect();
        z.style.setProperty("--ry", (((e.clientX - r.left) / r.width - 0.5) * 9).toFixed(2) + "deg");
        z.style.setProperty("--rx", ((0.5 - (e.clientY - r.top) / r.height) * 9).toFixed(2) + "deg");
      });
      z.addEventListener("pointerleave", function () { z.style.setProperty("--rx", "0deg"); z.style.setProperty("--ry", "0deg"); });
    });
    $$(".btn, .nav__cta, .contact__arrow").forEach(function (b) {
      var host = b.classList.contains("contact__arrow") ? b.closest("a") : b;
      host.addEventListener("pointermove", function (e) {
        var r = b.getBoundingClientRect();
        b.style.transform = "translate(" + ((e.clientX - r.left - r.width / 2) * 0.22).toFixed(1) + "px," + ((e.clientY - r.top - r.height / 2) * 0.3).toFixed(1) + "px)";
      });
      host.addEventListener("pointerleave", function () { b.style.transform = ""; });
    });
  }

  /* ---- before / after ---- */
  $$(".ba").forEach(function (ba) {
    var range = $(".ba__range", ba);
    function set(v) { ba.style.setProperty("--pos", v + "%"); }
    range.addEventListener("input", function () { ba.dataset.touched = "1"; set(range.value); });
    set(range.value);
    if (reduce || !("IntersectionObserver" in window)) return;
    /* one sweep when it first comes into view, to show that it moves */
    var seenBa = new IntersectionObserver(function (es) {
      if (!es[0].isIntersecting) return;
      seenBa.disconnect();
      var s0 = null;
      function step(t) {
        if (ba.dataset.touched) return;
        if (!s0) s0 = t;
        var p = Math.min(1, (t - s0) / 2400), v = 50 + Math.sin(p * Math.PI * 2) * 32;
        range.value = v; set(v.toFixed(2));
        if (p < 1) requestAnimationFrame(step); else { range.value = 50; set(50); }
      }
      requestAnimationFrame(step);
    }, { threshold: 0.6 });
    seenBa.observe(ba);
  });

  /* ---- Forest Heaven band: choosing a slice opens it; the open piece then opens at full size ---- */
  var panels = $$(".band__panel");
  function labelPanels() {
    panels.forEach(function (p) {
      var open = p.classList.contains("is-open") || !wide.matches;
      p.setAttribute("aria-label", (open ? "Open " : "Show ") + p.getAttribute("data-title") + (open ? " at full size" : ""));
    });
  }
  panels.forEach(function (p) {
    p.addEventListener("click", function (e) {
      if (!wide.matches || p.classList.contains("is-open")) return;      /* the lightbox handler takes it */
      e.stopImmediatePropagation();
      panels.forEach(function (o) { o.classList.toggle("is-open", o === p); });
      labelPanels();
    }, true);
  });
  if (panels.length) { labelPanels(); wide.addEventListener("change", labelPanels); }

  /* ---- lightbox: open any piece at full size ---- */
  var lb = $("#lightbox");
  var zooms = $$("[data-full]");
  if (lb && lb.showModal && zooms.length) {
    var img = $(".lb__img", lb), cap = $(".lb__cap", lb), at = 0, opener = null;
    var render = function (i) {
      at = (i + zooms.length) % zooms.length;
      var z = zooms[at];
      img.style.animation = "none"; void img.offsetWidth; img.style.animation = "";
      img.src = z.getAttribute("data-full");
      img.width = z.getAttribute("data-w"); img.height = z.getAttribute("data-h");
      img.alt = z.getAttribute("data-alt") || "";
      cap.innerHTML = "";
      var b = document.createElement("b"); b.textContent = z.getAttribute("data-title") || "";
      var s = document.createElement("span"); s.textContent = z.getAttribute("data-note") ? "  " + z.getAttribute("data-note") : "";
      cap.appendChild(b); cap.appendChild(s);
    };
    zooms.forEach(function (z, i) {
      z.addEventListener("click", function () { opener = z; render(i); lb.showModal(); if (lenis) lenis.stop(); });
    });
    $(".lb__close", lb).addEventListener("click", function () { lb.close(); });
    $(".lb__prev", lb).addEventListener("click", function () { render(at - 1); });
    $(".lb__next", lb).addEventListener("click", function () { render(at + 1); });
    $(".lb__stage", lb).addEventListener("click", function (e) { if (e.target !== img) lb.close(); });
    img.addEventListener("click", function () { lb.close(); });
    lb.addEventListener("keydown", function (e) {
      if (e.key === "ArrowRight") render(at + 1);
      if (e.key === "ArrowLeft") render(at - 1);
    });
    lb.addEventListener("close", function () { if (lenis) lenis.start(); if (opener && opener.focus) opener.focus({ preventScroll: true }); });
  }

  /* ---- with a mouse, the pointer turns into a label over anything that opens ---- */
  if (fine && !reduce) {
    var cur = document.createElement("div"), curText = document.createElement("span");
    cur.className = "cursor"; cur.setAttribute("aria-hidden", "true"); cur.appendChild(curText);
    document.body.appendChild(cur); doc.classList.add("has-cursor");
    var cx = 0, cy = 0, tx = 0, ty = 0, raf = null;
    var follow = function () {
      cx += (tx - cx) * 0.24; cy += (ty - cy) * 0.24;
      cur.style.transform = "translate(" + cx.toFixed(1) + "px," + cy.toFixed(1) + "px)";
      raf = Math.abs(tx - cx) + Math.abs(ty - cy) > 0.4 ? requestAnimationFrame(follow) : null;
    };
    document.addEventListener("pointermove", function (e) {
      if (e.pointerType && e.pointerType !== "mouse") return;
      tx = e.clientX; ty = e.clientY;
      var t = e.target.closest ? e.target.closest("[data-full]") : null, word = "";
      if (t) word = t.classList.contains("band__panel") && !t.classList.contains("is-open") && wide.matches ? "Show" : "View";
      else if (e.target.id === "orbit" && !e.buttons) word = { tile: "View", ring: "Drag" }[e.target.getAttribute("data-hit")] || "";
      if (word) curText.textContent = word;
      cur.classList.toggle("is-on", !!word);
      if (!raf) raf = requestAnimationFrame(follow);
    }, { passive: true });
    document.addEventListener("pointerdown", function () { cur.classList.remove("is-on"); }, { passive: true });
  }

  /* ---- only one About bar open at a time ---- */
  var bars = $$(".bar");
  bars.forEach(function (d) {
    d.addEventListener("toggle", function () {
      if (d.open) bars.forEach(function (o) { if (o !== d) o.open = false; });
    });
  });
})();
