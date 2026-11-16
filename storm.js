/* A thunderstorm behind "I am the storm": rolling clouds, slanting rain and
   forked lightning. Each strike lights up the sky and makes the words glow. */
(function () {
  'use strict';
  var section = document.getElementById('storm'), canvas = document.getElementById('storm-canvas');
  if (!section || !canvas || !canvas.getContext) return;
  var ctx = canvas.getContext('2d');
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var W = 0, H = 0, dpr = 1, visible = true, last = performance.now();
  var clouds = [], drops = [], bolts = [], flash = 0, nextStrike = 1.2;

  function rand(a, b) { return a + Math.random() * (b - a); }

  function setup() {
    clouds = [];
    for (var i = 0; i < 14; i++) {
      clouds.push({ x: rand(-0.2, 1.2) * W, y: rand(-0.1, 0.45) * H, r: rand(0.18, 0.42) * Math.max(W, H), speed: rand(4, 14), shade: rand(0.55, 1) });
    }
    drops = [];
    var n = Math.round(W * H / 2600);
    for (var j = 0; j < n; j++) drops.push({ x: rand(0, W), y: rand(0, H), len: rand(10, 22), speed: rand(650, 950) });
  }

  // Forked lightning: split each segment, nudge its midpoint sideways, sometimes branch off.
  function makeBolt(x1, y1, x2, y2, spread, depth, out, width) {
    if (depth === 0) { out.push({ x1: x1, y1: y1, x2: x2, y2: y2, w: width }); return; }
    var mx = (x1 + x2) / 2 + rand(-spread, spread), my = (y1 + y2) / 2 + rand(-spread * 0.2, spread * 0.2);
    makeBolt(x1, y1, mx, my, spread / 2, depth - 1, out, width);
    makeBolt(mx, my, x2, y2, spread / 2, depth - 1, out, width);
    if (depth > 2 && Math.random() < 0.3) {
      var bx = mx + rand(-0.25, 0.25) * H, by = my + rand(0.15, 0.35) * H;
      makeBolt(mx, my, bx, by, spread / 2.5, depth - 2, out, width * 0.55);
    }
  }
  function strike() {
    var x = rand(0.1, 0.9) * W, segs = [];
    makeBolt(x, -10, x + rand(-0.25, 0.25) * W, H * rand(0.75, 1.05), W * 0.12, 7, segs, Math.max(1.6, W / 380));
    bolts.push({ segs: segs, life: 1 });
    flash = 1;
    if (Math.random() < 0.6) setTimeout(function () { flash = Math.max(flash, 0.75); if (bolts.length) bolts[bolts.length - 1].life = 0.9; }, 110);  // the double flicker
    nextStrike = rand(2.2, 5.5);
  }

  function draw(dt) {
    var sky = ctx.createLinearGradient(0, 0, 0, H);                 // heavy storm sky
    sky.addColorStop(0, '#060a14');
    sky.addColorStop(0.55, '#101a2c');
    sky.addColorStop(1, '#1a2438');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    for (var i = 0; i < clouds.length; i++) {                        // rolling clouds, lit from inside by the flash
      var c = clouds[i];
      c.x += c.speed * dt;
      if (c.x - c.r > W) c.x = -c.r;
      var lift = flash * 0.55 * c.shade;
      var g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.r);
      g.addColorStop(0, 'rgba(' + Math.round(52 + 150 * lift) + ',' + Math.round(64 + 160 * lift) + ',' + Math.round(88 + 165 * lift) + ',' + (0.8 * c.shade).toFixed(2) + ')');
      g.addColorStop(0.55, 'rgba(' + Math.round(34 + 90 * lift) + ',' + Math.round(44 + 100 * lift) + ',' + Math.round(64 + 110 * lift) + ',' + (0.45 * c.shade).toFixed(2) + ')');
      g.addColorStop(1, 'rgba(20,28,44,0)');
      ctx.fillStyle = g;
      ctx.fillRect(c.x - c.r, c.y - c.r, c.r * 2, c.r * 2);
    }

    ctx.lineCap = 'round';                                           // lightning
    for (var b = bolts.length - 1; b >= 0; b--) {
      var bolt = bolts[b];
      if (bolt.life <= 0) { bolts.splice(b, 1); continue; }
      var a = Math.min(1, bolt.life * 1.4);
      ctx.save();
      ctx.shadowColor = 'rgba(150,190,255,' + a + ')';
      ctx.shadowBlur = 24;
      for (var s = 0; s < bolt.segs.length; s++) {
        var seg = bolt.segs[s];
        ctx.strokeStyle = 'rgba(205,225,255,' + a + ')';
        ctx.lineWidth = seg.w;
        ctx.beginPath(); ctx.moveTo(seg.x1, seg.y1); ctx.lineTo(seg.x2, seg.y2); ctx.stroke();
      }
      ctx.shadowBlur = 0;
      for (s = 0; s < bolt.segs.length; s++) {                       // white-hot core
        seg = bolt.segs[s];
        ctx.strokeStyle = 'rgba(255,255,255,' + a + ')';
        ctx.lineWidth = seg.w * 0.4;
        ctx.beginPath(); ctx.moveTo(seg.x1, seg.y1); ctx.lineTo(seg.x2, seg.y2); ctx.stroke();
      }
      ctx.restore();
      bolt.life -= dt * 3.2;
    }

    ctx.strokeStyle = 'rgba(170,195,230,' + (0.28 + 0.4 * flash).toFixed(2) + ')';   // slanting rain
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (var d = 0; d < drops.length; d++) {
      var r = drops[d];
      r.y += r.speed * dt; r.x -= r.speed * 0.18 * dt;
      if (r.y > H) { r.y = -r.len; r.x = rand(0, W * 1.2); }
      ctx.moveTo(r.x, r.y); ctx.lineTo(r.x - r.len * 0.18, r.y + r.len);
    }
    ctx.stroke();

    if (flash > 0.01) {                                              // the whole sky lights up
      ctx.fillStyle = 'rgba(190,210,255,' + (flash * 0.35).toFixed(3) + ')';
      ctx.fillRect(0, 0, W, H);
    }
    section.style.setProperty('--flash', flash.toFixed(3));
    flash = Math.max(0, flash - dt * 2.4);
  }

  function loop(now) {
    var dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (visible) {
      nextStrike -= dt;
      if (nextStrike <= 0) strike();
      draw(dt);
    }
    requestAnimationFrame(loop);
  }

  function resize() {
    var rect = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.max(1, Math.round(rect.width)); H = Math.max(1, Math.round(rect.height));
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    setup();
  }

  var lastWidth = window.innerWidth;
  window.addEventListener('resize', function () {
    if (window.innerWidth !== lastWidth) { lastWidth = window.innerWidth; resize(); if (reduce) still(); }
  });
  resize();

  function still() {                                                 // reduced motion: one quiet frame, no flashing
    flash = 0.25; draw(0); section.style.setProperty('--flash', '0.25');
  }
  if (reduce) { still(); return; }
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (e) { visible = e[0].isIntersecting; }).observe(section);
  }
  window.BigRStorm = { strike: strike };   // lets the family trigger a strike when checking the page
  requestAnimationFrame(loop);
})();
