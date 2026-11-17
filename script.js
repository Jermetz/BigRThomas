(function () {
  'use strict';
  var cfg = window.SITE || {};
  var $ = function (id) { return document.getElementById(id); };
  var reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* =========================================================
     The eagle. Drawn from scratch so it can flap, bank and glide.
     x, y = centre; span = wingtip to wingtip in pixels;
     flap = -1 (wings down) to 1 (wings up).
     ========================================================= */
  /* =========================================================
     The sky over the bench, matched to the real sun position.
     ========================================================= */
  function sunAt(date, lat, lng) {
    var rad = Math.PI / 180;
    var d = date.getTime() / 86400000 + 2440587.5 - 2451545.0;      // days since J2000
    var g = (357.529 + 0.98560028 * d) * rad;
    var q = 280.459 + 0.98564736 * d;
    var L = (q + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * rad;
    var e = (23.439 - 0.00000036 * d) * rad;
    var ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L));
    var dec = Math.asin(Math.sin(e) * Math.sin(L));
    var gmst = (18.697374558 + 24.06570982441908 * d) % 24;
    var ha = (gmst * 15 + lng) * rad - ra;
    ha = Math.atan2(Math.sin(ha), Math.cos(ha));
    var el = Math.asin(Math.sin(lat * rad) * Math.sin(dec) + Math.cos(lat * rad) * Math.cos(dec) * Math.cos(ha));
    return { elevation: el / rad, morning: ha < 0 };
  }

  function smooth(u) { u = Math.max(0, Math.min(1, u)); return u * u * (3 - 2 * u); }

  function phaseName(sun) {
    var el = sun.elevation;
    if (el < -12) return 'Night';
    if (el < -4) return sun.morning ? 'First light' : 'Dusk';
    if (el < 1) return sun.morning ? 'Sunrise' : 'Sunset';
    if (el < 10) return sun.morning ? 'Morning light' : 'Golden hour';
    return 'Daylight';
  }

  // Sun elevation in degrees -> sky colours [top, middle, horizon]
  var SKY = [
    [-18, '#040816', '#0a1230', '#141c3c'],
    [-8, '#0c1638', '#2a2f63', '#8a5a7a'],
    [-2, '#1b2a5c', '#7a5a8c', '#f08a5b'],
    [3, '#35589a', '#e39a78', '#ffd08a'],
    [10, '#3b78bf', '#93bde3', '#f6dfb4'],
    [25, '#2c72c2', '#79aee2', '#cbe3f3'],
    [60, '#226bbd', '#66a5df', '#b9d9f0']
  ];
  function rgb(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
  function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function css(c, a) { return 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + (a == null ? 1 : a) + ')'; }
  function skyColors(el) {
    el = Math.max(SKY[0][0], Math.min(SKY[SKY.length - 1][0], el));
    for (var i = 0; i < SKY.length - 1; i++) {
      if (el <= SKY[i + 1][0]) {
        var t = (el - SKY[i][0]) / (SKY[i + 1][0] - SKY[i][0]);
        return [1, 2, 3].map(function (k) { return mix(rgb(SKY[i][k]), rgb(SKY[i + 1][k]), t); });
      }
    }
    return [1, 2, 3].map(function (k) { return rgb(SKY[SKY.length - 1][k]); });
  }

  // The season at the bench (Pennsylvania). ?season=winter etc. previews another one.
  var SEASON_NAMES = { winter: 'Winter', spring: 'Spring', summer: 'Summer', fall: 'Autumn' };
  function seasonAt(d) {
    var forced = /[?&]season=(winter|spring|summer|fall)/.exec(location.search);
    if (forced) return forced[1];
    var m = d.getMonth();
    return m === 11 || m < 2 ? 'winter' : m < 5 ? 'spring' : m < 8 ? 'summer' : 'fall';
  }

  // A steady pseudo-random number for star n, so every visitor's star keeps its place.
  function hash(n, k) {
    var x = Math.sin(n * 127.1 + k * 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  (function sky() {
    var canvas = $('sky-canvas');
    if (!canvas || !canvas.getContext) return;
    var ctx = canvas.getContext('2d');
    var back = document.createElement('canvas'), bctx = back.getContext('2d');
    var W = 0, H = 0, dpr = 1, sun = null, visible = true, start = performance.now();
    var season = seasonAt(new Date()), particles = [], lastT = 0;

    /* ---------- One star for every visitor ---------- */
    var visitors = 0, myStar = 0, newStar = 0, bornT = -1;
    try { var saved = JSON.parse(localStorage.getItem('bigr-visit')); if (saved && saved.number) myStar = saved.number; } catch (e) {}
    window.BigRSky = {
      setVisitors: function (n) { if (n > visitors) visitors = n; },
      addMine: function (n) { visitors = Math.max(visitors, n); myStar = n; newStar = n; bornT = -1; }
    };
    function starAt(i) {                                                // i = visitor number, from 1
      var x = 0.03 + hash(i, 1) * 0.94;
      var y = 0.03 + Math.pow(hash(i, 2), 1.3) * 0.55;                  // more of them high up
      return { x: x * W, y: y * H, r: 0.9 + hash(i, 3) * 1.3, rate: 0.6 + hash(i, 4) * 1.8, ph: hash(i, 5) * 6.28 };
    }
    function drawVisitorStars(t) {
      if (!visitors) return;
      var el = sun ? sun.elevation : 30;
      var night = Math.max(0, Math.min(1, (-el - 2) / 8));
      var base = 0.28 + 0.72 * night;                                   // faint gold glints by day, bright at night
      var n = Math.min(visitors, 3000);
      ctx.save();
      for (var i = 1; i <= n; i++) {
        var s = starAt(i), born = 1;
        if (i === newStar && bornT >= 0) born = smooth((t - bornT) / 2.2);
        if (i === newStar && bornT < 0) continue;                       // waits until you are back up here
        var a = base * (0.65 + 0.35 * Math.sin(t * s.rate + s.ph)) * born;
        var r = s.r * (i === myStar ? 1.7 : 1);
        ctx.fillStyle = 'rgba(255,214,130,' + (a * 0.22).toFixed(3) + ')';
        ctx.beginPath(); ctx.arc(s.x, s.y, r * 3.2, 0, 6.2832); ctx.fill();
        ctx.fillStyle = 'rgba(255,240,200,' + a.toFixed(3) + ')';
        ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, 6.2832); ctx.fill();
        if (i === myStar) {                                             // your star gets a little cross of light
          ctx.strokeStyle = 'rgba(255,236,190,' + (a * 0.7).toFixed(3) + ')';
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.moveTo(s.x - r * 5, s.y); ctx.lineTo(s.x + r * 5, s.y);
          ctx.moveTo(s.x, s.y - r * 5); ctx.lineTo(s.x, s.y + r * 5);
          ctx.stroke();
        }
        if (i === newStar && bornT >= 0 && t - bornT < 3) {             // a ring of light as it is born
          var p = (t - bornT) / 3;
          ctx.strokeStyle = 'rgba(255,226,160,' + (0.8 * (1 - p)).toFixed(3) + ')';
          ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.arc(s.x, s.y, 4 + p * 40, 0, 6.2832); ctx.stroke();
        }
      }
      ctx.restore();
    }

    /* ---------- The season: snow, blossom, fireflies, leaves ---------- */
    var LEAF = ['#c8501e', '#e08a1c', '#b8321e', '#d9a531', '#9a4016'];
    var PETAL = ['#f7c6d4', '#fbe3ea', '#f3b3c6'];
    function makeParticle(fresh) {
      var p = { x: Math.random() * W, y: fresh ? Math.random() * H : -20 - Math.random() * 40,
                rot: Math.random() * 6.28, spin: (Math.random() - 0.5) * 2.4, ph: Math.random() * 6.28 };
      if (season === 'winter') { p.r = 0.8 + Math.random() * 2.2; p.vy = 14 + p.r * 9; p.sway = 10 + Math.random() * 14; }
      else if (season === 'fall') { p.r = 4 + Math.random() * 4; p.vy = 22 + Math.random() * 20; p.sway = 30 + Math.random() * 30; p.c = LEAF[(Math.random() * LEAF.length) | 0]; }
      else if (season === 'spring') { p.r = 2.2 + Math.random() * 2; p.vy = 12 + Math.random() * 12; p.sway = 24 + Math.random() * 20; p.c = PETAL[(Math.random() * PETAL.length) | 0]; }
      else { p.y = H * (0.5 + Math.random() * 0.38); p.r = 1.4 + Math.random(); p.vy = 0; p.sway = 14; p.vx = (Math.random() - 0.5) * 10; }
      return p;
    }
    function seedParticles() {
      var n = { winter: Math.round(Math.min(110, W / 6)), fall: Math.round(Math.min(22, W / 40)),
                spring: Math.round(Math.min(18, W / 45)), summer: 26 }[season];
      particles = [];
      for (var i = 0; i < n; i++) particles.push(makeParticle(true));
    }
    function drawSeason(t, dt) {
      var el = sun ? sun.elevation : 30;
      var dim = el < -6 ? 0.55 : 1;                                     // things are darker at night
      if (season === 'summer' && el > 3) return;                        // fireflies only come out at dusk
      ctx.save();
      for (var i = 0; i < particles.length; i++) {
        var p = particles[i];
        if (season === 'summer') {
          p.x += (p.vx + Math.sin(t * 0.7 + p.ph) * 8) * dt;
          p.y += Math.cos(t * 0.5 + p.ph) * 6 * dt;
          if (p.x < -10) p.x = W + 10; if (p.x > W + 10) p.x = -10;
          var glow = Math.max(0, Math.sin(t * 1.3 + p.ph * 3));
          glow = glow * glow * glow;
          if (glow < 0.02) continue;
          ctx.fillStyle = 'rgba(214,255,120,' + (0.25 * glow).toFixed(3) + ')';
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 5, 0, 6.2832); ctx.fill();
          ctx.fillStyle = 'rgba(240,255,170,' + glow.toFixed(3) + ')';
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.2832); ctx.fill();
          continue;
        }
        p.y += p.vy * dt;
        p.rot += p.spin * dt;
        var x = p.x + Math.sin(t * 0.9 + p.ph) * p.sway;
        if (p.y > H + 20) { particles[i] = makeParticle(false); continue; }
        if (season === 'winter') {
          ctx.fillStyle = 'rgba(255,255,255,' + (0.85 * dim).toFixed(2) + ')';
          ctx.beginPath(); ctx.arc(x, p.y, p.r, 0, 6.2832); ctx.fill();
        } else {
          ctx.globalAlpha = 0.92 * dim;
          ctx.fillStyle = p.c;
          ctx.translate(x, p.y); ctx.rotate(p.rot);
          ctx.scale(1, 0.55 + 0.45 * Math.abs(Math.sin(t * 2 + p.ph)));  // tumbling
          ctx.beginPath();
          if (season === 'fall') {                                      // a pointed leaf with a stem
            ctx.moveTo(-p.r, 0);
            ctx.quadraticCurveTo(0, -p.r * 0.9, p.r, 0);
            ctx.quadraticCurveTo(0, p.r * 0.9, -p.r, 0);
            ctx.fill();
            ctx.strokeStyle = p.c; ctx.lineWidth = 0.8;
            ctx.beginPath(); ctx.moveTo(-p.r, 0); ctx.lineTo(-p.r * 1.5, 0); ctx.stroke();
          } else {
            ctx.ellipse(0, 0, p.r, p.r * 0.65, 0, 0, 6.2832);
            ctx.fill();
          }
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          ctx.globalAlpha = 1;
        }
      }
      ctx.restore();
    }

    function hillY(x, layer) {
      var base = H * (0.70 + layer * 0.075), amp = H * (0.035 - layer * 0.006);
      return base + amp * (Math.sin(x / W * (5.1 + layer * 2.3) + layer * 1.7) * 0.6 + Math.sin(x / W * (11.3 - layer * 2) + layer * 4.1) * 0.4);
    }

    function paintBackdrop() {
      sun = sunAt(new Date(), Number(cfg.benchLatitude) || 40.255, Number(cfg.benchLongitude) || -75.09);
      var el = sun.elevation, cols = skyColors(el), horizon = H * 0.74;
      var grad = bctx.createLinearGradient(0, 0, 0, horizon);
      grad.addColorStop(0, css(cols[0]));
      grad.addColorStop(0.6, css(cols[1]));
      grad.addColorStop(1, css(cols[2]));
      bctx.fillStyle = grad;
      bctx.fillRect(0, 0, W, H);

      var starAlpha = Math.max(0, Math.min(1, (-el - 4) / 8));        // stars
      if (starAlpha > 0) {
        var seed = 7;
        var rnd = function () { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
        for (var i = 0; i < 140; i++) {
          var sx = rnd() * W, sy = rnd() * horizon * 0.9, r = rnd() * 1.3 + 0.3;
          bctx.fillStyle = 'rgba(255,255,245,' + (starAlpha * (0.35 + rnd() * 0.65)).toFixed(2) + ')';
          bctx.beginPath(); bctx.arc(sx, sy, r, 0, Math.PI * 2); bctx.fill();
        }
      }
      if (el > -7 && el < 38) {                                        // sun and its glow
        var sunX = W * (sun.morning ? 0.24 : 0.78), sunY = horizon - (el / 38) * horizon * 0.8;
        var glow = bctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, H * 0.5);
        var warm = el < 8 ? [255, 190, 120] : [255, 244, 214];
        glow.addColorStop(0, css(warm, 0.75));
        glow.addColorStop(0.25, css(warm, 0.22));
        glow.addColorStop(1, css(warm, 0));
        bctx.fillStyle = glow;
        bctx.fillRect(0, 0, W, horizon + 4);
        bctx.fillStyle = el < 8 ? '#ffe3b0' : '#fffbe8';
        bctx.beginPath(); bctx.arc(sunX, sunY, Math.max(14, W * 0.035), 0, Math.PI * 2); bctx.fill();
      }

      var light = Math.max(0, Math.min(1, (el + 8) / 20));             // hills, far to near
      var hillDark = mix([4, 14, 16], [10, 52, 44], light);
      for (var layer = 0; layer < 3; layer++) {
        var c = mix(cols[2], hillDark, 0.5 + layer * 0.25);
        if (season === 'winter') c = mix(c, mix([70, 80, 100], [214, 224, 236], light), 0.55 - layer * 0.08); // snow on the hills
        else if (season === 'fall') c = mix(c, mix([40, 22, 10], [128, 72, 30], light), 0.3);              // turning trees
        bctx.fillStyle = css(c);
        bctx.beginPath();
        bctx.moveTo(0, H);
        for (var x = 0; x <= W; x += 6) bctx.lineTo(x, hillY(x, layer));
        bctx.lineTo(W, hillY(W, layer));
        bctx.lineTo(W, H);
        bctx.closePath();
        bctx.fill();
      }

      var bx = W * 0.7, by = hillY(bx, 2), u = Math.max(1.6, W / 260); // the empty bench
      bctx.fillStyle = css(mix(hillDark, [0, 0, 0], 0.55));
      bctx.fillRect(bx - 14 * u, by - 9 * u, 28 * u, 1.8 * u);         // seat
      bctx.fillRect(bx - 14 * u, by - 17 * u, 28 * u, 1.6 * u);        // back, top rail
      bctx.fillRect(bx - 14 * u, by - 13.6 * u, 28 * u, 1.4 * u);      // back, lower rail
      bctx.fillRect(bx - 12.5 * u, by - 17 * u, 1.5 * u, 18 * u);      // legs
      bctx.fillRect(bx + 11 * u, by - 17 * u, 1.5 * u, 18 * u);

      var scrim = bctx.createLinearGradient(0, H * 0.3, 0, H);         // keeps the words readable
      scrim.addColorStop(0, 'rgba(3,18,26,0)');
      scrim.addColorStop(1, 'rgba(3,18,26,0.55)');
      bctx.fillStyle = scrim;
      bctx.fillRect(0, 0, W, H);

      var chip = $('sky-phase');
      if (chip) chip.textContent = 'Over the bench right now: ' + phaseName(sun) + ' · ' + SEASON_NAMES[season];
    }

    function frame(now) {
      var t = (now - start) / 1000;
      var dt = Math.min(0.05, Math.max(0, t - lastT)); lastT = t;
      ctx.drawImage(back, 0, 0, W, H);
      if (newStar && bornT < 0 && $('salute').hidden) bornT = t;        // your new star appears once you are back
      drawVisitorStars(t);
      drawSeason(t, dt);
      var a = t * 0.2 + 2.4;                                            // one slow circle every half minute
      var sa = Math.sin(a), ca = Math.cos(a);
      var cycle = t % 16;                                              // mostly soaring; now and then a few deep wingbeats
      var power = Math.max(1 - smooth((t - 2.6) / 1.2), smooth((cycle - 11.5) / 0.7) * (1 - smooth((cycle - 14.3) / 0.9)));
      var el = sun ? sun.elevation : 30;
      var tint = el < -6 ? [0.5, 0.57, 0.78] : el < 8 ? [1.1, 0.93, 0.8] : [1, 1, 1];
      window.BigREagle.draw(ctx, {
        x: W * 0.5 + ca * W * 0.2,
        y: H * 0.16 + sa * H * 0.03,                                    // the far side of the circle sits lower in the sky
        scale: Math.min(96, Math.max(56, W * 0.165)) * (1 - 0.22 * sa), // high up and far off
        heading: Math.atan2(-sa, ca),
        bank: 0.4 * (1 - 0.5 * power) + 0.05 * Math.sin(t * 0.8),       // leans into the turn
        pitch: 0.04 + 0.1 * power,
        tilt: 0.85,                                                    // you are looking up at it
        power: power,
        phase: t * Math.PI * 2 * 1.7,
        t: t,
        headYaw: 0.4 * Math.sin(t * 0.45) * Math.sin(t * 0.13 + 1),     // looks around as it soars
        tailFan: 0.85 - 0.5 * power,
        tailTwist: 0.18 * Math.sin(t * 0.6),
        sunSide: sun && sun.morning ? -1 : 1,
        tint: tint,
        level: el < -6 ? 0.8 : 1
      });
    }

    function loop(now) {
      if (visible) frame(now);
      if (!reduceMotion) requestAnimationFrame(loop);
    }

    function resize() {
      var rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = Math.max(1, Math.round(rect.width)); H = Math.max(1, Math.round(rect.height));
      canvas.width = back.width = W * dpr; canvas.height = back.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); bctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      paintBackdrop();
      seedParticles();
      frame(performance.now());
    }

    var lastWidth = 0;
    window.addEventListener('resize', function () {                    // ignore phone address-bar height changes
      if (window.innerWidth !== lastWidth) { lastWidth = window.innerWidth; resize(); }
    });
    lastWidth = window.innerWidth;
    resize();
    setInterval(function () { paintBackdrop(); if (reduceMotion) frame(performance.now()); }, 60000);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) { visible = entries[0].isIntersecting; }).observe(canvas);
    }
    if (!reduceMotion) requestAnimationFrame(loop);
  })();

  /* =========================================================
     Talking to the Google Sheet (see backend/SETUP.md)
     ========================================================= */
  var hasBackend = !!cfg.backendUrl;
  function getStats() {
    return fetch(cfg.backendUrl + '?action=stats', { cache: 'no-store' }).then(function (r) { return r.json(); });
  }
  function post(payload) {
    return fetch(cfg.backendUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },   // keeps Apps Script happy (no preflight)
      body: JSON.stringify(payload)
    }).then(function (r) { return r.json(); });
  }
  function store(key, value) {
    try {
      if (value === undefined) return JSON.parse(localStorage.getItem(key));
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) { return null; }
  }
  function today() { var d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
  function ago(iso) {
    var mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (!isFinite(mins) || mins < 0) return '';
    if (mins < 2) return 'moments ago';
    if (mins < 60) return mins + ' minutes ago';
    var hrs = Math.round(mins / 60);
    if (hrs < 24) return hrs === 1 ? 'an hour ago' : hrs + ' hours ago';
    var days = Math.round(hrs / 24);
    return days === 1 ? 'yesterday' : days + ' days ago';
  }

  /* ---------- "I was here" ---------- */
  var hereBtn = $('here-button'), hereStatus = $('here-status');
  function showCount(count, lastVisit) {
    if (typeof count !== 'number' || count < 1) return;
    var text = String(count);
    while (text.length < 3) text = '0' + text;
    var digits = $('digits');
    digits.textContent = '';
    text.split('').forEach(function (ch) {
      var s = document.createElement('span'); s.textContent = ch; digits.appendChild(s);
    });
    $('tally-label').textContent = (count === 1 ? 'person has' : 'people have') + ' sat with Big R';
    var last = lastVisit ? ago(lastVisit) : '';
    $('tally-last').textContent = last ? 'Last visitor: ' + last : '';
    $('tally').hidden = false;
    if (window.BigRSky) window.BigRSky.setVisitors(count);
    var chip = $('visit-chip');
    chip.textContent = count.toLocaleString() + (count === 1 ? ' visitor so far' : ' visitors so far');
    chip.classList.remove('pending');                                  // its space was saved from the start, so nothing moves
    chip.removeAttribute('aria-hidden');
  }

  function salute(number) {
    var box = $('salute');
    $('salute-kicker').hidden = !number;
    $('salute-number').hidden = !number;
    if (number) $('salute-number').textContent = 'No. ' + number.toLocaleString();
    $('salute-date').textContent = new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    box.hidden = false;
    $('salute-close').focus();
    var canvas = $('salute-canvas');
    if (reduceMotion || !canvas.getContext) return;
    var ctx = canvas.getContext('2d'), dpr = Math.min(window.devicePixelRatio || 1, 2);
    var W = window.innerWidth, H = window.innerHeight, t0 = performance.now();
    canvas.width = W * dpr; canvas.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    (function fly(now) {
      var p = (now - t0) / 2600;
      ctx.clearRect(0, 0, W, H);
      if (p >= 1 || box.hidden) return;
      var ease = p * p * (3 - 2 * p);
      window.BigREagle.draw(ctx, {
        x: -W * 0.45 + ease * W * 1.9, y: H * 0.86 - ease * H * 0.8, scale: Math.min(W * 0.42, 240),
        heading: Math.PI / 2 - 0.35, bank: -0.12, pitch: 0.22, tilt: 0.35,
        power: 1, phase: p * Math.PI * 2 * 4.5, t: p * 3, tailFan: 0.4, sunSide: 1
      });
      requestAnimationFrame(fly);
    })(t0);
  }
  function closeSalute() { $('salute').hidden = true; hereBtn.focus(); }
  $('salute-close').addEventListener('click', closeSalute);

  function markSigned(number) {
    hereBtn.textContent = 'You were here';
    hereStatus.textContent = number ? 'You are visitor No. ' + number.toLocaleString() + '. Come back any time.' : 'Thank you for sitting with Ryan.';
  }
  // Testing helper: open bigrthomas.com/?reset to make this phone forget today's visit.
  if (/[?&]reset\b/.test(location.search)) {
    try { localStorage.removeItem('bigr-visit'); } catch (e) {}
    history.replaceState(null, '', location.pathname + location.hash);
  }
  var signed = store('bigr-visit');
  if (signed && signed.day === today()) markSigned(signed.number);

  hereBtn.addEventListener('click', function () {
    var prior = store('bigr-visit');
    if (prior && prior.day === today()) { salute(prior.number); return; }   // one count per phone per day
    if (!hasBackend) { store('bigr-visit', { day: today() }); markSigned(); salute(); return; }
    hereBtn.disabled = true;
    hereStatus.textContent = 'Signing you in…';
    post({ action: 'visit' }).then(function (res) {
      if (!res || !res.ok) throw new Error('visit failed');
      store('bigr-visit', { day: today(), number: res.count });
      if (window.BigRSky) window.BigRSky.addMine(res.count);
      showCount(res.count, new Date().toISOString());
      markSigned(res.count);
      salute(res.count);
    }).catch(function () {
      hereStatus.textContent = 'The counter could not be reached. Check your signal and tap again.';
    }).then(function () { hereBtn.disabled = false; });
  });

  /* ---------- Lightbox (shared by both galleries) ---------- */
  var box = $('lightbox'), boxImg = box.querySelector('img'), boxCap = $('lightbox-caption'), lastFocus = null;
  function openPhoto(src, caption, from) {
    lastFocus = from; boxImg.src = src; boxImg.alt = caption || 'Photo'; boxCap.textContent = caption || '';
    box.hidden = false; $('lightbox-close').focus();
  }
  function closePhoto() { box.hidden = true; if (lastFocus) lastFocus.focus(); }
  $('lightbox-close').addEventListener('click', closePhoto);
  box.addEventListener('click', function (e) { if (e.target === box) closePhoto(); });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (!box.hidden) closePhoto(); else if (!$('salute').hidden) closeSalute();
  });
  function addTile(grid, src, caption, fallbackSrc, label) {
    var b = document.createElement('button'); b.type = 'button';
    var im = document.createElement('img'); im.loading = 'lazy'; im.alt = caption || 'Photo';
    if (fallbackSrc) im.onerror = function () { im.onerror = null; im.src = fallbackSrc; };
    im.src = src; b.appendChild(im);
    if (label) { var w = document.createElement('span'); w.className = 'who'; w.textContent = label; b.appendChild(w); }
    b.addEventListener('click', function () { openPhoto(im.currentSrc || im.src, caption, b); });
    grid.appendChild(b);
  }

  /* ---------- The view from the bench (visitor photos) ---------- */
  function showViewPhotos(photos) {
    var grid = $('view-gallery');
    grid.textContent = '';
    (photos || []).forEach(function (p) {
      var when = p.date ? new Date(p.date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '';
      var label = [p.name, when].filter(Boolean).join(' · ');
      var src = p.url || ('https://drive.google.com/thumbnail?id=' + encodeURIComponent(p.id) + '&sz=w1200');
      var alt = p.url ? null : ('https://lh3.googleusercontent.com/d/' + encodeURIComponent(p.id) + '=w1200');
      addTile(grid, src, 'The view from Ryan’s bench' + (label ? ' · ' + label : ''), alt, label);
    });
  }

  if (hasBackend) {
    $('view').hidden = false;
    getStats().then(function (res) {
      if (!res || !res.ok) return;
      showCount(res.count, res.lastVisit);
      showViewPhotos(res.photos);
    }).catch(function () { /* the page works without the counter */ });
  }

  var photoInput = $('photo-input'), uploadStatus = $('upload-status'), pending = null;
  function resetUpload() {
    pending = null; photoInput.value = '';
    $('upload-step').hidden = true; $('photo-pick').hidden = false;
  }
  photoInput.addEventListener('change', function () {
    var file = photoInput.files && photoInput.files[0];
    if (!file) return;
    uploadStatus.textContent = 'Getting your photo ready…';
    var img = new Image(), url = URL.createObjectURL(file);
    img.onload = function () {
      var scale = Math.min(1, 1600 / Math.max(img.width, img.height));   // shrink, and drop location data
      var c = document.createElement('canvas');
      c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      pending = c.toDataURL('image/jpeg', 0.82);
      $('photo-preview').src = pending;
      $('upload-step').hidden = false; $('photo-pick').hidden = true;
      uploadStatus.textContent = '';
    };
    img.onerror = function () {
      URL.revokeObjectURL(url); resetUpload();
      uploadStatus.textContent = 'That file could not be opened as a photo. Try another one.';
    };
    img.src = url;
  });
  $('photo-cancel').addEventListener('click', function () { resetUpload(); uploadStatus.textContent = ''; });
  $('upload-form').addEventListener('submit', function (e) {
    e.preventDefault();
    if (!pending) return;
    var send = $('photo-send');
    send.disabled = true;
    uploadStatus.textContent = 'Sending your photo…';
    post({ action: 'photo', name: $('photo-name').value.trim(), image: pending.split(',')[1] }).then(function (res) {
      if (!res || !res.ok) throw new Error((res && res.error) || 'upload failed');
      resetUpload();
      uploadStatus.textContent = 'Thank you. Your photo will appear here once Ryan’s family has looked at it.';
    }).catch(function (err) {
      uploadStatus.textContent = err && err.message === 'full'
        ? 'The bench has had a lot of photos today. Please try again tomorrow.'
        : 'The photo could not be sent. Check your signal and try again.';
    }).then(function () { send.disabled = false; });
  });

  /* ---------- Bench details, family photos, links, sharing ---------- */
  if (cfg.parkName && $('bench-text')) {
    $('bench-text').textContent = 'Ryan’s bench in ' + cfg.parkName +
      ' was built by the people who love him, as a place to rest, look around, and think of him. Sit as long as you like.';
  }
  if (cfg.benchPhoto) {
    var fig = $('bench-photo'), benchImg = fig.querySelector('img');
    benchImg.onload = function () { fig.hidden = false; };
    benchImg.src = cfg.benchPhoto;
  }
  if (cfg.benchMapLink) {
    var dir = $('bench-directions');
    dir.href = cfg.benchMapLink; dir.target = '_blank'; dir.rel = 'noopener'; dir.hidden = false;
  }
  if (cfg.memoryLink && $('memory-link')) $('memory-link').href = cfg.memoryLink;
  if (cfg.donateLink && $('donate-link')) $('donate-link').href = cfg.donateLink;

  var family = (cfg.photos || []).filter(function (p) { return p && p.file; });
  if (family.length) {
    family.forEach(function (p) { addTile($('gallery'), p.file, p.caption || 'Photo of Ryan'); });
    $('gallery-section').hidden = false;
  }

  if ($('share-button')) $('share-button').addEventListener('click', function () {
    var url = location.origin + location.pathname, status = $('share-status');
    var data = { title: 'Big R’s bench', text: 'I just met Ryan “Big R” Thomas.', url: url };
    if (navigator.share) {
      navigator.share(data).catch(function () {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(function () { status.textContent = 'Link copied.'; }, function () { status.textContent = url; });
    } else {
      status.textContent = url;
    }
  });
})();
