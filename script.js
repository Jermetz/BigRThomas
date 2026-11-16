(function () {
  var cfg = window.SITE || {};
  var $ = function (id) { return document.getElementById(id); };

  // ---- Bench details from site-config.js ----
  if (cfg.parkName) {
    $('bench-text').textContent = 'A bench in ' + cfg.parkName +
      ' carries a plaque honoring Ryan “Big R” Thomas. It was built by the people who love him as a place to rest, look around, and think of him. Sit as long as you like.';
  }
  if (cfg.benchPhoto) {
    var fig = $('bench-photo');
    var img = fig.querySelector('img');
    img.onload = function () { fig.hidden = false; };
    img.src = cfg.benchPhoto;
  }
  if (cfg.benchMapLink) {
    var dir = $('bench-directions');
    dir.href = cfg.benchMapLink;
    dir.target = '_blank';
    dir.rel = 'noopener';
    dir.hidden = false;
  }

  // ---- Links ----
  document.querySelectorAll('a').forEach(function (a) {
    var label = a.textContent.trim();
    if (label === 'Share a memory' && cfg.memoryLink) a.href = cfg.memoryLink;
    if (label === "Donate in Ryan's honor" && cfg.donateLink) a.href = cfg.donateLink;
  });

  // ---- Candle (remembered on this device only) ----
  var candle = $('candle'), candleBtn = $('candle-button'), candleStatus = $('candle-status');
  function lit() {
    try { return localStorage.getItem('bigr-candle') === '1'; } catch (e) { return false; }
  }
  function showLit() {
    candle.dataset.lit = 'true';
    candleStatus.textContent = 'Your candle is burning for Ryan.';
    candleBtn.hidden = true;
  }
  if (lit()) showLit();
  candleBtn.addEventListener('click', function () {
    try { localStorage.setItem('bigr-candle', '1'); } catch (e) {}
    showLit();
  });

  // ---- Share this page ----
  var shareBtn = $('share-button'), shareStatus = $('share-status');
  shareBtn.addEventListener('click', function () {
    var url = location.origin + location.pathname;
    var data = { title: 'Ryan "Big R" Thomas', text: 'Remembering Ryan "Big R" Thomas', url: url };
    if (navigator.share) {
      navigator.share(data).catch(function () {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(
        function () { shareStatus.textContent = 'Link copied.'; },
        function () { shareStatus.textContent = url; }
      );
    } else {
      shareStatus.textContent = url;
    }
  });

  // ---- Photo gallery ----
  var photos = (cfg.photos || []).filter(function (p) { return p && p.file; });
  if (photos.length) {
    var grid = $('gallery'), box = $('lightbox');
    var boxImg = box.querySelector('img'), boxCap = $('lightbox-caption'), lastFocus = null;
    photos.forEach(function (p) {
      var b = document.createElement('button');
      b.type = 'button';
      var im = document.createElement('img');
      im.src = p.file; im.loading = 'lazy'; im.alt = p.caption || 'Photo of Ryan';
      b.appendChild(im);
      b.addEventListener('click', function () {
        lastFocus = b;
        boxImg.src = p.file; boxImg.alt = im.alt;
        boxCap.textContent = p.caption || '';
        box.hidden = false;
        $('lightbox-close').focus();
      });
      grid.appendChild(b);
    });
    var close = function () { box.hidden = true; if (lastFocus) lastFocus.focus(); };
    $('lightbox-close').addEventListener('click', close);
    box.addEventListener('click', function (e) { if (e.target === box) close(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !box.hidden) close(); });
    $('gallery-section').hidden = false;
  }
})();
