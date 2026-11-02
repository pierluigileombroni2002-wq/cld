# Pannello · modulo fotovoltaico e tracker "da catalogo"

Tutto procedurale (geometria e texture generate in codice), Three.js r160, nessuna luce necessaria:
i materiali sono `MeshPhysicalMaterial` e vivono di `scene.environment` (PMREM). Niente shadow map:
le ombre di contatto sono dipinte.

## API (`pannello.js`, ES module, importa `three` e `three/addons/utils/BufferGeometryUtils.js`)

```js
import { creaModulo, creaTracker, creaFila, creaAgrivoltaico, materialiPannello, ombraContatto } from './stili/pannello/pannello.js';

creaModulo({ larghezza = 1.134, altezza = 2.278, spessore = 0.035 })
  → THREE.Group di UN modulo (cornice a L smussata + celle + vetro + retro + scatola di giunzione);
    origine al centro, vetro verso +Y.

creaTracker({ moduli = 28, due = true })
  → { gruppo, tavola, setInclinazione(rad), lunghezza, xPali, hAsse, x0, xFine, yTopMod, zMod }
    tracker 2P: tubo di torsione quadrato lungo +X, 5 pali a H con cuscinetti, binari, staffe, morsetti con bullone,
    riduttore + motore + cavo sul palo centrale, ombre di contatto. Origine a terra sotto il primo palo.
    setInclinazione(+rad) inclina il vetro verso +Z.

creaFila({ tracker = 3, passo = 7, moduli = 28 })
  → { gruppo, tracker: [...], setInclinazione(rad) }   il primo a z = 0, gli altri verso -z.

creaAgrivoltaico({ campate = 4, altezza = 4.5 })
  → { gruppo, piano, lunghezza, altezza }   pali e travi d'acciaio, moduli fissi a 12° a 4,5 m; lungo +X da x = 0.

materialiPannello()
  → { vetro, cornice, cella, retro, acciaio, zincato, inox, bullone, plastica, alluminioChiaro }
    materiali condivisi (uno stile può ritoccare colore / envMapIntensity).

ombraContatto(larghezza, profondita, { opacita = 0.55, colore = 0 })
  → THREE.Mesh piano orizzontale (origine al centro, y = 0.006) con sfumatura radiale, trasparente, renderOrder -4.
```

## Come usarli

```js
const fila = creaFila();           scene.add(fila.gruppo);  fila.setInclinazione(THREE.MathUtils.degToRad(25));
const agri = creaAgrivoltaico();   agri.gruppo.position.z = -27;  scene.add(agri.gruppo);
```
Serve `scene.environment` (PMREM) con qualche pannello chiaro e un soffitto scuro: il vetro è nero e vive solo di riflessi
(strato additivo con Fresnel vero sopra le celle), quindi riflette ciò che lo stile mette nella mappa d'ambiente.

## Pagina di prova

`index.html` + `main.js`: studio neutro, `?luce=nero|bianco|dorata`, `window.__eri = { pronto, vai(posa), info(), errori }`,
pose `eroe`, `dettaglio`, `fila`, `retro`. Vista "fila" (3 tracker + agrivoltaico): ~157k triangoli, ~101 chiamate.
Moduli e pezzi ripetuti sono `InstancedMesh`; una sola texture delle celle (2048 × 4096).
