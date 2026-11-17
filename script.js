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

  (function sky() {
    var canvas = $('sky-canvas');
    if (!canvas || !canvas.getContext) return;
    var ctx = canvas.getContext('2d');
    var back = document.createElement('canvas'), bctx = back.getContext('2d');
    var W = 0, H = 0, dpr = 1, sun = null, visible = true, start = performance.now();

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
      if (chip) chip.textContent = 'Over the bench right now: ' + phaseName(sun);
    }

    function frame(now) {
      var t = (now - start) / 1000;
      ctx.drawImage(back, 0, 0, W, H);
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
