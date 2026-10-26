// ERI v3 · qualità a tre livelli: parte alta e scende da sola se i fotogrammi superano ~20 ms (misura reale).
// ?q=alta|media|bassa la forza e spegne l'automatismo.
export const LIVELLI = ['alta', 'media', 'bassa'];

export function creaQualita({ forzata, mobile }) {
  let i = LIVELLI.includes(forzata) ? LIVELLI.indexOf(forzata) : 0;
  const auto = !LIVELLI.includes(forzata);
  // ultimi 90 fotogrammi; "attesa" = secondi di assestamento dopo l'avvio o dopo un cambio; "tempo" = ms misurati da allora
  const camp = new Float32Array(90); let n = 0, k = 0, attesa = 2.0, somma = 0, tempo = 0;
  const dprMax = () => {
    const dev = window.devicePixelRatio || 1;
    const tetto = mobile ? [1.25, 1.1, 1.0][i] : [1.5, 1.25, 1.0][i];
    return Math.min(dev, tetto);
  };
  return {
    get livello() { return LIVELLI[i]; },
    get auto() { return auto; },
    dpr: dprMax,
    // scende di un livello (usato dalla misura e dalle verifiche)
    scendi() { if (i >= LIVELLI.length - 1) return false; i++; attesa = 1.2; camp.fill(0); somma = 0; n = 0; k = 0; tempo = 0; return true; },
    // MSAA del composer e scala del bloom (il bloom lavora già a metà risoluzione)
    msaa: () => [4, 2, 0][i],
    scalaBloom: () => [1, 1, 0.5][i],
    // media dei millisecondi per fotogramma (ultimi 90)
    get ms() { return n ? somma / n : 0; },
    get stato() { return { n, attesa: +Math.max(0, attesa).toFixed(2) }; },
    // registra un fotogramma; true se il livello è sceso
    misura(msFotogramma) {
      // scheda in secondo piano o pausa lunga: non conta. Un fotogramma lento invece conta (nella media pesa al massimo 100 ms)
      if (document.hidden || msFotogramma > 1500) return false;
      // assestamento (avvio, cambio di livello): i fotogrammi non entrano nella media
      if (auto && attesa > 0) { attesa -= msFotogramma / 1000; return false; }
      const ms = Math.min(msFotogramma, 100);
      somma -= camp[k]; camp[k] = ms; somma += ms; k = (k + 1) % camp.length; if (n < camp.length) n++;
      if (!auto || i >= LIVELLI.length - 1) return false;
      tempo += msFotogramma;
      // decide con 45 fotogrammi, o dopo 1,5 s di misure sui dispositivi molto lenti
      if (!(n >= 45 || (n >= 4 && tempo >= 1500))) return false;
      const media = somma / n;
      if (media <= 20) return false;
      // molto lento (sotto i 22 fotogrammi al secondo): scende di due livelli in una volta
      const sceso = this.scendi();
      if (media > 45) this.scendi();
      return sceso;
    },
  };
}
