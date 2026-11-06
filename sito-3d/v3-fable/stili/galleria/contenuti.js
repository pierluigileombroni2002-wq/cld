// =====================================================================================================
//  TESTI DEL SITO ERI · Galleria Bianca
//  Tutte le scritte del sito stanno qui. Per cambiarle basta modificare il testo tra gli apici '...'.
//
//  Regole semplici:
//   - ogni testo sta tra apici singoli: 'Così'. Se nel testo serve un apostrofo, scrivilo come \'
//     (esempio: 'L\'energia che'); in alternativa usa l'apostrofo tipografico ’ che non dà problemi;
//   - dopo ogni voce c'è una virgola;
//   - i titoli sono divisi in righe: ogni riga è un testo tra apici, dentro le parentesi quadre [ ... ];
//   - le righe che iniziano con // sono note e non compaiono sul sito.
//  Dopo una modifica, ricarica la pagina. Le macchine si risistemano da sole attorno ai testi nuovi.
// =====================================================================================================

export const CONTENUTI = {

  // ---------- la pagina (titolo della scheda del browser e descrizione per i motori di ricerca) ----------
  pagina: {
    titolo: 'ERI · Energie Rinnovabili Italia',
    descrizione: 'ERI sviluppa, autorizza, costruisce e gestisce impianti fotovoltaici, agrivoltaici, di accumulo e idroelettrici.',
  },

  // ---------- menu in alto ----------
  menu: {
    fotovoltaico: 'Fotovoltaico',
    bess: 'Accumulo',
    idroelettrico: 'Idroelettrico',
    servizi: 'Servizi',
    contatti: 'Contatti',
  },

  // ---------- 1 · apertura ----------
  apertura: {
    titolo: ['Dal disegno', 'alla rete.'],
    testo: 'Fotovoltaico, accumulo e idroelettrico. Di ogni impianto seguiamo tutto l’iter: dallo sviluppo alla gestione.',
    bottone: 'Parliamo del progetto',
    invito: 'Scorri',
  },

  // ---------- le cinque fasi dell'iter (uguali per ogni impianto) ----------
  fasi: [
    { nome: 'Sviluppo',       descrizione: 'Terreno, studio e progetto.' },
    { nome: 'Autorizzazioni', descrizione: 'Permessi e connessione alla rete.' },
    { nome: 'Ready to Build', descrizione: 'Pronto per il cantiere.' },
    { nome: 'Costruzione',    descrizione: 'Cantiere e collaudo.' },
    { nome: 'Gestione',       descrizione: 'Esercizio e manutenzione, per tutta la vita dell’impianto.' },
  ],

  // ---------- 2 · fotovoltaico ----------
  fotovoltaico: {
    etichetta: '01 · Fotovoltaico e agrivoltaico',
    titolo: ['Seguire il sole,', 'ogni giorno.'],
    testo: ['Tracker a terra e filari agrivoltaici alti,', 'progettati e costruiti da ERI fino alla rete.'],
  },

  // ---------- 3 · accumulo ----------
  bess: {
    etichetta: '02 · Accumulo BESS',
    titolo: ['L’energia che', 'aspetta.'],
    testo: ['Batterie che conservano l’energia', 'e la restituiscono alla rete quando serve.'],
  },

  // ---------- 4 · idroelettrico ----------
  idroelettrico: {
    etichetta: '03 · Idroelettrico',
    titolo: ['L’acqua, con la', 'turbina giusta.'],
    testo: ['Pelton per i salti alti, Francis per quelli medi,', 'Kaplan per i salti bassi.'],
    // le targhette sotto le tre turbine
    turbine: {
      pelton: ['Pelton', 'Salto alto'],
      francis: ['Francis', 'Salto medio'],
      kaplan: ['Kaplan', 'Salto basso'],
    },
  },

  // ---------- 5 · servizi ----------
  servizi: {
    etichetta: '04 · Servizi',
    titolo: ['I nostri', 'servizi.'],
    testo: 'Consulenza per impianti fotovoltaici, agrivoltaici, di accumulo e idroelettrici, dal primo sopralluogo alla gestione.',
    // l'elenco: si possono aggiungere, togliere o riordinare le voci (una per riga)
    elenco: [
      'Screening preliminare vincolistico',
      'Realizzazione del primo layout',
      'Energy assessment (stima della producibilità)',
      'Sopralluoghi e incontri con i proprietari terrieri',
      'Ricerca tecnologica sui moduli fotovoltaici',
      'Project development management',
      'Gestione dei portali per la connessione elettrica e il GSE',
      'Budget di costruzione, ricerca di fornitori e subappaltatori',
      'Procurement e contratti di acquisto',
      'Project management in fase di costruzione',
      'Asset management',
      'Studi di efficientamento energetico',
    ],
  },

  // ---------- 6 · contatti ----------
  contatti: {
    etichetta: '05 · Contatti',
    titolo: ['Parliamo', 'del progetto.'],
    testo: 'Un terreno, un’idea, un impianto da far crescere: raccontaci da dove parti.',
    modulo: {
      nome: 'Nome',
      email: 'Email',
      messaggio: 'Messaggio',
      invia: 'Invia',
      nota: 'Pagina di prova: il modulo non invia dati.',
      conferma: 'Grazie, ti scriviamo entro due giorni.',
    },
    // i recapiti sotto il modulo: testo da mostrare e, se serve, il collegamento
    //   email:     link: 'mailto:indirizzo@dominio.it'
    //   telefono:  link: 'tel:+390000000000'   (senza spazi)
    //   sito/mappa: link: 'https://...'
    //   solo testo (indirizzo, partita IVA...): link: ''
    recapiti: [
      { testo: 'info@eri-esempio.it', link: 'mailto:info@eri-esempio.it' },
      { testo: '+39 000 000 0000', link: 'tel:+39000000000' },
      // esempi da completare:
      // { testo: 'Via Esempio 1, 00100 Roma', link: '' },
      // { testo: 'P. IVA 00000000000', link: '' },
    ],
  },
};
