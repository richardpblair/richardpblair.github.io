let initialized = false;

export function initBGNet() {
  if (initialized) return;
  const canvas = document.getElementById('bg-net');
  if (!canvas) return;

  const lowPowerQuery = window.matchMedia('(max-width: 480px), (pointer: coarse)');
  if (lowPowerQuery.matches) {
    canvas.dataset.bgNetDisabled = 'true';
    return;
  }

  if (document.visibilityState === 'hidden') {
    const onVisible = () => {
      document.removeEventListener('visibilitychange', onVisible);
      initBGNet();
    };
    document.addEventListener('visibilitychange', onVisible, { once: true });
    return;
  }

  initialized = true;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return;
  }

  // === NEW: perf helpers ===
  const DPR = Math.min(window.devicePixelRatio || 1, 1.5);   // clamp DPI
  
  // ========================== TUNING PANEL ==========================
  const CONFIG = {
    density: 0.00007,         // overall dot count (per pixel)
    layers: [                 // depth layers (front first)
      { speed: 0.70, size: [1.6, 2.4], linkDist: 160, linkAlpha: 0.30 },
      { speed: 0.45, size: [1.5, 2.1], linkDist: 140, linkAlpha: 0.24 },
      { speed: 0.30, size: [1.3, 1.8], linkDist: 120,  linkAlpha: 0.20 }
    ],
    fieldScale: 0.005,        // flow field "frequency" (lower = broader waves)
    fieldSpeed: 0.00025,      // how fast the field moves through time
    parallax: 0.45,            // mouse sway
    dotColorA: '#FFD166',     // gradient start
    dotColorB: '#F5B000',     // gradient end
    lineColor: '#FFDF8A',     // ALPHA replaced dynamically
    glow: 14,                 // shadowBlur for glowing dots/lines (0 to disable)
    containToRegion: true,    // keep particles inside region
    drawTriangles: false,     // set true to add triangle mesh accents
    triangleAlpha: 0.05,      // opacity of triangle fill when enabled
    flowStrength: 0.05,       // you said 0.05 — this is the multiplier for fx/fy
    damping: 0.99,            // 0.96–0.99; higher = smoother
    jitter: 0.002,            // set to 0.001–0.003 if you want subtle randomness
    containMode: 'wrapX',     // 'wrapX' wraps left↔right; 'wrap' wraps both axes
    wallMargin: 10,           // only used by 'steer' (Option B)
    wallForce: 0.1,          // only used by 'steer' (Option B)
    maxSpeed: 0.55,            // how fast are the particles moving
    keepConnected: true,      // turn on nearest-neighbor fallback
    kNearest: 1,              // guarantee up to 2 links per particle
    minLinkAlpha: 0.16,       // floor opacity so fallbacks are visible
    extraReach: 10,           // optional +reach for fallback links (px)
    // --- depth setting ---
    depthEnabled: true,
    depthSizeRange: [0.70, 2.00], // multiply particle radius by lerp(min,max,z)
    depthAlphaRange: [0.45, 1.00],// fade distant dots a bit
    depthBlurMax: 2.2,            // max px blur for farthest dots (0 = off)
    depthLinkWidth: [0.6, 2.6],   // line width range (far→near)
    depthLinkAlphaBoost: 0.25,    // add up to +0.15 alpha for very near links
    depthSpeedScale: [0.85, 1.12], // optional: near = a hair faster
    // Distribution: >1 biases toward NEAR (more large close dots)
    depthZBias: 1.8,
    // Parallax (camera-ish feel)
    parallaxEnabled: true,
    parallaxStrength: 50,   // px shift for z=1 at screen edge
    parallaxFollow: 0.10,   // smoothing (0.04–0.12 feels nice)
    // --- twinkle settings ---
    twinkleEnabled: true,     // master switch
    twinkleSpeed: 6.0,        // how fast they shimmer (Hz)
    twinkleDepthBoost: 0.99,   // extra sparkle for near (z=1)
    twinkleIntensity: 0.45,    // 0.2–0.5 is subtle, >0.6 is flashy
    // --- metallic specular settings ---
    lightDir: { x: -0.6, y: -0.4 }, // direction the "light" comes from (left/up)
    specularSize: 1.5,             // highlight radius as a factor of particle radius
    specularScale: 0.65,            // how bright the specular can get (0.3–0.8)
    specularWarmth: 0.15,           // adds a hint of warm gold into the highlight
    // optional sparkle “star” on peak twinkles
    sparkleThreshold: 0.92,         // trigger when twinkle > 92%
    sparkleSize: 2.0,               // star arm length factor (× particle radius)
    // --- link runners (data packets) ---
    runnersEnabled: true,  // master switch
    runnersPerLink: 1.5,     // 1–2 keeps it tasteful
    runnerSpeed: 0.85,     // higher = faster travel along lines
    runnerSize: 6.0,       // base radius in px (depth scales it)
    runnerGlow: 8,         // shadowBlur for glow
    runnerColor: '#FFD44D',// warm gold streak
    runnerTail: 0.16,       // 0.08–0.16 fraction of the link as a “streak”
    runnersEnabled: window.innerWidth >= 768, // off on mobile
    twinkleEnabled: window.innerWidth >= 768, // off on mobile
  
  };
  
  // Respect prefers-reduced-motion (force calm mode)
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) {
    CONFIG.runnersEnabled = false;
    CONFIG.twinkleEnabled = false;
    CONFIG.glow = Math.min(CONFIG.glow, 6);
    CONFIG.layers.forEach(l => { l.linkDist = Math.min(l.linkDist, 110); });
  }
  
  
  // Region modes: 'full' | 'right' | 'topRight' | 'custom'
  let regionMode = 'right';
  const customRegionPercents = { xMin: 0.6, xMax: 1.0, yMin: 0.00, yMax: 1.0 };
  
  // ======================== INTERNAL STATE ==========================
  let W, H, rafId = 0, t = 0, lastTs = 0;
  const pauseReasons = new Set();
  const manualPauseKey = "manual";

  const updateLoop = () => {
    if (pauseReasons.size > 0) {
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
      return;
    }
    if (!rafId) {
      rafId = requestAnimationFrame(step);
    }
  };

  const setPaused = (reason, value) => {
    if (value) {
      pauseReasons.add(reason);
    } else {
      pauseReasons.delete(reason);
    }
    updateLoop();
  };

  let REGION = { xMin: 0, xMax: 0, yMin: 0, yMax: 0 };
  let particles = []; // flat array of particles across all layers
  let layerIndexOffsets = []; // where each layer starts in particles[]
  let mouse = { x: 0.7, y: 0.3, sx: 0.7, sy: 0.3 }; // screen-normalized; s* = smoothed
  addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.x = (e.clientX - r.left) / r.width;
    mouse.y = (e.clientY - r.top) / r.height;
  });
  
  // ------------------------- Utilities ------------------------------
  const rand = (min, max) => Math.random() * (max - min) + min;
  const pairRand = (i, j) => {
    const s = Math.sin(i * 12.9898 + j * 78.233 + 0.1234);
    return Math.abs(s) % 1;
  };
  
      // Deterministic seed per pair, stable over frames
  function pairSeed(a, b) {
    // swap-safe key: combine indexes
    const x = Math.min(a,b), y = Math.max(a,b);
    // simple hash → 0..1
    const s = Math.sin(x * 12.345 + y * 98.765) * 43758.5453;
    return Math.abs(s % 1);
  }
  
  // 0..1 linear interpolation helper
  const lerp = (a, b, t) => a + (b - a) * t;
  
  // Smooth pseudo-noise (fast value noise with bilinear interpolation)
  function hash(x, y) {
    // deterministic small hash
    return Math.sin(x * 127.1 + y * 311.7) * 43758.5453 % 1;
  
  }
  function valueNoise(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi,      yf = y - yi;
    const tl = hash(xi, yi),   tr = hash(xi + 1, yi);
    const bl = hash(xi, yi + 1), br = hash(xi + 1, yi + 1);
    const u = xf * xf * (3 - 2 * xf);   // smoothstep
    const v = yf * yf * (3 - 2 * yf);
    const top = tl + u * (tr - tl);
    const bot = bl + u * (br - bl);
    return top + v * (bot - top); // 0..1
  }
  
  function flowVec(x, y, time, scale, speed) {
    // angle from noise → smooth direction
    const angle = 6.28318 * valueNoise((x + time * speed) * scale,
                                       (y - time * speed) * scale);
    return { vx: Math.cos(angle), vy: Math.sin(angle) };
  }
  
  function computeRegionPixels() {
    const pct = (() => {
      switch (regionMode) {
        case 'right':    return { xMin: 0.70, xMax: 1.00, yMin: 0.00, yMax: 1.00 };
        case 'topRight': return { xMin: 0.70, xMax: 1.00, yMin: 0.00, yMax: 0.45 };
        case 'full':     return { xMin: 0.00, xMax: 1.00, yMin: 0.00, yMax: 1.00 };
        case 'custom':   return customRegionPercents;
        default:         return { xMin: 0.70, xMax: 1.00, yMin: 0.00, yMax: 1.00 };
      }
    })();
    REGION.xMin = Math.floor(innerWidth  * pct.xMin);
    REGION.xMax = Math.floor(innerWidth  * pct.xMax);
    REGION.yMin = Math.floor(innerHeight * pct.yMin);
    REGION.yMax = Math.floor(innerHeight * pct.yMax);
  }
  
  function resize() {
  
    const isCoarse = matchMedia('(pointer: coarse)').matches;
    const DPR_CAP = isCoarse ? 1.25 : 1.75;   // tighter on phones/tablets
    const dpr = Math.min(DPR_CAP, Math.max(1, devicePixelRatio || 1));
  
    W = canvas.width  = Math.floor(innerWidth  * DPR);
    H = canvas.height = Math.floor(innerHeight * DPR);
    canvas.style.width = innerWidth + 'px';
    canvas.style.height = innerHeight + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  
    computeRegionPixels();
  
    // Adaptive density (giant windows get fewer particles)
    const px = innerWidth * innerHeight;
    let density = CONFIG.density;
    if (px > 2_000_000) density *= 0.85;
    if (px > 3_500_000) density *= 0.70;
  
    // build particles by layers
    particles = [];
    layerIndexOffsets = [];
    const totalCount = Math.max(8, Math.floor(innerWidth * innerHeight * density));
    const layerWeights = CONFIG.layers.map((_, i) => 1 / (i + 1));
    const weightSum = layerWeights.reduce((a, b) => a + b, 0);
  
    let idx = 0;
    CONFIG.layers.forEach((layer, i) => {
      const count = Math.max(8, Math.floor(totalCount * (layerWeights[i] / weightSum)));
      layerIndexOffsets.push(idx);
      for (let k = 0; k < count; k++) {
        const zb = CONFIG.depthZBias || 1;
        const z  = 1 - Math.pow(Math.random(), zb); // 0 (far) .. 1 (near)
        particles.push({
          layer: i,
          x: rand(REGION.xMin, REGION.xMax),
          y: rand(REGION.yMin, REGION.yMax),
          vx: 0, vy: 0,
          seed: Math.random() * 1000,
          z,
          r0: rand(layer.size[0], layer.size[1])
        });   
        idx++;
      }
    });
    // Sort indices by depth once (far → near) so near draws last (on top)
    drawOrder = particles.map((_, idx) => idx).sort((a, b) => particles[a].z - particles[b].z);
    // Cache gradient once per resize (instead of every frame)
    cachedGrad = null;
  }
  
  function contain(p) {
    if (!CONFIG.containToRegion) return;
  
    // --- Wrap modes ---
    if (CONFIG.containMode === 'wrap' || CONFIG.containMode === 'wrapX') {
      // horizontal wrap
      if (p.x < REGION.xMin) p.x = REGION.xMax - 1;
      else if (p.x > REGION.xMax) p.x = REGION.xMin + 1;
  
      if (CONFIG.containMode === 'wrap') {
        // vertical wrap too
        if (p.y < REGION.yMin) p.y = REGION.yMax - 1;
        else if (p.y > REGION.yMax) p.y = REGION.yMin + 1;
      } else {
        // for wrapX, just clamp vertical
        p.y = Math.min(Math.max(p.y, REGION.yMin), REGION.yMax);
      }
      return;
    }
  
    // --- Soft steer mode (Option B uses this) ---
    if (CONFIG.containMode === 'steer') {
      const m = CONFIG.wallMargin || 6;
      const f = CONFIG.wallForce  || 0.03;
      if (p.x < REGION.xMin + m) p.vx += f;
      if (p.x > REGION.xMax - m) p.vx -= f;
      if (p.y < REGION.yMin + m) p.vy += f;
      if (p.y > REGION.yMax - m) p.vy -= f;
    }
  
    // safety clamp for steer/bounce
    p.x = Math.min(Math.max(p.x, REGION.xMin), REGION.xMax);
    p.y = Math.min(Math.max(p.y, REGION.yMin), REGION.yMax);
  
    if (CONFIG.containMode === 'bounce') {
      if (p.x <= REGION.xMin || p.x >= REGION.xMax) p.vx *= -1;
      if (p.y <= REGION.yMin || p.y >= REGION.yMax) p.vy *= -1;
    }
  }
  
  
  let cachedGrad = null;
  function gradientForRegion() {
    if (!cachedGrad) {
      const g = ctx.createLinearGradient(REGION.xMin, 0, REGION.xMax, 0);
      g.addColorStop(0, CONFIG.dotColorA);
      g.addColorStop(1, CONFIG.dotColorB);
      cachedGrad = g;
    }
    return cachedGrad;
  }
  
      function drawRunner(pa, pb, tNorm, zPair, baseAlpha = 1) {
    // tNorm is 0..1 along the line from pa -> pb
    const x = lerp(pa.x, pb.x, tNorm);
    const y = lerp(pa.y, pb.y, tNorm);
  
    // Depth scaling (nearer links: slightly bigger/brighter)
    const size = (BGNet.config.runnerSize || 2) * (0.8 + 0.4 * zPair);
  
    // Optional “streak” segment around the runner
    const tailFrac = Math.max(0, BGNet.config.runnerTail || 0.10);
    const half = tailFrac * 0.5;
    const t0 = Math.max(0, tNorm - half);
    const t1 = Math.min(1, tNorm + half);
  
    // Compute tail endpoints (short bright sub-segment on the link)
    const x0 = lerp(pa.x, pb.x, t0), y0 = lerp(pa.y, pb.y, t0);
    const x1 = lerp(pa.x, pb.x, t1), y1 = lerp(pa.y, pb.y, t1);
  
    // Tail (thin bright stroke with additive blend)
    const prevComp = ctx.globalCompositeOperation;
    const prevBlur = ctx.shadowBlur;
    const prevAlpha = ctx.globalAlpha;
    ctx.globalCompositeOperation = 'lighter';
    ctx.shadowBlur = BGNet.config.runnerGlow || 8;
    ctx.globalAlpha = Math.min(1, 0.9 * baseAlpha * (0.6 + 0.6 * zPair));
    ctx.lineWidth = Math.max(1, 1.2 + 1.2 * zPair);
    ctx.strokeStyle = BGNet.config.runnerColor || '#FFE69A';
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  
    // Packet head (small glowing dot)
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fillStyle = BGNet.config.runnerColor || '#FFE69A';
    ctx.fill();
  
    // restore
    ctx.globalCompositeOperation = prevComp;
    ctx.shadowBlur = prevBlur;
    ctx.globalAlpha = prevAlpha;
  }
  
  function step(ts) {
    if (pauseReasons.size > 0) {
      rafId = 0;
      return;
    }
    const now = ts || 0;
    const dt = Math.min(0.033, (now - (lastTs || now)) * 0.001) || 0.016; // clamp @ ~30 FPS
    t = now * 0.001;  // absolute time for the field
    lastTs = now;
  
    // Smooth pointer
    const k = CONFIG.parallaxFollow || 0.08;
    mouse.sx += (mouse.x - mouse.sx) * k;
    mouse.sy += (mouse.y - mouse.sy) * k;
  
    // Parallax vector from center (-1..1)
    const vx = (mouse.sx - 0.5) * 2;
    const vy = (mouse.sy - 0.5) * 2;
  
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    ctx.globalCompositeOperation = 'source-over';
  
  
    // slight parallax shift
    const parX = vx * CONFIG.parallaxStrength * 0.5;
    const parY = vy * CONFIG.parallaxStrength * 0.5;
  
    // Glow
    ctx.shadowBlur = CONFIG.glow;
    ctx.shadowColor = 'rgba(255,223,130,0.45)';
  
    const grad = gradientForRegion();
  
    // Move & draw particles per layer (front to back for nicer overlap)
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      const L = CONFIG.layers[p.layer];
  
      // Seeded flow so neighbors don't all move as one
      const { vx: fx, vy: fy } = flowVec(
        p.x + p.seed * 13.7,
        p.y - p.seed * 9.1,
        t,
        CONFIG.fieldScale,
        CONFIG.fieldSpeed * L.speed
      );
  
      // Optional micro-jitter for extra organic motion
      if (CONFIG.jitter) {
        p.vx += (Math.random() - 0.5) * CONFIG.jitter;
        p.vy += (Math.random() - 0.5) * CONFIG.jitter;
      }
  
      // Pure flow + damping (no anchor)
      const damp = Math.pow(CONFIG.damping, dt * 60);                     // time-scaled damping
      const gain = (CONFIG.flowStrength * L.speed) * (dt * 60);           // time-scaled push
      p.vx = p.vx * damp + fx * gain;
      p.vy = p.vy * damp + fy * gain;
  
  
      // --- cap particle speed so they never accelerate indefinitely ---
      const sp = Math.hypot(p.vx, p.vy);
      if (sp > CONFIG.maxSpeed) {
        const s = CONFIG.maxSpeed / sp;
        p.vx *= s;
        p.vy *= s;
      }
  
      // Integrate
      p.x += p.vx;
      p.y += p.vy;
  
      // Keep inside region using chosen mode
      contain(p);
  
      // --- Depth-based particle drawing ---
      const z = p.z || 0;
      const [sMin, sMax] = CONFIG.depthSizeRange || [0.8, 1.6];
      const r = CONFIG.depthEnabled ? p.r0 * (sMin + (sMax - sMin) * z) : p.r0;
  
      const [aMin, aMax] = CONFIG.depthAlphaRange || [0.65, 1];
      let dotAlpha = CONFIG.depthEnabled ? (aMin + (aMax - aMin) * z) : 1;
  
      // --- Twinkle modulation ---
      if (CONFIG.twinkleEnabled) {
        const phase = (p.seed * 50.0 + t * CONFIG.twinkleSpeed) % (2 * Math.PI);
        const twinkle = 0.5 + 0.5 * Math.sin(phase);
        const nearBoost = 1 + CONFIG.twinkleDepthBoost * z;
        const twinkleAmt = 1 + CONFIG.twinkleIntensity * (twinkle * nearBoost - 0.5);
        dotAlpha *= twinkleAmt;
      }
      dotAlpha = Math.max(0, Math.min(1, dotAlpha)); // clamp 0–1
  
      // optional blur (farther = blurrier)
      const blurPx = CONFIG.depthEnabled ? (1 - z) * (CONFIG.depthBlurMax || 1.8) : 0;
      const prevFilter = ctx.filter;
      if (blurPx > 0.01) ctx.filter = `blur(${blurPx.toFixed(2)}px)`;
  
      // parallax shift: near moves more than far, away from pointer direction
      let rx = p.x, ry = p.y;
      if (CONFIG.parallaxEnabled) {
        const s = CONFIG.parallaxStrength || 18;
        const amt = (p.z - 0.5) * s;
        rx += -vx * amt;     // move opposite to pointer offset (camera-like)
        ry += -vy * amt;
      }
  
      // draw
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.globalAlpha = dotAlpha;
  
      // always paint with the gold gradient; twinkle is handled in dotAlpha
      ctx.fillStyle = grad;
  
      // ✅ draw the particle
      ctx.fill();
  
      // --- Metallic specular highlight ---
      if (CONFIG.twinkleEnabled) {
        // use twinkle for brightness modulation
        const phase = (p.seed * 50.0 + t * CONFIG.twinkleSpeed) % (2 * Math.PI);
        const twinkle = 0.5 + 0.5 * Math.sin(phase);
        const zBoost = 0.75 + 0.25 * z;
        const specAmt = (twinkle * zBoost) * CONFIG.specularScale;
  
        // compute highlight center toward lightDir
        const lx = CONFIG.lightDir.x, ly = CONFIG.lightDir.y;
        const hx = p.x + r * lx * 0.4;
        const hy = p.y + r * ly * 0.4;
  
        // small radial gradient: white core → warm gold
        const g = ctx.createRadialGradient(hx, hy, 0, hx, hy, r * CONFIG.specularSize);
        g.addColorStop(0, `rgba(255,255,255,${0.20 + 0.6 * specAmt})`);
        const edgeG = Math.floor(210 + 40 * CONFIG.specularWarmth);
        const edgeB = Math.floor(120 + 30 * CONFIG.specularWarmth);
        g.addColorStop(1, `rgba(255,${edgeG},${edgeB},${0.08 + 0.3 * specAmt})`);
  
        // draw additively so it glows like metal
        const prevOp = ctx.globalCompositeOperation;
        const prevBlur = ctx.shadowBlur;
        ctx.globalCompositeOperation = 'lighter';
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.arc(hx, hy, r * CONFIG.specularSize, 0, Math.PI * 2);
        ctx.fillStyle = g;
        ctx.fill();
        ctx.globalCompositeOperation = prevOp;
        ctx.shadowBlur = prevBlur;
  
        // --- Tiny star on peak ---
        if (twinkle > CONFIG.sparkleThreshold) {
          const arms = 4;
          const len = r * CONFIG.sparkleSize * (0.8 + 0.3 * z);
          const alpha = 0.25 + 0.3 * (twinkle - CONFIG.sparkleThreshold) /
                        (1 - CONFIG.sparkleThreshold);
          const prevOp2 = ctx.globalCompositeOperation;
          ctx.globalCompositeOperation = 'lighter';
          ctx.lineWidth = Math.max(0.6, r * 0.35);
          ctx.strokeStyle = `rgba(255,235,170,${alpha.toFixed(3)})`;
          ctx.beginPath();
          ctx.moveTo(p.x - len, p.y); ctx.lineTo(p.x + len, p.y);
          ctx.moveTo(p.x, p.y - len); ctx.lineTo(p.x, p.y + len);
          ctx.stroke();
          ctx.globalCompositeOperation = prevOp2;
        }
      }
  
  
      // restore state
      ctx.globalAlpha = 1;
      if (blurPx > 0.01) ctx.filter = prevFilter;
  
    }
  
    // Connections (do per-layer for performance & look)
    for (let li = 0; li < CONFIG.layers.length; li++) {
      const start = layerIndexOffsets[li];
      const end   = (li + 1 < layerIndexOffsets.length) ? layerIndexOffsets[li + 1] : particles.length;
      const L = CONFIG.layers[li];
      for (let a = start; a < end; a++) {
        const pa = particles[a];
        let links = 0, maxLinks =4;  // cap per particle
        let drewAny = false;      // did we draw at least one normal link?
        let nearest = [];         // stores [distance, index] pairs
        for (let b = a + 1; b < end; b++) {
          const pb = particles[b];
          const dx = pa.x - pb.x;
          const dy = pa.y - pb.y;
          const dist = Math.hypot(dx, dy);
          if ((CONFIG.kNearest|0) > 0) {
            if (nearest.length < CONFIG.kNearest) {
              nearest.push([dist, b]);
              nearest.sort((u, v) => u[0] - v[0]); // keep sorted by distance
            } else if (dist < nearest[nearest.length - 1][0]) {
              nearest[nearest.length - 1] = [dist, b];
              nearest.sort((u, v) => u[0] - v[0]);
            }
          }
          if (dist < L.linkDist) {
            // --- Depth-based link drawing ---
            const zPair = ((pa.z || 0) + (pb.z || 0)) * 0.5;
  
            const baseAlpha = Math.max(0.06, Math.min(1, (1 - dist / L.linkDist) * (L.linkAlpha || 0.65)));
            const depthBoost = 0.50 + 0.80 * zPair;  // near => alpha
            const alpha = Math.min(1, baseAlpha *depthBoost);
            const [wFar, wNear] = CONFIG.depthLinkWidth || [0.6, 2.6];
            const width = wFar + (wNear - wFar) * zPair;
            
            const gate = Math.pow(baseAlpha, 1.5) * 0.85;
            if (pairRand(a, b) >= gate) continue;
            ctx.lineWidth = width;
            const lineColor = (window.BGNet?.config?.lineColor) || CONFIG.lineColor || '#FFDF8A';
            ctx.strokeStyle = lineColor.replace('ALPHA', alpha.toFixed(3));
            // Render positions with parallax applied
            let pax = pa.x, pay = pa.y, pbx = pb.x, pby = pb.y;
            if (CONFIG.parallaxEnabled) {
              const s = CONFIG.parallaxStrength || 18;
              const za = (pa.z - 0.5) * s, zb = (pb.z - 0.5) * s;
              pax += -vx * za; pay += -vy * za;
              pbx += -vx * zb; pby += -vy * zb;
            }
            ctx.beginPath();
            ctx.moveTo(pax, pay);
            ctx.lineTo(pbx, pby);
            ctx.stroke();
            if (CONFIG.runnersEnabled) {
              const seed = pairSeed(a, b);
              const zPair = ((pa.z || 0) + (pb.z || 0)) * 0.5;
              const spd = (CONFIG.runnerSpeed || 0.3) * (0.9 + 0.2 * zPair);
              const tNorm = (seed + t * spd) % 1;
              drawRunner(pa, pb, tNorm, zPair, alpha);
              drawRunner({x:pax,y:pay},{x:pbx,y:pby}, tNorm, zPair, alpha);
            }
  
  
            ctx.globalAlpha = 1;           // <-- keep this right after stroke()
  
            drewAny = true;  // mark that a “real” link was drawn
            if (++links >= maxLinks) break;
  
          }
        }
        if (CONFIG.keepConnected && (CONFIG.kNearest|0) > 0) {
          // how many fallback lines to add (if normal links were scarce)
          const need = Math.max(0, (CONFIG.kNearest|0) - (drewAny ? 1 : 0));
  
          for (let i = 0; i < nearest.length && i < need; i++) {
            const nbIndex = nearest[i][1];
            const pb = particles[nbIndex];
            const baseDist = nearest[i][0];
  
            // Give a little extra reach so fallback has something to connect to
            const reach = (L.linkDist || 120) + (CONFIG.extraReach || 0);
  
            // Alpha fades with distance but never below minLinkAlpha
            const distNorm = 1 - Math.min(1, baseDist / reach);
            const alpha = Math.max(CONFIG.minLinkAlpha || 0.18, distNorm * (L.linkAlpha || 0.65));
  
            const lineColor = BGNet.config.lineColor || '#FFDF8A';
            ctx.lineWidth = 1.0 + 1.2 * alpha; // a hair subtler than normal links
            ctx.strokeStyle = lineColor.replace('ALPHA', alpha.toFixed(3));
            ctx.beginPath();
            ctx.moveTo(pa.x, pa.y);
            ctx.lineTo(pb.x, pb.y);
            ctx.stroke();
          }
        }
      }
    }
  
    // Optional triangle mesh accents (light, random)
    if (CONFIG.drawTriangles) {
      const start = layerIndexOffsets[0] || 0;
      const end   = layerIndexOffsets[1] || Math.min(particles.length, start + 60);
      for (let i = start; i + 2 < end; i += 3) {
        const i = drawOrder[oi];
        const p1 = particles[i], p2 = particles[i+1], p3 = particles[i+2];
        ctx.beginPath();
        ctx.moveTo(p1.x - parX, p1.y - parY);
        ctx.lineTo(p2.x - parX, p2.y - parY);
        ctx.lineTo(p3.x - parX, p3.y - parY);
        ctx.closePath();
        ctx.fillStyle = `rgba(255,255,255,${CONFIG.triangleAlpha})`;
        ctx.fill();
      }
    }
  
    rafId = requestAnimationFrame(step);
  }
  
  // Boot
  resize();
  addEventListener('resize', resize);
  
  const applyEnvironmentConfig = () => {
    const applyPreset = (preset) => {
      if (!preset) return;
      if (typeof preset.density === 'number') {
        CONFIG.density = preset.density;
      }
      if (typeof preset.glow === 'number') {
        CONFIG.glow = preset.glow;
      }
      if (typeof preset.linkAdjust === 'number') {
        CONFIG.layers.forEach((layer) => {
          const base = layer.linkDist ?? 120;
          layer.linkDist = Math.max(60, base + preset.linkAdjust);
        });
      }
      if (typeof preset.linkDist === 'number') {
        CONFIG.layers.forEach((layer) => {
          layer.linkDist = preset.linkDist;
        });
      }
    };

    const basePreset = { density: 0.00009, glow: 4, linkAdjust: -8 };
    applyPreset(basePreset);

    const loadPreset = { density: 0.00013, glow: 8, linkDist: 110 };
    applyPreset(loadPreset);

    CONFIG.fieldSpeed = 0.00020;
    CONFIG.flowStrength = 0.40;
    CONFIG.damping = 0.995;
    CONFIG.layers.forEach((layer, index) => {
      const scale = index === 0 ? 0.80 : 0.70;
      layer.speed *= scale;
    });

    const hiDPI = (window.devicePixelRatio || 1) > 2;
    if (hiDPI) {
      CONFIG.density        = Math.min(CONFIG.density, 0.00005);
      CONFIG.glow           = Math.min(CONFIG.glow ?? 8, 6);
      CONFIG.runnerGlow     = Math.min(CONFIG.runnerGlow ?? 8, 6);
      CONFIG.runnersPerLink = Math.min(CONFIG.runnersPerLink ?? 2, 1);
      CONFIG.runnerSpeed    = Math.min(CONFIG.runnerSpeed ?? 0.3, 0.22);
      CONFIG.flowStrength   = Math.min(CONFIG.flowStrength ?? 0.04, 0.028);
    }

    const css = getComputedStyle(document.documentElement);
    const gold1 = (css.getPropertyValue('--gold-1').trim()) || '#FFD166';
    const gold2 = (css.getPropertyValue('--gold-2').trim()) || '#F5B000';
    const goldL = (css.getPropertyValue('--gold-line').trim()) || '#FFDF8A';

    const hexToRgba = (hex, alpha = 1) => {
      if (!/^#([0-9a-fA-F]{6})$/.test(hex)) return hex;
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return `rgba(${r},${g},${b},${alpha})`;
    };

    CONFIG.dotColorA = hexToRgba(gold1, 0.82);
    CONFIG.dotColorB = hexToRgba(gold2, 0.82);
    const lineColor = hexToRgba(goldL, 1);
    CONFIG.lineColor = typeof lineColor === 'string'
      ? lineColor.replace(/,1\)$/, ',ALPHA)')
      : '#FFDF8A';

    if (window.BGNet?.setMode) {
      window.BGNet.setMode('custom');
    } else {
      resize();
    }
  };

  // Expose a tiny API so you can tweak live from the console
  window.BGNet = {
    setMode: (mode) => { regionMode = mode; resize(); },
    setCustomPercents: (p) => {
      customRegionPercents.xMin = p.xMin ?? customRegionPercents.xMin;
      customRegionPercents.xMax = p.xMax ?? customRegionPercents.xMax;
      customRegionPercents.yMin = p.yMin ?? customRegionPercents.yMin;
      customRegionPercents.yMax = p.yMax ?? customRegionPercents.yMax;
      regionMode = 'custom'; resize();
    },
    pause: () => setPaused(manualPauseKey, true),
    resume: () => setPaused(manualPauseKey, false),
    isRunning: () => pauseReasons.size === 0 && !!rafId,
    config: CONFIG,
    region: () => ({ ...REGION })
  };

  applyEnvironmentConfig();

  const handleLowPowerChange = (event) => {
    const matches = event.matches;
    if (matches) {
      canvas.dataset.bgNetDisabled = 'true';
    } else {
      delete canvas.dataset.bgNetDisabled;
    }
    setPaused('low-power', matches);
  };

  handleLowPowerChange(lowPowerQuery);
  if (typeof lowPowerQuery.addEventListener === 'function') {
    lowPowerQuery.addEventListener('change', handleLowPowerChange);
  } else if (typeof lowPowerQuery.addListener === 'function') {
    lowPowerQuery.addListener(handleLowPowerChange);
  }

  const reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const handleMotionChange = (event) => setPaused('reduced-motion', event.matches);

  handleMotionChange(reduceMotionQuery);
  if (typeof reduceMotionQuery.addEventListener === 'function') {
    reduceMotionQuery.addEventListener('change', handleMotionChange);
  } else if (typeof reduceMotionQuery.addListener === 'function') {
    reduceMotionQuery.addListener(handleMotionChange);
  }

  if (navigator.connection && navigator.connection.saveData === true) {
    setPaused('save-data', true);
  }

  const updateVisibility = () => {
    setPaused('visibility', document.visibilityState !== 'visible');
  };

  document.addEventListener('visibilitychange', updateVisibility);
  updateVisibility();

  updateLoop();
}
