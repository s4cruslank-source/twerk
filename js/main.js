// ===== Videos =====
const INTRO_VIDEO_SRCS = [
  "./images/twerk5.mp4",
  "./images/twerk1.mp4",
  "./images/twerk2.mp4",
  "./images/twerk3.mp4",
  "./images/twerk4.mp4"
];
const MAIN_TWERK_VIDEO_SRC = "./images/llatindance.mp4";

// ===== State =====
let level = 0;
let autoplayReady = false;
let physicsStarted = false;
let introsEnabled  = false;


const intros = [];   // {el, size, pos, vel, visible}
const EMOJIS = ["🍑","💥","🫨","🎛️","💸","🚀","🌀","✨","⚡","🔥"];
const floaters = [];

// ===== DOM =====
const root      = document.documentElement;
const headerEl  = document.querySelector(".header");
const meterFill = document.getElementById("meter-fill");
const levelText = document.getElementById("level-text");
const rateEl    = document.getElementById("rate");
const btnDec    = document.getElementById("btn-dec");
const btnInc    = document.getElementById("btn-inc");
const btnRnd    = document.getElementById("btn-rnd");
const mainVideo = document.getElementById("main-video");
const emojiLayer= document.getElementById("emoji-layer");
const introLayer= document.getElementById("intro-layer");
const copyBtn   = document.getElementById("copy-ca");
const caInput   = document.getElementById("ca-input");
const bgVideo   = document.getElementById("bg-video");

// ===== Speed Scale Config =====
const MIN_POS  = 0;
const ZERO_POS = 2;
const MAX_POS  = 8;
const MIN_RATE = 0.50;
const MAX_RATE = 4.00;
const DEC_STEP = 0.25;
const INC_STEP = 0.50;

// ===== Responsive helpers =====
const R = { introSize: 240, floaterFont: 40, floaterCount: 20, floaterScale: 1 };
const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
const lerp  = (a,b,t)=>a+(b-a)*t;

// показываем интро всегда (можешь сменить логику при желании)
// показываем интро только на «десктопном» вводе и достаточной ширине
const shouldShowIntros = () => {
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  return !prefersReduced; // единственное ограничение — accessibility
};

// централизовано обновляем видимость
function updateIntrosVisibility(){
  if (shouldShowIntros()){
    if (!introsEnabled) enableIntros();
    document.body.classList.remove('no-intros');
  } else {
    if (introsEnabled) disableIntros();
    document.body.classList.add('no-intros');
  }
}

// в init() — вместо прямого enableIntros():
function init(){
  if (mainVideo) mainVideo.src = MAIN_TWERK_VIDEO_SRC;

  applyResponsive();

  // было: if (shouldShowIntros()) enableIntros();
  updateIntrosVisibility();

  createFloaters();

  // остальное без изменений...
  if (bgVideo) {
    bgVideo.play().catch(() => {
      const kick = () => { bgVideo.play().catch(()=>{}); window.removeEventListener("pointerdown", kick, {once:true}); };
      window.addEventListener("pointerdown", kick, {once:true});
    });
  }
  requestAnimationFrame(floaterLoop);
  setLevel(ZERO_POS);
}

// в ресайзе — тоже используем централизованную функцию:
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    applyResponsive();
    updateIntrosVisibility(); // <— ключевая строка
  }, 120);
});



function applyResponsive(){
  const W = window.innerWidth;
  const t = clamp((W - 360) / (1440 - 360), 0, 1);
  const base = Math.min(window.innerWidth, window.innerHeight);
R.introSize = Math.round(clamp(base * 0.18, 110, 260)); // 18% экрана, min 110px, max 260px

// прокинем в CSS на всякий случай (если где-то будешь использовать)
root.style.setProperty("--intro-size", R.introSize + "px");
  R.floaterFont = Math.round(lerp(22, 44, t));
  root.style.setProperty("--floater-font", R.floaterFont + "px");
  R.floaterCount= Math.round(lerp(10, 24, t));
  R.floaterScale= lerp(0.82, 1.0, t);

  // подгон размеров существующих интро
  for (const box of intros){
    const old = box.size;
    if (old !== R.introSize){
      const cx = box.pos.x + old/2, cy = box.pos.y + old/2;
      box.size = R.introSize;
      box.pos.x = clamp(cx - R.introSize/2, 0, window.innerWidth  - R.introSize);
      box.pos.y = clamp(cy - R.introSize/2, 0, window.innerHeight - R.introSize);
      box.el.style.width  = R.introSize + "px";
      box.el.style.height = R.introSize + "px";
      box.el.style.left   = box.pos.x + "px";
      box.el.style.top    = box.pos.y + "px";
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
    if (shouldShowIntros() && !introsEnabled) enableIntros();
    if (!shouldShowIntros() && introsEnabled) disableIntros();
  }, 120);
});

// ===== Init =====
function init(){
  if (mainVideo) mainVideo.src = MAIN_TWERK_VIDEO_SRC;

  applyResponsive();

  // интро и физика
  if (shouldShowIntros()) enableIntros();
  createFloaters();

  // кнопки, если присутствуют
  if (btnDec) btnDec.addEventListener("click", () => setLevel(Math.max(MIN_POS, level - 1)));
  if (btnInc) btnInc.addEventListener("click", () => setLevel(Math.min(MAX_POS, level + 1)));
  if (btnRnd) btnRnd.addEventListener("click", () => setLevel(Math.floor(Math.random() * (MAX_POS - MIN_POS + 1)) + MIN_POS));

  // автоплей фонового видео
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
  window.addEventListener("pointermove", pushIntrosByPointer);
}
function disableIntros(){
  if (!introsEnabled) return;
  introsEnabled = false;
  for (const box of intros) box.el.remove();
  intros.length = 0;
  window.removeEventListener("pointermove", pushIntrosByPointer);
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

  function randomPos(){
    const pad = 16;
    const S = R.introSize;
    const topGuard = 140; // не залезать под верхние бары
    const x = Math.random() * (window.innerWidth  - S - pad*2) + pad;
    const y = Math.random() * (window.innerHeight - S - pad*2 - topGuard) + pad + topGuard;
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

    intros.push({
      el,
      size: R.introSize,
      pos: { x: pos.x, y: pos.y },
      vel: { vx: (Math.random() - 0.5) * 2, vy: (Math.random() - 0.5) * 2 },
      visible: true
    });
  });
}
const bounds = () => ({ w: window.innerWidth, h: window.innerHeight });

// ===== Physics with bouncy chaos =====
function startIntrosPhysics(){
  if (physicsStarted) return;
  physicsStarted = true;

  const friction = 0.94;
  const bounce = 0.8;

  function step(){
    const b = bounds();

    // move & walls
    for (let i = 0; i < intros.length; i++){
      const box = intros[i];
      if (!box.visible) continue;

      let nx = box.pos.x + box.vel.vx;
      let ny = box.pos.y + box.vel.vy;
      let nvx = box.vel.vx * friction;
      let nvy = box.vel.vy * friction;

      const s = box.size;

      if (nx < 0){ nx = 0; nvx = -nvx * (bounce + 0.15); nvy += (Math.random() - 0.5) * 0.6; }
      if (ny < 0){ ny = 0; nvy = -nvy * (bounce + 0.15); nvx += (Math.random() - 0.5) * 0.6; }
      if (nx > b.w - s){ nx = b.w - s; nvx = -nvx * (bounce + 0.15); nvy += (Math.random() - 0.5) * 0.6; }
      if (ny > b.h - s){ ny = b.h - s; nvy = -nvy * (bounce + 0.15); nvx += (Math.random() - 0.5) * 0.6; }

      box.pos.x = nx; box.pos.y = ny;
      box.vel.vx = nvx; box.vel.vy = nvy;

      box.el.style.left = nx + "px";
      box.el.style.top  = ny + "px";
    }

    // pair collisions
    for (let i = 0; i < intros.length; i++){
      for (let j = i + 1; j < intros.length; j++){
        const a = intros[i], b2 = intros[j];
        if (!a.visible || !b2.visible) continue;

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

// ===== Pointer push =====
function pushIntrosByPointer(e){
  const pushRadius = 240;
  for (const box of intros){
    if (!box.visible) continue;
    const rect = box.el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top  + rect.height / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist < pushRadius){
      const force = (1 - dist / pushRadius) * 3.5;
      const inv = dist || 1;
      box.vel.vx -= (dx / inv) * force;
      box.vel.vy -= (dy / inv) * force;
    }
  }
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
    backdrop.dataset.open = open ? "true" : "false";
    backdrop.setAttribute('aria-hidden', open ? 'false' : 'true');
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

/* ===== Entry Gate logic ===== */
(() => {
  const gate  = document.getElementById('entry-gate');
  if (!gate) return;

  const panel = gate.querySelector('.gate__panel');
  const cta   = document.getElementById('gate-cta');   // картинка-кнопка
  const skip  = document.getElementById('gate-skip');  // запасная кнопка
  const music = document.getElementById('bg-music');   // <audio> из HTML

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
      // iOS любит явный seek до 0 перед первым play
      if (music.currentTime > 0 === false) music.currentTime = 0;
      await music.play();
      fadeInAudio(music, 0.6, 900);
    } catch (err) {
      // если что-то помешало — просто молча продолжаем
      // (в клике уже есть пользовательский жест, обычно play пройдёт)
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
    sessionStorage.setItem('twerkGate', '1');
  };

  // клик по картинке: показываем «загрузку», запускаем музыку и закрываем гейт
  const handleEnter = async () => {
    gate.classList.add('armed');      // показывает точки загрузки
    await startMusic();               // запускаем музыку с fade-in
    setTimeout(closeGate, 800);       // небольшая задержка для «лоадера»
  };

  cta?.addEventListener('click', handleEnter);
  skip?.addEventListener('click', handleEnter); // запасная кнопка тоже включает музыку

  // Enter с клавиатуры тоже «входит»
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && gate.dataset.open === 'true') cta?.click();
  });

  // показываем гейт один раз за сессию вкладки
  if (!sessionStorage.getItem('twerkGate')) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      gate.classList.add('reduced');
    }
    openGate();
  }
})();



  let releaseTrap = null;
  function openModalById(id, trigger=null){
    const modal = document.getElementById(id);
    if (!modal) return;
    lastTrigger = trigger; current = modal;
    setOpenState(modal, true);
    releaseTrap = focusTrap(modal);
    const onBackdrop = (e) => { if (e.target === backdrop) closeModal(); };
    backdrop.addEventListener('click', onBackdrop, { once:true });
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
    const opener = e.target.closest('[data-modal-open]');
    if (opener){ const id = opener.getAttribute('data-modal-open'); openModalById(id, opener); }
    if (e.target.closest('[data-modal-close]')) closeModal();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && current) closeModal(); });
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
