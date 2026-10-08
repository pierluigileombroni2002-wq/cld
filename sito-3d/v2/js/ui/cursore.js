// =============================================================================
// ERI v2 · ui/cursore.js — cursore-mirino da teodolite, lettura del suolo, hover delle particelle, bottoni magnetici
// Proprietario: [BASE-UI].
// Specifica: DESIGN §5.7 (solo con pointer: fine e senza riduci movimento: anello di 6 px con 4 tacche e anello
// in ritardo di 28 px con damp λ 12; lettura in Plex Mono 10,5 px "42°00′12″N 12°30′41″E · q. 214 m" calcolata
// a 30 Hz con ray-march sulla funzione altezza (passo 0,5 u, poi bisezione), senza Raycaster; tappa 1: particella
// sotto il cursore → uHover = id e "Fg. 27 · P.lla 114 · 2,95 ha · idonea"; sui link l'anello sale a 44 px;
// sugli oggetti esplorabili compare ESPLORA. Bottoni magnetici: attrazione entro 90 px, spostamento massimo 8 px,
// etichetta in parallasse 0,6×, gsap.quickTo 0,4 s power3.out, uscita 0,6 s; riempimento radiale dal punto
// d'ingresso (--x --y), testo nero; bottone principale premuto: rame), §6.11 (riduci: cursore di sistema),
// §6.12 (schermi piccoli o touch: cursore di sistema), config.INTERAZIONI.
//
// Contratto (ARCHITETTURA §6): export rendiMagnetico(el); scrive ctx.STATO.uHover.
// =============================================================================
import { INTERAZIONI } from '../config.js';
import { formatoGMS, quotaSlm, raggioTerreno, numeroIt, clamp, damp } from '../geo.js';

export const MONDO = 'ui';

const CUR = INTERAZIONI.cursore, MAG = INTERAZIONI.magnetico;
const NON_TELA = 'a,button,input,textarea,select,label,.battuta,.testata,.indice,.sezione,.piede,#preloader';
const LINK = 'a,button,label,[role=radio],.voce,.chip';

let C = null;                    // stato del cursore
const magnetici = [];            // bottoni magnetici registrati
let puntatore = { x: -1e4, y: -1e4, mosso: false };
let ascoltoGlobale = false;

// ---------------------------------------------------------------- bottoni magnetici (§5.7)
const puoMagnete = () => matchMedia('(pointer: fine)').matches && !document.documentElement.classList.contains('riduci')
  && !matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Rende magnetico un bottone: attrazione entro 90 px (max 8 px), etichetta in parallasse 0,6×,
 * riempimento radiale dal punto d'ingresso. Idempotente.
 * @param {HTMLElement} el
 */
export function rendiMagnetico(el) {
  if (!el || el._magnete) return el;
  let et = el.querySelector('.etichetta-bottone');
  if (!et) { et = document.createElement('span'); et.className = 'etichetta-bottone'; while (el.firstChild) et.appendChild(el.firstChild); el.appendChild(et); }
  const m = { el, et, x: 0, y: 0, attratto: false, q: null };
  el._magnete = m; magnetici.push(m);
  // riempimento radiale dal punto d'ingresso (e verso il punto d'uscita)
  const punto = e => { const r = el.getBoundingClientRect(); el.style.setProperty('--x', (e.clientX - r.left).toFixed(0) + 'px'); el.style.setProperty('--y', (e.clientY - r.top).toFixed(0) + 'px'); };
  el.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') { punto(e); el.classList.add('dentro'); } });
  el.addEventListener('pointerleave', e => { punto(e); el.classList.remove('dentro', 'premuto'); });
  el.addEventListener('pointerdown', () => el.classList.add('premuto'));
  el.addEventListener('pointerup', () => el.classList.remove('premuto'));
  el.addEventListener('blur', () => el.classList.remove('premuto'));
  ascoltaPuntatore();
  return el;
}

/** Attrazione con gsap.quickTo (0,4 s power3.out); uscita con un tween di 0,6 s power3.out. Senza GSAP: transizione CSS. */
function sposta(m, x, y, uscita) {
  const g = window.gsap;
  m.x = x; m.y = y;
  if (!g) {
    m.el.style.transition = m.et.style.transition = `transform ${uscita ? MAG.uscita : MAG.durata}s cubic-bezier(.215,.61,.355,1)`;
    m.el.style.transform = `translate(${x}px, ${y}px)`; m.et.style.transform = `translate(${x * MAG.parallasse}px, ${y * MAG.parallasse}px)`;
    return;
  }
  if (uscita) {
    g.killTweensOf([m.el, m.et]); m.q = null;
    g.to(m.el, { x: 0, y: 0, duration: MAG.uscita, ease: 'power3.out' });
    g.to(m.et, { x: 0, y: 0, duration: MAG.uscita, ease: 'power3.out' });
    return;
  }
  if (!m.q) {
    g.killTweensOf([m.el, m.et]);
    const o = { duration: MAG.durata, ease: 'power3.out' };
    m.q = [g.quickTo(m.el, 'x', o), g.quickTo(m.el, 'y', o), g.quickTo(m.et, 'x', o), g.quickTo(m.et, 'y', o)];
  }
  m.q[0](x); m.q[1](y); m.q[2](x * MAG.parallasse); m.q[3](y * MAG.parallasse);
}

function magnete(e) {
  if (!puoMagnete()) return;
  for (const m of magnetici) {
    if (!m.el.isConnected || m.el.closest('.battuta:not(.attiva), [hidden]')) { if (m.attratto) { m.attratto = false; sposta(m, 0, 0, true); } continue; }
    const r = m.el.getBoundingClientRect();
    // rettangolo a riposo (senza lo spostamento magnetico in corso)
    const cx = r.left + r.width / 2 - m.x, cy = r.top + r.height / 2 - m.y;
    const dx = e.clientX - cx, dy = e.clientY - cy;
    const fuoriX = Math.max(0, Math.abs(dx) - r.width / 2), fuoriY = Math.max(0, Math.abs(dy) - r.height / 2);
    const vicino = Math.hypot(fuoriX, fuoriY) < MAG.raggio && r.width > 0;
    if (vicino) {
      const nx = clamp(dx / (r.width / 2 + MAG.raggio), -1, 1), ny = clamp(dy / (r.height / 2 + MAG.raggio), -1, 1);
      m.attratto = true; sposta(m, nx * MAG.max, ny * MAG.max, false);
    } else if (m.attratto) { m.attratto = false; sposta(m, 0, 0, true); }
  }
}

function ascoltaPuntatore() {
  if (ascoltoGlobale) return; ascoltoGlobale = true;
  addEventListener('pointermove', e => {
    puntatore.x = e.clientX; puntatore.y = e.clientY; puntatore.mosso = true; puntatore.tipo = e.pointerType; puntatore.bersaglio = e.target;
    if (e.pointerType === 'mouse') magnete(e);
  }, { passive: true });
}

// ---------------------------------------------------------------- mirino
export async function crea(ctx) {
  ascoltaPuntatore();
  for (const b of document.querySelectorAll('.bottone')) rendiMagnetico(b);
  const radice = document.querySelector('.cursore');
  if (!radice) return;
  radice.innerHTML = '<div class="cur-alone"></div><div class="cur-mirino"><i></i><i></i><i></i><i></i></div><div class="cur-lettura"></div><div class="cur-esplora">ESPLORA</div>';
  const V = ctx.THREE?.Vector3;
  C = {
    ctx, radice,
    alone: radice.querySelector('.cur-alone'), mirino: radice.querySelector('.cur-mirino'),
    lettura: radice.querySelector('.cur-lettura'), esplora: radice.querySelector('.cur-esplora'),
    ax: 0, ay: 0, attivo: false, dentro: false, acc: 1, testo: '', classi: {}, hover: 0,
    v: V ? new V() : null, o: V ? new V() : null,
  };
  const html = document.documentElement;
  const abilita = () => {
    const si = matchMedia('(pointer: fine)').matches && !ctx.flags.riduci && !ctx.flags.piccolo && !ctx.noWebGL
      && !matchMedia('(prefers-reduced-motion: reduce)').matches;
    C.attivo = si; html.classList.toggle('mirino', si);
    if (!si) { radice.classList.remove('attivo'); if (ctx.STATO) ctx.STATO.uHover = 0; }
  };
  abilita();
  ctx.eventi.on('riduci', abilita);
  matchMedia('(pointer: fine)').addEventListener?.('change', abilita);
  document.addEventListener('pointerleave', () => { C.dentro = false; radice.classList.remove('attivo'); });
  document.addEventListener('pointerenter', () => { C.dentro = true; });
  addEventListener('pointermove', e => { if (e.pointerType !== 'mouse') return; if (!C.dentro) { C.dentro = true; C.ax = e.clientX; C.ay = e.clientY; } }, { passive: true });
  addEventListener('blur', () => radice.classList.remove('attivo'));
}

function classe(c, nome, si) { if (C.classi[nome] !== si) { C.classi[nome] = si; C.radice.classList.toggle(nome, si); } }

export function aggiorna(ctx, T, t, dt) {
  if (!C) return;
  const S = ctx.STATO;
  if (!C.attivo || !puntatore.mosso || puntatore.tipo !== 'mouse') { if (S && S.uHover) S.uHover = 0; if (S && S.giranteHover) S.giranteHover = 0; return; }
  classe(C, 'attivo', C.dentro !== false);
  const x = puntatore.x, y = puntatore.y;
  if (x !== C.px || y !== C.py) {                       // scritture solo quando il puntatore si muove
    C.px = x; C.py = y;
    C.mirino.style.transform = C.lettura.style.transform = C.esplora.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  }
  if (Math.abs(C.ax - x) > 0.05 || Math.abs(C.ay - y) > 0.05) {
    C.ax = damp(C.ax, x, CUR.lambda, dt || 1 / 60); C.ay = damp(C.ay, y, CUR.lambda, dt || 1 / 60);
    C.alone.style.transform = `translate3d(${C.ax.toFixed(1)}px, ${C.ay.toFixed(1)}px, 0)`;
  }

  const b = puntatore.bersaglio;
  const suLink = !!(b && b.closest && b.closest(LINK));
  classe(C, 'link', suLink);
  classe(C, 'esplora', !!(b && b.closest && b.closest('[data-esplora]')) || C.girante > 0);

  // ---- lettura del suolo a 30 Hz (solo sulla tela della PIANURA, durante la storia)
  C.acc += dt;
  if (C.acc < 1 / CUR.lettura) return;
  C.acc = 0;
  const sullaTela = b && b.closest && !b.closest(NON_TELA) && ctx.mondo === 'pianura' && ctx.introFinita && !ctx.scroll?.inSezioni && (ctx.velo || 0) < 0.5;
  let testo = '', particella = false, hover = 0;
  if (sullaTela && ctx.camera && C.v) {
    const cam = ctx.camera;
    C.v.set(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1, 0.5).unproject(cam);
    C.o.copy(cam.position); C.v.sub(C.o).normalize();
    const tt = raggioTerreno(C.o.x, C.o.y, C.o.z, C.v.x, C.v.y, C.v.z, Math.min(cam.far, 3000), CUR.passoRay);
    if (tt > 0) {
      const px = C.o.x + C.v.x * tt, py = C.o.y + C.v.y * tt, pz = C.o.z + C.v.z * tt;
      testo = `${formatoGMS(px, pz, ' ')} · q. ${numeroIt(Math.round(quotaSlm(py)))} m`;
      // tappa 1: particella sotto il cursore (uHover = id) con foglio, numero, superficie, idoneità
      const [h0, h1] = INTERAZIONI.hoverTappe;
      const p = (T >= h0 && T < h1) ? ctx.dati.catasto?.particellaDi?.(px, pz) : null;
      if (p) {
        hover = p.id ?? 0; particella = true;
        const num = p.numero ?? p.particella ?? (p.id != null ? (p.id >= 100 ? p.id : 100 + p.id) : '—');
        const ha = p.ha != null ? numeroIt(p.ha, 2) + ' ha' : '';
        testo = `Fg. ${p.foglio ?? 27} · P.lla ${num}${ha ? ' · ' + ha : ''} · ${p.idonea ? 'idonea' : 'non idonea'}`;
      }
    }
  }
  if (S && S.uHover !== hover) S.uHover = hover;
  // 4e (§5.7): girante sotto il cursore → STATO.giranteHover (1 Pelton, 2 Francis, 3 Kaplan); idro/diagramma.js
  // pubblica pick(x, y) in px CSS e accende il campo d'impiego della girante. Senza pick: nulla.
  let girante = 0;
  const pick = ctx.dati.diagramma?.pick;
  if (typeof pick === 'function' && ctx.mondo === 'valle' && (S?.diagramma ?? 0) > 0.5 && b && b.closest && !b.closest(NON_TELA) && !ctx.scroll?.inSezioni) {
    const id = pick(x, y);
    girante = id === 'pelton' ? 1 : id === 'francis' ? 2 : id === 'kaplan' ? 3 : 0;
  }
  if (S && S.giranteHover !== girante) S.giranteHover = girante;
  C.girante = girante;
  if (testo !== C.testo) { C.testo = testo; C.lettura.textContent = testo; }
  if (C.classi.particella !== particella) { C.classi.particella = particella; C.lettura.classList.toggle('particella', particella); }
  C.lettura.classList.toggle('visibile', !!testo && !suLink);
}
