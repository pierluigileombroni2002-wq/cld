// Assemblaggio: ogni pezzo di una macchina arriva al suo posto con un movimento morbido, in ordine.
// t = 0 → niente; t = 1 → macchina completa. Serve per legare la costruzione allo scorrimento.
import * as THREE from 'three';

const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3();

export const facile = {
  fuori: (x) => 1 - Math.pow(1 - x, 3),                // esce dolce
  dentroFuori: (x) => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2,
  rimbalzoMorbido: (x) => { const c = 1.2; return 1 + c * Math.pow(x - 1, 3) + (c - 1) * Math.pow(x - 1, 2); }, // leggero overshoot
};

function finestra(t, inizio, durata) {
  return Math.min(1, Math.max(0, (t - inizio) / durata));
}

export class Assemblaggio {
  constructor() { this.parti = []; this.istanze = []; this.t = -1; }

  // obj: Object3D già posizionato al suo posto finale.
  // ordine 0..1: quando parte (0 = subito, 1 = ultimo). da: offset di partenza [x,y,z]. durata: frazione del tempo totale.
  aggiungi(obj, { ordine = 0, da = [0, -1.5, 0], durata = 0.3, scala = 0.6, rotazione = 0, asse = 'y', facilita = facile.fuori } = {}) {
    obj.userData.ass = { ordine, da: new THREE.Vector3(...da), durata, scala, rotazione, asse, facilita, base: obj.position.clone(), rotBase: obj.rotation.clone(), scalaBase: obj.scale.clone() };
    this.parti.push(obj);
    return obj;
  }

  // mesh: InstancedMesh; trasformazioni: [{ pos, quat?, scala? , ordine, da }]
  aggiungiIstanze(mesh, trasformazioni, { durata = 0.25, scala = 0.6, facilita = facile.fuori } = {}) {
    const dati = trasformazioni.map((tr, i) => ({
      pos: tr.pos.clone(), quat: (tr.quat || new THREE.Quaternion()).clone(), sc: (tr.scala || new THREE.Vector3(1, 1, 1)).clone(),
      ordine: tr.ordine ?? i / trasformazioni.length, da: new THREE.Vector3(...(tr.da || [0, -1.5, 0])),
    }));
    this.istanze.push({ mesh, dati, durata, scala, facilita });
    return mesh;
  }

  set(t) {
    t = Math.min(1, Math.max(0, t));
    if (t === this.t) return;
    this.t = t;
    for (const obj of this.parti) {
      const a = obj.userData.ass;
      const inizio = a.ordine * (1 - a.durata);
      const k = a.facilita(finestra(t, inizio, a.durata));
      if (k <= 0) { obj.visible = false; continue; }
      obj.visible = true;
      obj.position.copy(a.base).addScaledVector(a.da, 1 - k);
      const sc = a.scala + (1 - a.scala) * k;
      obj.scale.copy(a.scalaBase).multiplyScalar(sc);
      if (a.rotazione) { obj.rotation.copy(a.rotBase); obj.rotation[a.asse] += a.rotazione * (1 - k); }
    }
    for (const ist of this.istanze) {
      const { mesh, dati, durata, scala, facilita } = ist;
      let visibili = 0;
      for (let i = 0; i < dati.length; i++) {
        const d = dati[i];
        const inizio = d.ordine * (1 - durata);
        const k = facilita(finestra(t, inizio, durata));
        if (k <= 0) { _s.setScalar(0.0001); _p.copy(d.pos); _q.copy(d.quat); }
        else {
          visibili++;
          _p.copy(d.pos).addScaledVector(d.da, 1 - k);
          _q.copy(d.quat);
          _s.copy(d.sc).multiplyScalar(scala + (1 - scala) * k);
        }
        _m.compose(_p, _q, _s);
        mesh.setMatrixAt(i, _m);
      }
      mesh.instanceMatrix.needsUpdate = true;
      mesh.visible = visibili > 0;
    }
  }
}
