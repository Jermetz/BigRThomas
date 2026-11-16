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
  /* ---------- Sound: rain, the crack of lightning, rolling thunder ----------
     Made on the fly with the Web Audio API, so there are no sound files.
     Phones only allow sound after a tap, so the first tap anywhere on the page
     turns it on; the button in the storm does the same and also mutes it.
     It plays only while the storm is on screen and fades out when you scroll past. */
  var audio = null, wantSound = true, soundInView = false;
  var soundBtn = document.getElementById('storm-sound');
  function noiseBuffer(ac, seconds, brown) {
    var len = Math.round(ac.sampleRate * seconds), buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0), last = 0;
    for (var i = 0; i < len; i++) {
      var w = Math.random() * 2 - 1;
      if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w;
    }
    return buf;
  }
  function startAudio() {
    if (audio) { audio.ctx.resume(); return; }
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    var ac = new AC(), master = ac.createGain();
    master.gain.value = 0;
    master.connect(ac.destination);
    var white = noiseBuffer(ac, 3, false), brown = noiseBuffer(ac, 6, true);
    var rain = ac.createBufferSource(); rain.buffer = white; rain.loop = true;      // steady rain
    var rainHi = ac.createBiquadFilter(); rainHi.type = 'highpass'; rainHi.frequency.value = 900;
    var rainLo = ac.createBiquadFilter(); rainLo.type = 'lowpass'; rainLo.frequency.value = 7000;
    var rainGain = ac.createGain(); rainGain.gain.value = 0.085;
    rain.connect(rainHi); rainHi.connect(rainLo); rainLo.connect(rainGain); rainGain.connect(master);
    var wind = ac.createBufferSource(); wind.buffer = brown; wind.loop = true;      // low rumble of the storm
    var windLo = ac.createBiquadFilter(); windLo.type = 'lowpass'; windLo.frequency.value = 260;
    var windGain = ac.createGain(); windGain.gain.value = 0.5;
    wind.connect(windLo); windLo.connect(windGain); windGain.connect(master);
    rain.start(); wind.start();
    audio = { ctx: ac, master: master, white: white, brown: brown };
    updateSound();
  }
  function thunder() {
    if (!audio || !wantSound || !soundInView || audio.ctx.state !== 'running') return;
    var ac = audio.ctx, now = ac.currentTime;
    var crack = ac.createBufferSource(); crack.buffer = audio.white;               // the sharp crack of the bolt
    var crackHp = ac.createBiquadFilter(); crackHp.type = 'highpass'; crackHp.frequency.value = 1400;
    var crackGain = ac.createGain();
    crackGain.gain.setValueAtTime(0, now);
    crackGain.gain.linearRampToValueAtTime(0.55, now + 0.006);
    crackGain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    crack.connect(crackHp); crackHp.connect(crackGain); crackGain.connect(audio.master);
    crack.start(now, Math.random() * 2, 0.5);
    var delay = rand(0.15, 0.9), len = rand(3.5, 6);                              // sound arrives after the light
    var roll = ac.createBufferSource(); roll.buffer = audio.brown;                // the long rolling boom
    var rollLp = ac.createBiquadFilter(); rollLp.type = 'lowpass';
    rollLp.frequency.setValueAtTime(900, now + delay);
    rollLp.frequency.exponentialRampToValueAtTime(110, now + delay + len);
    var rollGain = ac.createGain(), t = now + delay;
    rollGain.gain.setValueAtTime(0, now);
    rollGain.gain.linearRampToValueAtTime(1.4, t + 0.08);
    for (var k = 1; k <= 4; k++) {                                               // it rumbles in waves as it fades
      var at = t + len * k / 5;
      rollGain.gain.linearRampToValueAtTime(rand(0.35, 1.1) * (1 - k / 5.5), at);
    }
    rollGain.gain.linearRampToValueAtTime(0, t + len);
    roll.connect(rollLp); rollLp.connect(rollGain); rollGain.connect(audio.master);
    roll.start(now, Math.random() * 1.5, delay + len + 0.1);
  }
  function updateSound() {
    if (soundBtn) {
      soundBtn.textContent = wantSound && audio ? 'Turn off the storm sound' : 'Hear the storm';
      soundBtn.setAttribute('aria-pressed', String(!!(wantSound && audio)));
    }
    if (!audio) return;
    var on = wantSound && soundInView, g = audio.master.gain, now = audio.ctx.currentTime;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(on ? 0.9 : 0, now + (on ? 1.5 : 0.8));             // fade in, or fade away
    if (on) audio.ctx.resume();
    else setTimeout(function () { if (!(wantSound && soundInView) && audio.ctx.state === 'running') audio.ctx.suspend(); }, 900);
  }
  if (soundBtn) {
    soundBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (!audio) { wantSound = true; startAudio(); }
      else { wantSound = !wantSound; updateSound(); }
      updateSound();
    });
  }
  function firstTap(e) {                                                         // any tap on the page unlocks sound
    if (soundBtn && e && e.target && soundBtn.contains(e.target)) return;        // the button handles itself
    document.removeEventListener('pointerup', firstTap, true);
    document.removeEventListener('keydown', firstTap, true);
    if (!audio && wantSound) startAudio();
  }
  document.addEventListener('pointerup', firstTap, true);
  document.addEventListener('keydown', firstTap, true);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (e) {
      soundInView = e[0].isIntersecting;
      updateSound();
    }, { threshold: 0.35 }).observe(section);
  }

  function strike() {
    thunder();
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
  window.BigRStorm = {
    strike: strike,
    sound: function () { return audio ? { state: audio.ctx.state, volume: +audio.master.gain.value.toFixed(2), on: wantSound, inView: soundInView } : null; }
  };   // lets the family trigger a strike when checking the page
  requestAnimationFrame(loop);
})();
