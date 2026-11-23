const { PRODUCTS, ZONES, HERO_PIECES, I18N, INSTAGRAM } = window.TQA_DATA;
import { JewelStage, webglAvailable, REDUCED_MOTION } from './jewel3d.js';

const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));

const state = {
  lang: 'fr',
  zone: 'all',
  list: PRODUCTS.slice(),   // currently filtered list
  index: 0,                 // index in state.list for the open sheet
  metal: 'silver',
  auto: !REDUCED_MOTION,
  heroIdx: 0,
};
const t = key => I18N[state.lang][key];
const zoneName = id => (ZONES.find(z => z.id === id) || {})[state.lang] || '';
const pName = p => p[state.lang];
const priceHTML = p => `${p.price}<small>${t('currency')}</small>`;

/* ---------------- 3D availability ---------------- */
const HAS_GL = webglAvailable();
if (!HAS_GL) document.body.classList.add('no-webgl');
let hero = null, sheetStage = null;

/* ---------------- language ---------------- */
function applyLang(lang) {
  state.lang = lang;
  const html = document.documentElement;
  html.lang = lang; html.dir = lang === 'ar' ? 'rtl' : 'ltr';
  $$('[data-i18n]').forEach(el => { const v = t(el.dataset.i18n); if (typeof v === 'string') el.textContent = v; });
  $$('[data-i18n-aria]').forEach(el => el.setAttribute('aria-label', t(el.dataset.i18nAria)));
  $$('.lang button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
  document.title = lang === 'ar' ? 'ذا كوين أكسسوارز — ثقب · تونس بالماريوم' : 'The Queen Accessories — Piercing · Tunis Palmarium';
  renderFilters(); renderGrid(); renderHeroCaption(); updateAutoLabel();
  if (hero) hero.renderer.domElement.setAttribute('aria-label', t('model3d')(pName(heroPiece())));
  if ($('#sheet').open) renderSheet();
  try { localStorage.setItem('tqa-lang', lang); } catch (e) {}
}
$$('.lang button').forEach(b => b.addEventListener('click', () => applyLang(b.dataset.lang)));
$$('.js-instagram').forEach(a => { a.href = INSTAGRAM; });

/* ---------------- filters + grid ---------------- */
function renderFilters() {
  const box = $('#filters');
  box.innerHTML = '';
  ZONES.forEach(z => {
    const n = z.id === 'all' ? PRODUCTS.length : PRODUCTS.filter(p => p.zone === z.id).length;
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'filter';
    b.setAttribute('aria-pressed', String(state.zone === z.id));
    b.innerHTML = `<span>${z[state.lang]}</span><span class="n">${n}</span>`;
    b.addEventListener('click', () => { state.zone = z.id; renderFilters(); renderGrid(); });
    box.appendChild(b);
  });
}
function renderGrid() {
  state.list = state.zone === 'all' ? PRODUCTS.slice() : PRODUCTS.filter(p => p.zone === state.zone);
  $('#results').textContent = t('results')(state.list.length);
  const grid = $('#grid');
  grid.innerHTML = '';
  state.list.forEach((p, i) => {
    const li = document.createElement('li');
    li.className = 'card'; li.style.animationDelay = `${Math.min(i, 12) * 35}ms`;
    li.innerHTML = `
      <button type="button" class="card-btn" aria-label="${pName(p)} — ${p.price} ${t('currency')} · ${t('view3d')}">
        <span class="card-media">
          <img src="assets/products/${p.slug}.jpg" alt="" loading="lazy" width="600" height="600">
          <span class="card-badge"><svg class="ico cube" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 20 7.5v9L12 21l-8-4.5v-9z"/><path d="M12 12 20 7.5M12 12 4 7.5M12 12v9"/></svg>3D</span>
          <span class="card-cta" aria-hidden="true">${t('view3d')}</span>
        </span>
        <span class="card-body">
          <span>
            <span class="card-zone">${zoneName(p.zone)}</span>
            <span class="card-name">${pName(p)}${p.men ? `<span class="card-men">${t('men')}</span>` : ''}</span>
          </span>
          <span class="card-price">${priceHTML(p)}</span>
        </span>
      </button>`;
    li.querySelector('.card-btn').addEventListener('click', e => openSheet(i, e.currentTarget));
    grid.appendChild(li);
  });
}

/* ---------------- hero ---------------- */
function heroPiece() { return PRODUCTS.find(p => p.slug === HERO_PIECES[state.heroIdx]); }
function renderHeroCaption() {
  const p = heroPiece();
  $('#hero-piece-name').textContent = pName(p);
  $('#hero-piece-price').innerHTML = priceHTML(p);
  $('#hero-fallback').src = `assets/products/${p.slug}.jpg`;
  $('#hero-showcase').setAttribute('aria-label', `${t('nowShowing')} : ${pName(p)} — ${t('view3d')}`);
}
function initHero() {
  renderHeroCaption();
  if (!HAS_GL) return;
  try {
    hero = new JewelStage($('#hero-canvas'), { interactive: false, label: t('model3d')(pName(heroPiece())) });
    hero.setModel(heroPiece().model);
  } catch (e) { console.warn('3D unavailable', e); document.body.classList.add('no-webgl'); return; }
  if (!REDUCED_MOTION) {
    let paused = false;
    $('#hero-stage').addEventListener('pointerenter', () => paused = true);
    $('#hero-stage').addEventListener('pointerleave', () => paused = false);
    setInterval(() => {
      if (paused || $('#sheet').open || document.hidden) return;
      state.heroIdx = (state.heroIdx + 1) % HERO_PIECES.length;
      hero.setModel(heroPiece().model); renderHeroCaption();
      hero.renderer.domElement.setAttribute('aria-label', t('model3d')(pName(heroPiece())));
    }, 6000);
  }
}
$('#hero-showcase').addEventListener('click', e => {
  state.zone = 'all'; renderFilters(); renderGrid();
  openSheet(state.list.findIndex(p => p.slug === heroPiece().slug), e.currentTarget);
});
$$('input[name="hero-metal"]').forEach(r => r.addEventListener('change', () => setMetal(r.value)));

/* ---------------- metal (shared between hero + sheet) ---------------- */
function setMetal(m) {
  state.metal = m;
  if (hero) hero.setMetal(m);
  if (sheetStage) sheetStage.setMetal(m);
  $$(`input[name="hero-metal"][value="${m}"], input[name="sheet-metal"][value="${m}"]`).forEach(i => { i.checked = true; });
}
$$('input[name="sheet-metal"]').forEach(r => r.addEventListener('change', () => setMetal(r.value)));

/* ---------------- product sheet ---------------- */
const dlg = $('#sheet');
let opener = null;

function openSheet(i, from) {
  if (i < 0) i = 0;
  state.index = i; opener = from || null;
  if (!dlg.open) dlg.showModal();
  document.documentElement.style.overflow = 'hidden';
  if (hero) hero.setPaused(true);
  if (HAS_GL && !sheetStage) {
    try {
      sheetStage = new JewelStage($('#sheet-canvas'), { interactive: true });
      sheetStage.setMetal(state.metal);
      sheetStage.setAutoRotate(state.auto);
    } catch (e) { console.warn('3D unavailable', e); document.body.classList.add('no-webgl'); }
  }
  renderSheet();
  $('#sheet-close').focus();
}
function renderSheet() {
  const p = state.list[state.index];
  if (!p) return;
  $('#sheet-zone').textContent = zoneName(p.zone);
  $('#sheet-title').textContent = pName(p);
  $('#sheet-price').innerHTML = priceHTML(p);
  $('#sheet-desc').textContent = state.lang === 'ar' ? p.da : p.df;
  $('#sheet-heal').textContent = state.lang === 'ar' ? p.ha : p.hf;
  const img = $('#sheet-photo');
  img.src = `assets/products/${p.slug}.jpg`; img.alt = `${t('panePhoto')} — ${pName(p)}`;
  $('#sheet-count').textContent = `${String(state.index + 1).padStart(2, '0')} ${t('of')} ${String(state.list.length).padStart(2, '0')}`;
  if (sheetStage) {
    if (sheetStage.currentSlug !== p.slug) { sheetStage.setModel(p.model); sheetStage.currentSlug = p.slug; }
    sheetStage.renderer.domElement.setAttribute('aria-label', t('model3d')(pName(p)));
  }
}
function step(d) {
  state.index = (state.index + d + state.list.length) % state.list.length;
  renderSheet();
}
function closeSheet() { dlg.close(); }
dlg.addEventListener('close', () => {
  document.documentElement.style.overflow = '';
  if (hero) hero.setPaused(false);
  if (opener && document.contains(opener)) opener.focus();
});
$('#sheet-close').addEventListener('click', closeSheet);
$('#sheet-prev').addEventListener('click', () => step(-1));
$('#sheet-next').addEventListener('click', () => step(1));
dlg.addEventListener('keydown', e => {
  if (e.target.matches('input')) return;                 // let radios use arrows
  const rtl = document.documentElement.dir === 'rtl';
  if (e.key === 'ArrowRight') { e.preventDefault(); step(rtl ? -1 : 1); }
  if (e.key === 'ArrowLeft')  { e.preventDefault(); step(rtl ? 1 : -1); }
});

/* photo / 3D tabs (small screens) */
$$('.media-tabs button').forEach(b => b.addEventListener('click', () => {
  $('#sheet-media').dataset.view = b.dataset.view;
  $$('.media-tabs button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
}));

/* 3D tools */
function updateAutoLabel() {
  const btn = $('#tool-auto'); if (!btn) return;
  btn.setAttribute('aria-pressed', String(state.auto));
  $('#tool-auto-label').textContent = state.auto ? t('autoOn') : t('autoOff');
  btn.querySelector('.ico').innerHTML = state.auto ? '<path d="M8 5v14M16 5v14"/>' : '<path d="M4 12a8 8 0 1 0 2.3-5.7M4 4v4h4"/>';
}
$('#tool-auto').addEventListener('click', () => { state.auto = !state.auto; if (sheetStage) sheetStage.setAutoRotate(state.auto); updateAutoLabel(); });
$('#tool-reset').addEventListener('click', () => { if (sheetStage) sheetStage.reset(); });

/* ---------------- boot ---------------- */
$('#year').textContent = new Date().getFullYear();
let saved = null; try { saved = localStorage.getItem('tqa-lang'); } catch (e) {}
applyLang(saved === 'ar' ? 'ar' : 'fr');
initHero();
