// ERI v3 · segnaposto semplici con lo stesso contratto delle macchine vere (se i moduli di macchine/ mancano o falliscono).
// creaX(ctx) → { gruppo, aggiorna(stato) }; stato = { t, montaggio, funzione, vicino }.
const cl = x => (x < 0 ? 0 : x > 1 ? 1 : x);
const e3 = x => 1 - Math.pow(1 - cl(x), 3);

export function materialiBase(THREE) {
  const S = (o) => new THREE.MeshStandardMaterial(o);
  return {
    alluminio: S({ color: '#c9cdd4', metalness: 1, roughness: 0.3 }), acciaio: S({ color: '#a3a9b0', metalness: 1, roughness: 0.42 }),
    inox: S({ color: '#f1f2f5', metalness: 1, roughness: 0.15 }), grafite: S({ color: '#2a2c32', metalness: 0.5, roughness: 0.36 }),
    bianco: S({ color: '#eceae5', metalness: 0.05, roughness: 0.35 }), oro: S({ color: '#e6b25c', metalness: 1, roughness: 0.2 }),
    vetroModulo: S({ color: '#16203c', metalness: 0.3, roughness: 0.12 }),
    podio: new THREE.MeshPhysicalMaterial({ color: '#141319', metalness: 0.7, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.16, envMapIntensity: 0.6 }),
    lucOro: new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd27a').multiplyScalar(4) }),
  };
}

// pezzi che salgono in ordine dal basso (montaggio) — y0 = quota finale
function montaggio(pezzi, m) {
  const n = pezzi.length;
  pezzi.forEach((p, i) => {
    const k = e3((m * (n + 2) - i) / 3);
    p.o.visible = k > 0.001; p.o.position.y = p.y0 + (1 - k) * 1.6; p.o.scale.setScalar(0.6 + 0.4 * k);
  });
}

export function creaFV(ctx) {
  const { THREE, materiali: M } = ctx;
  const gruppo = new THREE.Group(), pezzi = [], file = [];
  const geoMod = new THREE.BoxGeometry(0.54, 0.025, 1.1), geoPalo = new THREE.BoxGeometry(0.08, 1, 0.08), geoTubo = new THREE.BoxGeometry(5.8, 0.08, 0.08);
  [-1.8, -0.6, 0.6, 1.8].forEach((z, r) => {
    const fila = new THREE.Group(); fila.position.set(0, 0, z); gruppo.add(fila);
    const H = r === 0 ? 2.0 : 1.1;
    for (const x of [-2.4, 0, 2.4]) { const p = new THREE.Mesh(geoPalo, M.acciaio); p.scale.y = H; p.position.set(x, H / 2, 0); fila.add(p); pezzi.push({ o: p, y0: H / 2 }); }
    const asse = new THREE.Group(); asse.position.y = H; fila.add(asse); pezzi.push({ o: asse, y0: H });
    asse.add(new THREE.Mesh(geoTubo, M.acciaio));
    const im = new THREE.InstancedMesh(geoMod, M.vetroModulo, 10), m4 = new THREE.Matrix4();
    for (let i = 0; i < 10; i++) im.setMatrixAt(i, m4.makeTranslation(-2.6 + i * 0.578, 0.07, 0));
    asse.add(im); file.push(asse);
  });
  return {
    gruppo,
    aggiorna(s) {
      montaggio(pezzi, s.montaggio);
      file.forEach((a, i) => { a.rotation.x = (0.42 * Math.sin(s.t * 0.15 - i * 0.3) + 0.1) * s.funzione; });
    },
  };
}

export function creaBESS(ctx) {
  const { THREE, materiali: M } = ctx;
  const gruppo = new THREE.Group(), pezzi = [], luci = [];
  const geoC = new THREE.BoxGeometry(1.2, 1.3, 3.0), geoR = new THREE.BoxGeometry(0.02, 1.0, 2.6);
  [-2.1, -0.7, 0.7, 2.1].forEach(x => {
    const c = new THREE.Mesh(geoC, M.bianco); c.position.set(x, 0.65, -0.6); gruppo.add(c); pezzi.push({ o: c, y0: 0.65 });
    const lm = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd27a') });
    const r = new THREE.Mesh(geoR, lm); r.position.set(0.61, 0, 0); c.add(r); luci.push(lm);
  });
  const tr = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.0, 0.9), M.grafite); tr.position.set(1.8, 0.5, 2.0); gruppo.add(tr); pezzi.push({ o: tr, y0: 0.5 });
  return {
    gruppo,
    aggiorna(s) {
      montaggio(pezzi, s.montaggio);
      luci.forEach((m, i) => m.color.setRGB(1, 0.82, 0.48).multiplyScalar(0.05 + 3.5 * cl(s.funzione * 4 - i)));
    },
  };
}

export function creaTurbine(ctx) {
  const { THREE, materiali: M } = ctx;
  const gruppo = new THREE.Group();
  // come il modulo vero: tre piedistalli piccoli lungo X (passo 2,8), turbine sopra
  const geoPied = new THREE.CylinderGeometry(1.0, 1.0, 0.5, 64);
  const nuova = x => {
    const p = new THREE.Mesh(geoPied, M.podio || M.grafite); p.position.set(x, 0.25, 0); gruppo.add(p);
    const g = new THREE.Group(); g.position.set(x, 0.5, 0); g.scale.setScalar(0.6); gruppo.add(g); return g;
  };
  const pelton = nuova(-2.8), francis = nuova(0), kaplan = nuova(2.8);
  // Pelton: ruota a cucchiai (asse orizzontale)
  const rp = new THREE.Group(); rp.position.y = 1.4; pelton.add(rp);
  rp.add(new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.16, 48).rotateX(Math.PI / 2), M.inox));
  for (let i = 0; i < 18; i++) { const a = (i / 18) * Math.PI * 2; const c = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 8), M.inox); c.scale.set(1, 0.6, 1.4); c.position.set(Math.cos(a) * 0.68, Math.sin(a) * 0.68, 0); rp.add(c); }
  // Francis: girante a corona + chiocciola
  const rf = new THREE.Group(); rf.position.y = 1.2; francis.add(rf);
  rf.add(new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.55, 0.5, 48), M.inox));
  const sp = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.28, 16, 64, Math.PI * 1.7), M.grafite); sp.rotation.x = Math.PI / 2; francis.add(sp); sp.position.y = 1.2;
  // Kaplan: mozzo con pale (asse verticale)
  const rk = new THREE.Group(); rk.position.y = 1.2; kaplan.add(rk);
  rk.add(new THREE.Mesh(new THREE.SphereGeometry(0.35, 32, 16), M.oro));
  for (let i = 0; i < 5; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.04, 0.4), M.inox); const a = (i / 5) * Math.PI * 2; b.position.set(Math.cos(a) * 0.65, 0, Math.sin(a) * 0.65); b.rotation.set(0.5, -a, 0); rk.add(b); }
  const tutte = [[pelton, rp, 1.4], [francis, rf, 1.2], [kaplan, rk, 1.2]];
  return {
    gruppo, pelton, francis, kaplan,
    aggiorna(s) {
      tutte.forEach(([g, r, y], i) => {
        const k = e3(s.montaggio * 1.6 - i * 0.3);
        g.visible = k > 0.001; r.position.y = y + (1 - k) * 2; g.scale.setScalar(0.6 * (0.5 + 0.5 * k));
      });
      const v = s.t * 1.4 * s.funzione;
      rp.rotation.z = v; rf.rotation.y = v; rk.rotation.y = -v;
    },
  };
}
