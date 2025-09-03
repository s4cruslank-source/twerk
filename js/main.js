// ===== Videos =====
const INTRO_VIDEO_SRCS = [
  "./images/twerk5.mp4",
  "./images/twerk1.mp4",
  "./images/twerk2.mp4",
  "./images/twerk3.mp4",
  "./images/twerk4.mp4",
  "./images/twekr5.mp4" // FIX: было twekr5.mp4
];
const MAIN_TWERK_VIDEO_SRC = "./images/llatindance.mp4";

// ===== State =====
let level = 0;
let autoplayReady = false;
let physicsStarted = false;
let introsEnabled  = false;

const intros  = []; // {el, size, pos, vel, visible, dragging}
const floaters = [];
const EMOJIS = ["🍑","💥","🫨","🎛️","💸","🚀","🌀","✨","⚡","🔥"];

// ===== DOM =====
const root       = document.documentElement;
const headerEl   = document.querySelector(".header");
const topbarEl   = document.querySelector(".topbar");
const meterFill  = document.getElementById("meter-fill");
const levelText  = document.getElementById("level-text");
const rateEl     = document.getElementById("rate");
const btnDec     = document.getElementById("btn-dec");
const btnInc     = document.getElementById("btn-inc");
const btnRnd     = document.getElementById("btn-rnd");
const mainVideo  = document.getElementById("main-video");
const emojiLayer = document.getElementById("emoji-layer");
const introLayer = document.getElementById("intro-layer");
const copyBtn    = document.getElementById("copy-ca");
const caInput    = document.getElementById("ca-input");
const bgVideo    = document.getElementById("bg-video");

// ===== Config =====
const INTRO_DRAGGABLE = true; // drag выключен (только «подталкивания»)

// ===== Speed Scale Config =====
const MIN_POS  = 0;
const ZERO_POS = 2;
const MAX_POS  = 8;
const MIN_RATE = 0.50;
const MAX_RATE = 4.00;
const DEC_STEP = 0.25;
const INC_STEP = 0.50;

// ===== Helpers / Responsive =====
const R = { introSize: 240, floaterFont: 40, floaterCount: 20, floaterScale: 1 };
const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
const lerp  = (a,b,t)=>a+(b-a)*t;

// читаем CSS-значение в px
const px = (v) => {
  const m = String(v || "").trim().match(/^([\d.]+)px$/);
  return m ? parseFloat(m[1]) : parseFloat(v) || 0;
};

// верхняя «стенка»: высота маркизы + высота топбара + небольшой паддинг
function getTopGuard(){
  const rs = getComputedStyle(document.documentElement);
  const marqueeH = px(rs.getPropertyValue('--marquee-h')) || 0;
  const barH = topbarEl ? topbarEl.getBoundingClientRect().height : 0;
  const pad = 8;
  return Math.max(0, Math.round(marqueeH + barH + pad));
}

// показываем интро всегда, кроме users with reduced motion
const shouldShowIntros = () => {
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  return !prefersReduced;
};

// централизованное включение/выключение интро
function updateIntrosVisibility(){
  if (shouldShowIntros()){
    if (!introsEnabled) enableIntros();
    document.body.classList.remove('no-intros');
  } else {
    if (introsEnabled) disableIntros();
    document.body.classList.add('no-intros');
  }
}

function applyResponsive(){
  const W = window.innerWidth;
  const t = clamp((W - 360) / (1440 - 360), 0, 1);

  // размер интро = 18% от короткой стороны экрана, в пределах 110..260
  const base = Math.min(window.innerWidth, window.innerHeight);
  R.introSize = Math.round(clamp(base * 0.18, 110, 260));
  root.style.setProperty("--intro-size", R.introSize + "px");

  R.floaterFont  = Math.round(lerp(22, 44, t));
  R.floaterCount = Math.round(lerp(10, 24, t));
  R.floaterScale = lerp(0.82, 1.0, t);
  root.style.setProperty("--floater-font", R.floaterFont + "px");

  const tG = getTopGuard();

  // подгоняем существующие интро под новый размер и верхнюю границу
  for (const box of intros){
    const old = box.size;
    if (old !== R.introSize){
      const cx = box.pos.x + old/2, cy = box.pos.y + old/2;
      box.size = R.introSize;
      box.pos.x = clamp(cx - R.introSize/2, 0, window.innerWidth  - R.introSize);
      box.pos.y = clamp(cy - R.introSize/2, tG, window.innerHeight - R.introSize);
      box.el.style.width  = R.introSize + "px";
      box.el.style.height = R.introSize + "px";
      box.el.style.left   = box.pos.x + "px";
      box.el.style.top    = box.pos.y + "px";
    } else {
      // даже без изменения размера не даём залезть под шапку
      box.pos.y = Math.max(box.pos.y, tG);
      box.el.style.top = box.pos.y + "px";
    }
  }

  // количество эмодзи-флоатеров
  if (floaters.length < R.floaterCount){
    for (let i=floaters.length; i<R.floaterCount; i++) addFloater();
  } else if (floaters.length > R.floaterCount){
    const kill = floaters.length - R.floaterCount;
    for (let i=0; i<kill; i++){ const f = floaters.pop(); f.el.remove(); }
  }
}

let resizeTimer = null;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    applyResponsive();
    updateIntrosVisibility();
  }, 120);
});

// ===== Init =====
function init(){
  if (mainVideo) mainVideo.src = MAIN_TWERK_VIDEO_SRC;

  applyResponsive();
  updateIntrosVisibility();
  createFloaters();

  // кнопки скорости (если есть)
  if (btnDec) btnDec.addEventListener("click", () => setLevel(Math.max(MIN_POS, level - 1)));
  if (btnInc) btnInc.addEventListener("click", () => setLevel(Math.min(MAX_POS, level + 1)));
  if (btnRnd) btnRnd.addEventListener("click", () => setLevel(Math.floor(Math.random() * (MAX_POS - MIN_POS + 1)) + MIN_POS));

  // автоплей фонового видео с жёстким kick по первому тапу
  if (bgVideo) {
    bgVideo.play().catch(() => {
      const kick = () => { bgVideo.play().catch(()=>{}); window.removeEventListener("pointerdown", kick, {once:true}); };
      window.addEventListener("pointerdown", kick, {once:true});
    });
  }

  requestAnimationFrame(floaterLoop);
  setLevel(ZERO_POS);
}

// ===== Enable / Disable intros =====
function enableIntros(){
  if (introsEnabled) return;
  introsEnabled = true;
  createIntroWindows(INTRO_VIDEO_SRCS);
  startIntrosPhysics();

  // курсор «дует» постоянно + по клику — удар
  window.addEventListener("pointermove", pushIntrosByPointer);
  window.addEventListener("pointerdown", pushBurst);
}
function disableIntros(){
  if (!introsEnabled) return;
  introsEnabled = false;
  for (const box of intros) box.el.remove();
  intros.length = 0;

  window.removeEventListener("pointermove", pushIntrosByPointer);
  window.removeEventListener("pointerdown", pushBurst);
}

// ===== Level control (0..8) =====
function setLevel(v){
  level = clamp(v, MIN_POS, MAX_POS);

  let rate;
  if (level <= ZERO_POS) rate = Math.max(MIN_RATE, 1.0 - (ZERO_POS - level) * DEC_STEP);
  else                   rate = Math.min(MAX_RATE, 1.0 + (level - ZERO_POS) * INC_STEP);

  if (mainVideo) mainVideo.playbackRate = rate;

  const percent = (level / MAX_POS) * 100;
  if (meterFill) meterFill.style.width = `${percent}%`;
  if (levelText) levelText.textContent = `${level}/${MAX_POS}`;
  if (rateEl)    rateEl.textContent    = rate.toFixed(2);

  const shaky = rate > 1;
  if (headerEl)  headerEl.classList.toggle("shakey", shaky);
  if (meterFill) meterFill.classList.toggle("shakey", shaky);

  const shakeStrength = Math.max(0, level - ZERO_POS);
  root.style.setProperty("--shake", String(shakeStrength));
}

// ===== Intro windows =====
function createIntroWindows(srcs){
  const placed = [];
  const tG = getTopGuard();

  function randomPos(){
    const pad = 16;
    const S = R.introSize;
    const minY = tG + pad;
    const x = Math.random() * (window.innerWidth  - S - pad*2) + pad;
    const y = Math.random() * (window.innerHeight - S - pad*2 - minY) + minY;
    return {x, y};
  }
  function nonOverlapping(p){
    const S = R.introSize, r = S * 0.92;
    return placed.every(q => Math.hypot(p.x - q.x, p.y - q.y) >= r);
  }

  srcs.forEach((src) => {
    let pos, tries = 0;
    do { pos = randomPos(); tries++; } while(!nonOverlapping(pos) && tries < 80);
    placed.push(pos);

    const el = document.createElement("div");
    el.className = "intro";
    el.style.width  = R.introSize + "px";
    el.style.height = R.introSize + "px";
    el.style.left   = pos.x + "px";
    el.style.top    = pos.y + "px";

    const v = document.createElement("video");
    v.className = "intro-video";
    v.src = src;
    v.autoplay = true; v.muted = true; v.loop = true; v.playsInline = true;
    el.appendChild(v);

    introLayer.appendChild(el);

    // стартовая скорость и направление — чтобы «поплыли» сами
const speed = 2.8 + Math.random() * 2.6;   // было 1.8..3.4 → стало 2.8..5.4 px/кадр
const angle = Math.random() * Math.PI * 2;

const box = {
  el,
  size: R.introSize,
  pos: { x: pos.x, y: pos.y },
  vel: { vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed },
  visible: true,
  dragging: false,
  wanderSeed: Math.random() * 1000,  // для «брожения»
  maxSpeed: 6.2                      // верхняя граница скорости
};

    intros.push(box);

    // drag подключаем только если включён флаг
    if (INTRO_DRAGGABLE) makeDraggable(box);
  });
}
const bounds = () => ({ w: window.innerWidth, h: window.innerHeight });

// ===== Physics with bouncy chaos =====
function startIntrosPhysics(){
  if (physicsStarted) return;
  physicsStarted = true;

const friction = 0.985; // было 0.93 — теперь скорость держится дольше
const bounce   = 0.82;  // чуть мягче отскок


  function step(){
    const b = bounds();
    const tG = getTopGuard();

    // move & walls
    for (let i = 0; i < intros.length; i++){
      const box = intros[i];
      if (!box.visible || box.dragging) continue;

      let nx = box.pos.x + box.vel.vx;
      let ny = box.pos.y + box.vel.vy;
      let nvx = box.vel.vx * friction;
      let nvy = box.vel.vy * friction;

      const s = box.size;

      if (nx < 0){ nx = 0; nvx = -nvx * (bounce + 0.15); nvy += (Math.random() - 0.5) * 0.6; }
      if (ny < tG){ ny = tG; nvy = -nvy * (bounce + 0.15); nvx += (Math.random() - 0.5) * 0.6; }
      if (nx > b.w - s){ nx = b.w - s; nvx = -nvx * (bounce + 0.15); nvy += (Math.random() - 0.5) * 0.6; }
      if (ny > b.h - s){ ny = b.h - s; nvy = -nvy * (bounce + 0.15); nvx += (Math.random() - 0.5) * 0.6; }

      // анти-«сонливость»: если почти остановились — лёгкий пинок
  // анти-«сонливость»: если почти остановились — лёгкий пинок
const speed2 = nvx*nvx + nvy*nvy;
if (speed2 < 0.02){ // было 0.06
  const ang = Math.random() * Math.PI * 2;
  nvx += Math.cos(ang) * 0.7;
  nvy += Math.sin(ang) * 0.7;
}


      box.pos.x = nx; box.pos.y = ny;
      box.vel.vx = nvx; box.vel.vy = nvy;

      box.el.style.left = nx + "px";
      box.el.style.top  = ny + "px";
    }

    // pair collisions (не трогаем тащимые)
    for (let i = 0; i < intros.length; i++){
      for (let j = i + 1; j < intros.length; j++){
        const a = intros[i], b2 = intros[j];
        if (!a.visible || !b2.visible || a.dragging || b2.dragging) continue;

        const dx = a.pos.x - b2.pos.x;
        const dy = a.pos.y - b2.pos.y;
        const dist = Math.hypot(dx, dy);
        const minDist = (a.size + b2.size) * 0.5 * 0.92;

        if (dist < minDist && dist > 0){
          const nx = dx / dist, ny = dy / dist;
          const tx = -ny, ty = nx;
          const overlap = (minDist - dist) * 0.5;

          a.pos.x += nx * overlap; a.pos.y += ny * overlap;
          b2.pos.x -= nx * overlap; b2.pos.y -= ny * overlap;

          const rvx = a.vel.vx - b2.vel.vx;
          const rvy = a.vel.vy - b2.vel.vy;
          const relVelN = rvx * nx + rvy * ny;
          if (relVelN > 0) continue;

          const eBase = 0.98;
          const chaos = 0.12 + Math.random() * 0.22;
          const e = Math.min(1.18, eBase + chaos);
          const jn = -(1 + e) * relVelN / 2;
          const jt = (Math.random() - 0.5) * 1.6;

          a.vel.vx += (jn * nx + jt * tx);
          a.vel.vy += (jn * ny + jt * ty);
          b2.vel.vx -= (jn * nx + jt * tx);
          b2.vel.vy -= (jn * ny + jt * ty);

          const unstick = 0.35;
          a.vel.vx += nx * unstick; a.vel.vy += ny * unstick;
          b2.vel.vx -= nx * unstick; b2.vel.vy -= ny * unstick;

          a.el.style.left = a.pos.x + "px"; a.el.style.top = a.pos.y + "px";
          b2.el.style.left = b2.pos.x + "px"; b2.el.style.top = b2.pos.y + "px";
        }
      }
    }

    requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

// ===== Pointer push (hover + click burst) =====
function pushIntrosByPointer(e){
  // не мешаем, если кто-то тащит (на случай, если drag включат флагом)
  if (INTRO_DRAGGABLE && intros.some(b => b.dragging)) return;

  const W = window.innerWidth;
  const pushRadius = Math.max(220, Math.min(420, W * 0.12)); // адаптивный радиус
  const maxForce   = 4.2;   // сила отталкивания

  for (const box of intros){
    if (!box.visible) continue;
    const rect = box.el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top  + rect.height / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist >= pushRadius) continue;

    const inv = dist || 1;
    const falloff = 1 - (dist / pushRadius);   // 1 у курсора, 0 на границе
    const force = maxForce * Math.pow(falloff, 1.3); // плавный спад

    box.vel.vx -= (dx / inv) * force;
    box.vel.vy -= (dy / inv) * force;
  }
}

// разовый сильный «тычок» по клику/тапу
function pushBurst(e){
const burstRadius = 360; // было 320
const burstForce  = 22;  

  for (const box of intros){
    if (!box.visible) continue;
    const rect = box.el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top  + rect.height / 2;

    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist >= burstRadius) continue;

    const inv = dist || 1;
    const falloff = 1 - (dist / burstRadius);
    const impulse = burstForce * (0.6 + 0.4 * falloff); // ближе — сильнее

    box.vel.vx -= (dx / inv) * impulse;
    box.vel.vy -= (dy / inv) * impulse;
  }
}

// ===== Drag (mouse + touch via Pointer Events) =====
// оставлен для совместимости — включается только если INTRO_DRAGGABLE = true
function makeDraggable(box){
  if (!INTRO_DRAGGABLE) return;

  const el = box.el;
  let drag = { active:false, id:null, dx:0, dy:0, lastX:0, lastY:0, lastT:0, vx:0, vy:0 };

  const onDown = (e) => {
    if (drag.active) return;
    drag.active = true;
    drag.id = e.pointerId;
    el.setPointerCapture?.(drag.id);
    el.classList.add('dragging');

    box.dragging = true;
    box.vel.vx = 0; box.vel.vy = 0;

    const rect = el.getBoundingClientRect();
    drag.dx = e.clientX - rect.left;
    drag.dy = e.clientY - rect.top;

    drag.lastX = e.clientX;
    drag.lastY = e.clientY;
    drag.lastT = performance.now();

    e.preventDefault();
  };

  const onMove = (e) => {
    if (!drag.active || e.pointerId !== drag.id) return;

    const b = bounds();
    const s = box.size;
    const tG = Math.min(getTopGuard(), b.h - s - 4);

    let nx = Math.min(Math.max(e.clientX - drag.dx, 0), b.w - s);
    let ny = Math.min(Math.max(e.clientY - drag.dy, tG), b.h - s);

    const t = performance.now() * 0.001; // секунды
nvx += Math.sin(t * 0.35 + box.wanderSeed) * 0.06;
nvy += Math.cos(t * 0.31 + box.wanderSeed) * 0.06;

// --- отталкивание от стен, чтобы не «залипали» в углах ---
const margin = 80;
if (nx < margin)         nvx += (1 - nx / margin) * 0.45;
if (ny < tG + margin)    nvy += (1 - (ny - tG) / margin) * 0.45;
if (nx > b.w - s - margin) nvx -= (1 - (b.w - s - nx) / margin) * 0.45;
if (ny > b.h - s - margin) nvy -= (1 - (b.h - s - ny) / margin) * 0.45;

// --- ограничение максимальной скорости (чтобы не улетали слишком быстро) ---
const sp2 = nvx*nvx + nvy*nvy;
const maxSp = box.maxSpeed;
if (sp2 > maxSp*maxSp){
  const k = maxSp / Math.sqrt(sp2);
  nvx *= k; nvy *= k;
}

    const dt = Math.max(8, t - drag.lastT);
    drag.vx = (e.clientX - drag.lastX) / dt;
    drag.vy = (e.clientY - drag.lastY) / dt;
    drag.lastX = e.clientX; drag.lastY = e.clientY; drag.lastT = t;

    box.pos.x = nx; box.pos.y = ny;
    el.style.left = nx + "px";
    el.style.top  = ny + "px";

    e.preventDefault();
  };

  const onUp = (e) => {
    if (!drag.active || e.pointerId !== drag.id) return;
    drag.active = false;
    el.releasePointerCapture?.(drag.id);
    el.classList.remove('dragging');

    const scale = 18; // инерция
    box.vel.vx = drag.vx * scale;
    box.vel.vy = drag.vy * scale;
    box.dragging = false;

    e.preventDefault();
  };

  el.addEventListener('pointerdown', onDown, {passive:false});
  window.addEventListener('pointermove', onMove, {passive:false});
  window.addEventListener('pointerup',   onUp,   {passive:false});
  window.addEventListener('pointercancel', onUp, {passive:false});
}

// ===== Emoji floaters =====
function addFloater(){
  const el = document.createElement("div");
  el.className = "floater";
  el.innerHTML = `<span>${EMOJIS[floaters.length % EMOJIS.length]}</span>`;
  emojiLayer.appendChild(el);

  floaters.push({ el, index: floaters.length, seed: Math.random() * 1000, x:50, y:50 });
}
function createFloaters(){ for (let i=0; i<R.floaterCount; i++) addFloater(); }
function floaterLoop(){
  const now = Date.now();
  for (const f of floaters){
    const t = (now + f.seed * 1000) * 0.0001;
    const x = 50 + Math.sin(t * (0.3 + f.index * 0.02)) * 48;
    const y = 50 + Math.cos(t * (0.37 + f.index * 0.015)) * 48;

    const scaleBase = 0.9 + ((f.index % 5) * 0.12);
    const scale = (scaleBase + level * 0.03) * R.floaterScale;
    const rot = (f.index * 23 + level * 8) % 360;
    const blur = Math.max(0, 2 - level * 0.1);
    const opacity = 0.4 + (level * 0.03);

    f.el.style.left = x + "%";
    f.el.style.top  = y + "%";
    f.el.style.transform = `translate(-50%,-50%) rotate(${rot}deg) scale(${scale})`;
    f.el.style.filter = `blur(${blur}px)`;
    f.el.style.opacity = opacity;
  }
  requestAnimationFrame(floaterLoop);
}

// ===== Modals (accessible) =====
(() => {
  const backdrop = document.getElementById('modal-backdrop');
  const body = document.body;
  let lastTrigger = null;
  let current = null;

  const qs  = (sel, root=document)=>root.querySelector(sel);
  const qsa = (sel, root=document)=>Array.from(root.querySelectorAll(sel));

  const setOpenState = (modal, open) => {
    modal.dataset.open = open ? "true" : "false";
    modal.setAttribute('aria-hidden', open ? 'false' : 'true');
    if (backdrop){
      backdrop.dataset.open = open ? "true" : "false";
      backdrop.setAttribute('aria-hidden', open ? 'false' : 'true');
    }
    body.classList.toggle('no-scroll', open);
  };

  const focusTrap = (modal) => {
    const focusables = qsa('a[href], button, textarea, input, select, [tabindex]:not([tabindex="-1"])', modal)
      .filter(el => !el.hasAttribute('disabled') && el.tabIndex !== -1);
    const first = focusables[0] || modal;
    const last  = focusables[focusables.length - 1] || modal;
    const onKey = (e) => {
      if (e.key === 'Tab' && focusables.length) {
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      } else if (e.key === 'Escape') closeModal();
    };
    modal.addEventListener('keydown', onKey);
    return () => modal.removeEventListener('keydown', onKey);
  };

  let releaseTrap = null;
  function openModalById(id, trigger=null){
    const modal = document.getElementById(id);
    if (!modal) return;
    lastTrigger = trigger; current = modal;
    setOpenState(modal, true);
    releaseTrap = focusTrap(modal);
    const onBackdrop = (e) => { if (e.target === backdrop) closeModal(); };
    backdrop?.addEventListener('click', onBackdrop, { once:true });
    setTimeout(() => {
      const focusTarget = qs('[data-modal-close], .btn, .wild-btn', modal) || qs('.modal__panel', modal);
      (focusTarget || modal).focus();
    }, 10);
  }
  function closeModal(){
    if (!current) return;
    setOpenState(current, false);
    if (releaseTrap) releaseTrap();
    if (lastTrigger && typeof lastTrigger.focus === 'function') lastTrigger.focus();
    current = null;
  }

  document.addEventListener('click', (e) => {
    const opener = e.target.closest?.('[data-modal-open]');
    if (opener){ const id = opener.getAttribute('data-modal-open'); openModalById(id, opener); }
    if (e.target.closest?.('[data-modal-close]')) closeModal();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && current) closeModal(); });
})();

// ===== Entry Gate logic (tap image to enter + music) =====
(() => {
  const gate  = document.getElementById('entry-gate');
  if (!gate) return;

  const panel = gate.querySelector('.gate__panel');
  const cta   = document.getElementById('gate-cta');   // картинка-кнопка
  const skip  = document.getElementById('gate-skip');  // запасная кнопка
  const music = document.getElementById('bg-music');   // <audio> в HTML (желательно с loop)

  // fallback: если loop где-то не сработал
  if (music){
    music.addEventListener('ended', async () => {
      try { music.currentTime = 0; await music.play(); } catch(e){}
    });
  }

  // плавный fade-in громкости
  const fadeInAudio = (audio, target = 0.6, duration = 900) => {
    if (!audio) return;
    audio.volume = 0;
    audio.muted = false;
    const t0 = performance.now();
    const step = (t) => {
      const p = Math.min(1, (t - t0) / duration);
      audio.volume = target * p;
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  const startMusic = async () => {
    if (!music) return;
    try {
      if (music.currentTime > 0 === false) music.currentTime = 0;
      await music.play();
      fadeInAudio(music, 0.6, 900);
    } catch (err) {
      // если что-то помешало — не мешаем входу
    }
  };

  const openGate = () => {
    gate.dataset.open = "true";
    gate.setAttribute('aria-hidden', 'false');
    document.body.classList.add('no-scroll');
    setTimeout(() => (panel?.focus()), 30);
  };

  const closeGate = () => {
    gate.dataset.open = "false";
    gate.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('no-scroll');
    sessionStorage.setItem('twerkGate', '1'); // показывать один раз за сессию
  };

  const handleEnter = async () => {
    gate.classList.add('armed');      // показать «лоадер»
    await startMusic();               // старт музыки
    setTimeout(closeGate, 800);       // лёгкая задержка
  };

  cta?.addEventListener('click', handleEnter);
  skip?.addEventListener('click', handleEnter);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && gate.dataset.open === 'true') cta?.click();
  });

  if (!sessionStorage.getItem('twerkGate')) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      gate.classList.add('reduced');
    }
    openGate();
  }
})();

// Copy CA
if (copyBtn && caInput){
  copyBtn.addEventListener("click", () => {
    caInput.select(); caInput.setSelectionRange(0, 99999);
    navigator.clipboard.writeText(caInput.value)
      .then(() => { copyBtn.textContent = "Copied!"; setTimeout(() => copyBtn.textContent = "Copy CA", 1500); })
      .catch(() => alert("Не удалось скопировать"));
  });
}

// ===== Start =====
window.addEventListener("load", init);
