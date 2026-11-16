/* The bald eagle: a small 3D model built feather by feather and drawn fresh
   every frame, so it can soar, bank, flap, fan its tail and turn its head.

   What it copies from real bald eagles:
   - soars on wings held flat "like a board", rock steady, with the long
     wingtip feathers spread like fingers and curling up under load
   - a big white head that projects well ahead of the wings; white fan tail
   - slow, deep, powerful wingbeats: the wing extends on the way down and
     folds at the wrist on the way up, and the beat travels out to the tip
   - banks into its circle; steers with small twists of the tail

   Units: 1 = half the wingspan. Axes for the bird: x right, y up, z forward. */
(function () {
  'use strict';
  var sin = Math.sin, cos = Math.cos, PI = Math.PI;
  function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
  function mul(a, k) { return [a[0] * k, a[1] * k, a[2] * k]; }
  function mix(a, b, t) { return a + (b - a) * t; }
  function mix3(a, b, t) { return [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)]; }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function unit(a) { var l = Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
  function tone(c, k) { return [c[0] * k, c[1] * k, c[2] * k]; }

  var BROWN = [66, 43, 27], DARK = [44, 29, 18], COVERT = [104, 72, 46], BODY = [58, 38, 24];
  var WHITE = [250, 248, 240], YELLOW = [242, 178, 30];

  /* ---------- one wing (built as the right wing; mirrored for the left) ---------- */
  function buildWing(pose, mirror, out) {
    var lengths = [0.27, 0.27, 0.13];                 // upper arm, forearm, hand
    var lead = [0.11, 0.125, 0.10, 0.05], trail = [0.21, 0.245, 0.22, 0.15];
    var cuts = [3, 3, 2];
    var P = [0.07, 0.035, 0.05], seg = [], i, k;
    var joints = [P];
    for (i = 0; i < 3; i++) {
      var th = pose.lift[i], sw = pose.sweep[i];
      var d = [cos(th) * cos(sw), sin(th), -cos(th) * sin(sw)];
      seg.push({ d: d, c: [sin(sw), 0, cos(sw)] });
      P = add(P, mul(d, lengths[i]));
      joints.push(P);
    }
    function chordAt(j) {                              // blend chord direction across joints
      if (j === 0) return seg[0].c;
      if (j === 3) return seg[2].c;
      return unit(add(seg[j - 1].c, seg[j].c));
    }
    function push(pts, color) {
      if (mirror) pts = pts.map(function (p) { return [-p[0], p[1], p[2]]; });
      out.push({ pts: pts, color: color });
    }
    var n = 0;
    for (i = 0; i < 3; i++) {
      for (k = 0; k < cuts[i]; k++) {
        var u0 = k / cuts[i], u1 = (k + 1) / cuts[i];
        var A = mix3(joints[i], joints[i + 1], u0), B = mix3(joints[i], joints[i + 1], u1);
        var cA = unit(mix3(chordAt(i), chordAt(i + 1), u0)), cB = unit(mix3(chordAt(i), chordAt(i + 1), u1));
        var lA = mix(lead[i], lead[i + 1], u0), lB = mix(lead[i], lead[i + 1], u1);
        var tA = mix(trail[i], trail[i + 1], u0), tB = mix(trail[i], trail[i + 1], u1);
        var LA = add(A, mul(cA, lA)), LB = add(B, mul(cB, lB));
        var MA = add(A, mul(cA, -tA * 0.22)), MB = add(B, mul(cB, -tB * 0.22));
        var TA = add(A, mul(cA, -tA)), TB = add(B, mul(cB, -tB));
        TA[1] -= 0.014; TB[1] -= 0.014;               // feathers droop a touch at the back
        var tip = add(mix3(TA, TB, 0.5), mul(unit(add(cA, cB)), -0.022));
        var shade = 1 + ((n % 2) ? 0.07 : -0.05);
        push([LA, LB, MB, MA], tone(COVERT, shade));                                   // shoulder feathers
        push([MA, MB, mix3(TA, TB, 0.93), tip, mix3(TA, TB, 0.07)], tone(BROWN, shade)); // flight feather
        n++;
      }
    }
    // the seven long "finger" feathers at the wingtip
    var dH = seg[2].d, cH = seg[2].c, up = unit(cross(cH, dH));
    var longs = [0.27, 0.30, 0.30, 0.285, 0.265, 0.235, 0.20];
    for (k = 0; k < 7; k++) {
      var f = k / 6, ang = mix(-0.2, 1.12, f), len = longs[k];
      var base = add(mix3(joints[3], mix3(joints[2], joints[3], 0.2), f), mul(cH, -(0.015 + 0.105 * f)));
      var dir = unit(add(mul(dH, cos(ang)), mul(cH, -sin(ang))));
      var side = unit(cross(up, dir));
      var curl = pose.curl * (1 - 0.35 * f);
      var mid = add(add(base, mul(dir, len * 0.55)), mul(up, len * curl * 0.28));
      var end = add(add(base, mul(dir, len)), mul(up, len * curl));
      var c = tone(DARK, 1 + ((k % 2) ? 0.12 : -0.04));
      push([add(base, mul(side, -0.022)), add(base, mul(side, 0.022)), add(mid, mul(side, 0.027)), add(mid, mul(side, -0.027))], c);
      push([add(mid, mul(side, -0.027)), add(mid, mul(side, 0.027)), add(end, mul(side, 0.012)), add(end, mul(side, -0.012))], c);
    }
  }

  /* ---------- body, head and beak: rings joined into a skin ---------- */
  var RINGS = [  // z, half-width, half-height, centre height, colour of the skin running forward from here
    [-0.25, 0.030, 0.026, 0.000, BODY],
    [-0.13, 0.068, 0.062, -0.006, BODY],
    [0.02, 0.086, 0.080, -0.012, BODY],
    [0.14, 0.076, 0.072, 0.000, BODY],
    [0.200, 0.060, 0.060, 0.010, WHITE],     // white neck
    [0.245, 0.061, 0.063, 0.022, WHITE],     // back of the head
    [0.285, 0.058, 0.060, 0.029, WHITE],     // crown, over the eyes
    [0.318, 0.046, 0.050, 0.031, WHITE],     // face narrowing to the beak
    [0.340, 0.032, 0.036, 0.029, WHITE]
  ];
  // The big hooked beak. Each row: z, centre height, half-width, half-height,
  // and how far that slice has tipped over as the beak curves down into its hook.
  var BEAK_TOP = [
    [0.336, 0.031, 0.027, 0.031, 0.00],
    [0.368, 0.032, 0.025, 0.030, 0.05],
    [0.398, 0.026, 0.021, 0.027, 0.40],
    [0.421, 0.010, 0.015, 0.021, 0.90],
    [0.431, -0.012, 0.009, 0.013, 1.35],
    [0.428, -0.034, 0.002, 0.003, 1.70]
  ];
  var BEAK_LOW = [
    [0.336, -0.005, 0.020, 0.012, 0],
    [0.372, -0.009, 0.017, 0.010, 0],
    [0.403, -0.013, 0.007, 0.004, 0]
  ];
  var CERE = [247, 200, 66], BEAK = [240, 170, 22], BEAK_UNDER = [214, 146, 20];
  var HEAD_SIZE = 1.22;   // drawn a little larger than life so the head and beak read from the ground
  function turnHead(p, yaw) {
    var w = Math.max(0, Math.min(1, (p[2] - 0.2) / 0.09));
    if (!w) return p;
    var k = 1 + (HEAD_SIZE - 1) * w;
    var x = p[0] * k, y = 0.012 + (p[1] - 0.012) * k, z = (p[2] - 0.2) * k;
    var a = (yaw || 0) * w;
    return [x * cos(a) + z * sin(a), y, 0.2 - x * sin(a) + z * cos(a)];
  }
  function buildBeak(rows, colors, yaw, out) {
    var sides = 8, rings = rows.map(function (r) {
      var pts = [];
      for (var j = 0; j < sides; j++) {
        var a = j / sides * PI * 2, up = sin(a) * r[3];
        pts.push(turnHead([cos(a) * r[2], r[1] + up * cos(r[4]), r[0] + up * sin(r[4])], yaw));
      }
      return pts;
    });
    for (var i = 0; i < rings.length - 1; i++) {
      for (var j = 0; j < sides; j++) {
        var j2 = (j + 1) % sides;
        out.push({ pts: [rings[i][j], rings[i][j2], rings[i + 1][j2], rings[i + 1][j]], color: colors[Math.min(i, colors.length - 1)], bright: true });
      }
    }
  }
  // The shaggy white feathers at the back of a bald eagle's head and neck
  // ("hackles"). They are long and pointed, and lift into spikes in the wind.
  function buildHackles(yaw, ruffle, out) {
    function row(z, rx, ry, yc, count, from, to, len, lift) {
      for (var j = 0; j < count; j++) {
        var a = mix(from, to, count === 1 ? 0.5 : j / (count - 1));
        var half = (to - from) / (count - 1) * 0.62;
        var longer = (j % 2) ? 1 : 0.68;                                  // uneven lengths make it jagged
        var up = Math.max(0, sin(a));                                     // longest over the top and sides
        var L = len * longer * (0.6 + 0.4 * up), out2 = 1 + (lift * (0.6 + 0.6 * up) * (1 + ruffle)) / rx;
        var b1 = [cos(a - half) * rx, yc + sin(a - half) * ry, z];
        var b2 = [cos(a + half) * rx, yc + sin(a + half) * ry, z];
        var tip = [cos(a) * rx * out2, yc + sin(a) * ry * out2, z - L];
        out.push({ pts: [turnHead(b1, yaw), turnHead(b2, yaw), turnHead(tip, yaw)], color: tone(WHITE, (j % 2) ? 1 : 0.9), bright: true });
      }
    }
    row(0.268, 0.060, 0.062, 0.026, 7, 0.35, PI - 0.35, 0.060, 0.020);   // tuft at the back of the crown
    row(0.238, 0.062, 0.064, 0.020, 9, -0.25, PI + 0.25, 0.075, 0.016);  // back of the head
    row(0.212, 0.061, 0.061, 0.012, 12, -PI * 0.92, PI * 0.92, 0.085, 0.012); // neck ruff over the shoulders
  }
  function buildBody(pose, out) {
    buildHackles(pose.headYaw, pose.ruffle || 0, out);
    buildBeak(BEAK_TOP, [CERE, BEAK, BEAK, BEAK, BEAK], pose.headYaw, out);
    buildBeak(BEAK_LOW, [BEAK_UNDER], pose.headYaw, out);
    var sides = 10, rings = RINGS.map(function (r) {
      var pts = [];
      for (var j = 0; j < sides; j++) {
        var a = j / sides * PI * 2;
        pts.push(turnHead([cos(a) * r[1], r[3] + sin(a) * r[2], r[0]], pose.headYaw));
      }
      return pts;
    });
    for (var i = 0; i < rings.length - 1; i++) {
      for (var j = 0; j < sides; j++) {
        var j2 = (j + 1) % sides;
        out.push({ pts: [rings[i][j], rings[i][j2], rings[i + 1][j2], rings[i + 1][j]], color: RINGS[i][4] });
      }
    }
  }

  /* ---------- white fan tail ---------- */
  function buildTail(pose, out) {
    var spread = mix(0.26, 0.62, pose.tailFan), len = 0.27, tw = pose.tailTwist;
    function twist(p) { return [p[0] * cos(tw) - p[1] * sin(tw), p[0] * sin(tw) + p[1] * cos(tw), p[2]]; }
    for (var k = 0; k < 7; k++) {
      var a = mix(-spread, spread, k / 6);
      var dir = [sin(a), -0.03, -cos(a)], side = [cos(a), 0, sin(a)];
      var base = [0, 0.004, -0.2], end = add(base, mul(dir, len)), hw = len * Math.tan(spread / 6) * 1.15 + 0.006;
      var pts = [add(base, mul(side, -0.02)), add(base, mul(side, 0.02)), add(end, mul(side, hw)),
        add(base, mul(dir, len * 1.05)), add(end, mul(side, -hw))].map(twist);
      out.push({ pts: pts, color: tone(WHITE, (k % 2) ? 0.94 : 1), bright: true });
    }
  }

  /* ---------- wing position for this instant ---------- */
  function wingPose(o) {
    var ph = o.phase || 0, p = Math.max(0, Math.min(1, o.power || 0));
    var breathe = sin((o.t || 0) * 0.9) * 0.012;
    var soar = { lift: [0.035 + breathe, 0.03 + breathe, 0.07], sweep: [0, 0.02, 0.05], curl: 0.2 };
    var a1 = 0.08 + 0.62 * sin(ph);                    // the beat starts at the shoulder...
    var a2 = a1 + 0.30 * sin(ph - 0.7);                // ...and rolls out through the forearm
    var a3 = a2 + 0.42 * sin(ph - 1.3);                // ...to the hand
    var rising = Math.max(0, cos(ph));                 // wing folds at the wrist on the way up
    var flap = { lift: [a1, a2, a3], sweep: [-0.04, 0.42 * rising, 0.85 * rising], curl: 0.1 + 0.32 * Math.max(0, -cos(ph - 0.6)) };
    return {
      lift: [mix(soar.lift[0], flap.lift[0], p), mix(soar.lift[1], flap.lift[1], p), mix(soar.lift[2], flap.lift[2], p)],
      sweep: [mix(soar.sweep[0], flap.sweep[0], p), mix(soar.sweep[1], flap.sweep[1], p), mix(soar.sweep[2], flap.sweep[2], p)],
      curl: mix(soar.curl, flap.curl, p)
    };
  }

  /* ---------- draw ----------
     o: x, y (screen centre), scale (pixels per half wingspan), heading (0 = flying away,
        PI/2 = flying right, PI = toward you), bank, pitch, tilt (how far you are looking up),
        power (0 soaring .. 1 flapping), phase (wingbeat angle), t (seconds),
        headYaw, tailFan (0..1), tailTwist, sunSide (-1 left, 1 right), tint [r,g,b], level */
  function draw(ctx, o) {
    var polys = [], wp = wingPose(o);
    buildWing(wp, false, polys);
    buildWing(wp, true, polys);
    buildBody({ headYaw: o.headYaw || 0, ruffle: 0.25 * sin((o.t || 0) * 2.3) + 0.35 * (o.power || 0) }, polys);  // feathers stir in the wind
    buildTail({ tailFan: o.tailFan == null ? 0.8 : o.tailFan, tailTwist: o.tailTwist || 0 }, polys);

    var cb = cos(o.bank || 0), sb = sin(o.bank || 0), cp = cos(o.pitch || 0), sp = sin(o.pitch || 0);
    var ch = cos(o.heading || 0), sh = sin(o.heading || 0), ct = cos(o.tilt || 0), st = sin(o.tilt || 0);
    function toCamera(p) {
      var x = p[0], y = p[1] * cp + p[2] * sp, z = -p[1] * sp + p[2] * cp;   // nose up
      var x2 = x * cb - y * sb, y2 = x * sb + y * cb;                         // bank
      var x3 = x2 * ch + z * sh, z3 = -x2 * sh + z * ch;                      // heading
      return [x3, y2 * ct - z3 * st, y2 * st + z3 * ct];                      // looking up at it
    }
    var bob = sin(o.phase || 0) * 0.03 * (o.power || 0);
    var light = unit([0.5 * (o.sunSide || 1), 0.8, -0.38]);
    var tint = o.tint || [1, 1, 1], level = o.level == null ? 1 : o.level;

    var faces = polys.map(function (poly) {
      var cam = poly.pts.map(toCamera), depth = 0, i;
      for (i = 0; i < cam.length; i++) depth += cam[i][2];
      var nrm = unit(cross([cam[1][0] - cam[0][0], cam[1][1] - cam[0][1], cam[1][2] - cam[0][2]],
        [cam[2][0] - cam[0][0], cam[2][1] - cam[0][1], cam[2][2] - cam[0][2]]));
      if (nrm[2] > 0) nrm = [-nrm[0], -nrm[1], -nrm[2]];                     // face the viewer
      var lit = Math.max(0, nrm[0] * light[0] + nrm[1] * light[1] + nrm[2] * light[2]);
      var shade = 0.6 + 0.55 * lit + 0.1 * Math.max(0, -nrm[1]);
      if (poly.color === WHITE || poly.bright) shade = Math.max(shade, 0.92);   // head and tail stay bright white
      shade *= level;
      return { cam: cam, depth: depth / cam.length, rgb: [poly.color[0] * shade * tint[0], poly.color[1] * shade * tint[1], poly.color[2] * shade * tint[2]] };
    });
    faces.sort(function (a, b) { return b.depth - a.depth; });               // far feathers first

    var s = o.scale, ox = o.x, oy = o.y - bob * s;
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(0.6, s * 0.006);
    for (var f = 0; f < faces.length; f++) {
      var face = faces[f], c = face.rgb;
      var col = 'rgb(' + Math.min(255, c[0] | 0) + ',' + Math.min(255, c[1] | 0) + ',' + Math.min(255, c[2] | 0) + ')';
      ctx.beginPath();
      for (var v = 0; v < face.cam.length; v++) {
        var px = ox + face.cam[v][0] * s, py = oy - face.cam[v][1] * s;
        if (v) ctx.lineTo(px, py); else ctx.moveTo(px, py);
      }
      ctx.closePath();
      ctx.fillStyle = col; ctx.strokeStyle = col;
      ctx.fill(); ctx.stroke();
    }
    var yaw = o.headYaw || 0, centre = toCamera(turnHead([0, 0.03, 0.3], yaw));
    function at(p) { var c = toCamera(turnHead(p, yaw)); return [ox + c[0] * s, oy - c[1] * s, c[2]]; }
    for (var e = -1; e <= 1; e += 2) {                                         // eyes, when that side faces you
      var eye = at([e * 0.052, 0.036, 0.302]);
      if (eye[2] > centre[2] - 0.012) continue;
      var r = Math.max(1, s * 0.0165);
      ctx.beginPath(); ctx.arc(eye[0], eye[1], r, 0, PI * 2);                  // pale yellow eye
      ctx.fillStyle = '#f4d35e'; ctx.fill();
      ctx.beginPath(); ctx.arc(eye[0], eye[1], r * 0.55, 0, PI * 2);           // pupil
      ctx.fillStyle = '#17100a'; ctx.fill();
      var browBack = at([e * 0.058, 0.060, 0.272]), browFront = at([e * 0.043, 0.046, 0.33]);
      ctx.beginPath(); ctx.moveTo(browBack[0], browBack[1]); ctx.lineTo(browFront[0], browFront[1]);
      ctx.strokeStyle = 'rgba(70,52,38,0.85)';                                 // the heavy brow that gives the stern look
      ctx.lineWidth = Math.max(0.9, s * 0.011); ctx.lineCap = 'round'; ctx.stroke();
    }
    var gapeBack = at([0, 0.006, 0.34]), gapeFront = at([0, -0.002, 0.415]);  // line where the beak closes
    ctx.beginPath(); ctx.moveTo(gapeBack[0], gapeBack[1]); ctx.lineTo(gapeFront[0], gapeFront[1]);
    ctx.strokeStyle = 'rgba(110,70,10,0.55)'; ctx.lineWidth = Math.max(0.5, s * 0.005); ctx.stroke();
    ctx.restore();
  }

  window.BigREagle = { draw: draw };
})();
