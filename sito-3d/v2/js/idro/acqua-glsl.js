// =============================================================================
// ERI v2 · idro/acqua-glsl.js — shader dell'acqua della VALLE (file privato di idro/acqua.js)
// Proprietario: [VALLE]. Si importa SOLO da idro/acqua.js.
// Specifica: DESIGN §6.7 "Acqua" (getti, spruzzi, linee di corrente su DataTexture con interpolazione manuale,
// colonne del diagramma), tema chiaro: tutto INCHIOSTRO e vetro d'acqua, NormalBlending, niente somma HDR.
//
// I colori arrivano già riportati in HDR (versoScena, in acqua.js): a schermo escono esattamente quelli di palette.
// Nomi GLSL con prefisso ac/uAc per non scontrarsi con quelli di three.
// =============================================================================

// ---------------------------------------------------------------- rumore (valore, periodico in x)
export const GLSL_RUMORE = /* glsl */`
float acHash( vec2 p ) { p = fract( p * vec2( 123.34, 456.21 ) ); p += dot( p, p + 45.32 ); return fract( p.x * p.y ); }
// rumore di valore con periodo per in x (attorno al getto l'angolo non ha cuciture)
float acRumoreP( vec2 p, float per ) {
  vec2 i = floor( p ), f = fract( p ); f = f * f * ( 3.0 - 2.0 * f );
  float i0 = mod( i.x, per ), i1 = mod( i.x + 1.0, per );
  float a = acHash( vec2( i0, i.y ) ), b = acHash( vec2( i1, i.y ) );
  float c = acHash( vec2( i0, i.y + 1.0 ) ), d = acHash( vec2( i1, i.y + 1.0 ) );
  return mix( mix( a, b, f.x ), mix( c, d, f.x ), f.y );
}
float acRumore( vec2 p ) { return acRumoreP( p, 1e4 ); }
`;

// ---------------------------------------------------------------- getti Pelton (vetro d'acqua)
// Cilindro lungo +y locale (0 = ugello, uL = cucchiaio). Fronte arrotondato che avanza (STATO.getti),
// increspatura del raggio (§6.7), filamenti di rumore che scorrono, bordo azzurro, riflesso morbido dall'alto.
export const VS_GETTO = /* glsl */`
uniform float uTempo, uFronte, uR, uL;
varying vec3 vW, vN, vL;
varying float vAm;
void main() {
  vec3 p = position;
  float a = p.y, am = a * 10.0;                          // u e metri lungo il getto
  float rip = 1.0 + 0.04 * sin( am * 14.0 - uTempo * 45.0 ) + 0.02 * sin( am * 31.0 - uTempo * 70.0 );
  vec2 rad = normalize( position.xz + 1e-7 );
  // fronte arrotondato solo mentre avanza: arrivato al cucchiaio il getto è pieno fino all'impatto
  float kc = 1.0 - smoothstep( 0.9, 0.99, uFronte / uL );
  float rc = uR * 1.8, e = a - ( uFronte - rc ), q = clamp( e / rc, 0.0, 1.0 ) * kc;
  float cap = e > 0.0 ? sqrt( max( 0.0, 1.0 - q * q ) ) : 1.0;
  if ( a > uFronte + 1e-5 ) { p.y = uFronte; cap = 0.0; q = 1.0; }
  p.xz *= rip * cap;
  vec3 nl = normalize( vec3( rad.x * max( cap, 0.05 ), e > 0.0 ? q : 0.0, rad.y * max( cap, 0.05 ) ) );
  vec4 w = modelMatrix * vec4( p, 1.0 );
  vW = w.xyz; vN = normalize( mat3( modelMatrix ) * nl ); vL = position; vAm = am;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
export const FS_GETTO = /* glsl */`
uniform float uTempo, uAlfa;
uniform vec3 uAcBianco, uAcCorpo, uAcBordo, uAcLuce, uAcInch;
varying vec3 vW, vN, vL;
varying float vAm;
${GLSL_RUMORE}
void main() {
  vec3 V = normalize( cameraPosition - vW ), N = normalize( vN );
  float nvs = dot( N, V ), nv = clamp( abs( nvs ), 0.0, 1.0 ), F = 1.0 - nv;
  // filamenti: rumore allungato lungo il getto, scorre con l'acqua (tempo idro: fermo nel macro a ×1/1000)
  float ang = atan( vL.z, vL.x ) / 6.2831853 + 0.5;
  float sc = vAm - uTempo * 6.0;
  float fil = 0.62 * acRumoreP( vec2( ang * 9.0, sc * 2.4 ), 9.0 ) + 0.38 * acRumoreP( vec2( ang * 23.0, sc * 6.5 ), 23.0 );
  // fili lunghi e sottili (il getto è teso: le vene corrono dritte), visti nel macro
  float vena = acRumoreP( vec2( ang * 31.0, sc * 0.9 ), 31.0 );
  // vetro d'acqua: centro velato (si intravede il cucchiaio), corpo azzurro, bordo denso
  vec3 c = mix( uAcBianco, uAcCorpo, smoothstep( 0.0, 0.75, F ) );
  c = mix( c, uAcBordo, smoothstep( 0.45, 1.0, F ) * 0.85 );
  c = mix( c, uAcBordo, smoothstep( 0.5, 0.9, fil ) * 0.32 * ( 1.0 - F ) );    // vene più dense
  c = mix( c, uAcBianco, smoothstep( 0.42, 0.12, fil ) * 0.45 );                // e più chiare
  c = mix( c, uAcBordo, smoothstep( 0.72, 0.9, vena ) * 0.28 );                 // fili
  // riflessi: una luce morbida dall'alto (softbox, il filo lungo il getto) e un filo di controluce
  vec3 H1 = normalize( normalize( vec3( -0.2, 0.95, 0.25 ) ) + V );
  vec3 H2 = normalize( normalize( vec3( 0.3, -0.5, -0.8 ) ) + V );
  float s1 = pow( max( dot( N, H1 ), 0.0 ), 140.0 ), s2 = pow( max( dot( N, H2 ), 0.0 ), 50.0 ) * 0.45;
  c = mix( c, uAcLuce, clamp( s1 + s2, 0.0, 1.0 ) * 0.95 );
  float a = mix( 0.42, 0.95, pow( F, 1.25 ) ) * mix( 0.85, 1.0, fil ) + 0.4 * ( s1 + s2 );
  // filo del contorno a inchiostro, ~1 px: il getto si stacca netto anche dal bianco della sala
  float fw = max( fwidth( nvs ), 1e-5 ), filo = 1.0 - smoothstep( 0.6, 1.6, nv / fw );
  c = mix( c, uAcInch, filo * 0.8 ); a = max( a, filo * 0.9 );
  gl_FragColor = vec4( c, clamp( a, 0.0, 1.0 ) * uAlfa );
}`;

// ---------------------------------------------------------------- lame e spruzzi: gocce balistiche con la scia
// Un quad istanziato per goccia (§6.7: t = fract(tempo·rate + seme.w); pos = origine + v·τ + ½·g·τ²), disegnato come
// capsula in px fra la posizione e quella di uScia secondi idro prima: a ×1/1000 gocce ferme e nitide (la foto ad
// alta velocità), a ×1/8 strisce corte (niente salti di decine di px per fotogramma). Diametro in u → px con il DPR
// del buffer. Due popolazioni per zona d'impatto: LAMA (ventaglio stretto e fitto ai lati della cresta, deviato di
// ≈165°: il fronte avanza con STATO.lame) e SPRUZZI (ventaglio largo e rado, accesi da STATO.spruzzi).
export const VS_GOCCE = /* glsl */`
attribute vec4 aSeme;
uniform float uTempo, uRate, uVita, uScia, uDensita, uFronte, uAlfa;
uniform vec3 uO, uJ, uWr;
uniform vec4 uVentaglio;   // indietro (× j), di lato (× ±z), apertura lungo il raggio, apertura lungo j
uniform vec4 uVel;         // velocità min, max (u/s); diametro min, max (u)
uniform vec2 uRis;
varying vec2 vQ;
varying float vA, vR, vL, vG;
vec3 acPos( float tau, vec3 o, vec3 d, float vel ) { return o + d * vel * tau + vec3( 0.0, -0.4905, 0.0 ) * tau * tau; }
void main() {
  float t = fract( uTempo * uRate + aSeme.w ), tau = t * uVita;
  float sig = aSeme.x < 0.5 ? -1.0 : 1.0, sx = fract( aSeme.x * 2.0 );
  vec3 z = vec3( 0.0, 0.0, 1.0 );
  // origine lungo il labbro del cucchiaio, ai due lati della cresta
  vec3 o = uO + uJ * ( 0.001 + 0.003 * aSeme.y ) + z * sig * ( 0.012 + 0.004 * sx ) + uWr * ( aSeme.y - 0.5 ) * 0.024;
  // velocità assoluta d'uscita: quasi di lato (±z), un poco indietro, ventaglio lungo il raggio
  vec3 d = normalize( -uJ * uVentaglio.x * ( 0.5 + aSeme.z ) + z * sig * uVentaglio.y
                    + uWr * ( ( sx - 0.5 ) * uVentaglio.z + ( aSeme.y - 0.5 ) * 0.04 ) + uJ * ( fract( aSeme.w * 13.7 ) - 0.5 ) * uVentaglio.w );
  float vel = mix( uVel.x, uVel.y, aSeme.z * aSeme.z );
  vec3 p1 = acPos( tau, o, d, vel ), p0 = acPos( max( tau - uScia, 0.0 ), o, d, vel );
  vec4 c1 = projectionMatrix * viewMatrix * vec4( p1, 1.0 ), c0 = projectionMatrix * viewMatrix * vec4( p0, 1.0 );
  float dist = max( c1.w, 1e-4 );
  float dia = mix( uVel.z, uVel.w, sx * sx * sx ) * ( 1.0 - 0.35 * t );
  float px = dia * projectionMatrix[ 1 ][ 1 ] * 0.5 * uRis.y / dist;
  float on = step( fract( aSeme.w * 7.31 + aSeme.z * 3.17 ), uDensita ) * step( t, uFronte );
  float area = clamp( px / 1.4, 0.0, 1.0 );
  // le gocce che volano verso la camera si spengono prima di arrivarle addosso (niente strisce enormi sul testo)
  vA = on * smoothstep( 0.0, 0.05, t ) * ( 1.0 - smoothstep( 0.65, 1.0, t ) ) * smoothstep( 0.035, 0.075, dist ) * area * uAlfa;
  vG = clamp( ( px - 2.5 ) / 6.0, 0.0, 1.0 );
  // capsula in px: dal punto di ieri (coda) a quello di oggi (testa)
  vec2 s1 = c1.xy / c1.w * 0.5 * uRis, s0 = c0.xy / max( c0.w, 1e-4 ) * 0.5 * uRis;
  vec2 dv = s1 - s0; float L = length( dv ); vec2 ax = L > 1e-3 ? dv / L : vec2( 1.0, 0.0 ), ay = vec2( -ax.y, ax.x );
  float r = 0.5 * clamp( px, 1.4, 40.0 ) + 0.6;
  L = min( L, 60.0 );
  vec2 q = vec2( mix( -r, L + r, position.x * 0.5 + 0.5 ), position.y * r );
  vQ = q; vR = r - 0.6; vL = L;
  vec2 sp = s1 - ax * L + ax * q.x + ay * q.y;
  gl_Position = vec4( sp / ( 0.5 * uRis ) * c1.w, c1.z, c1.w );
  if ( vA < 0.002 ) gl_Position = vec4( 2.0, 2.0, 2.0, 1.0 );
}`;
// goccia: lente piena azzurra (niente centro chiaro: sembrerebbe una bolla), bordo netto, punto di luce sulle grandi;
// la scia sfuma verso la coda
export const FS_GOCCE = /* glsl */`
uniform vec3 uAcCorpo, uAcBordo, uAcLuce;
varying vec2 vQ;
varying float vA, vR, vL, vG;
void main() {
  vec2 q = vQ; float x = clamp( q.x, 0.0, vL );
  float d = length( vec2( q.x - x, q.y ) );
  float aa = clamp( vR + 0.5 - d, 0.0, 1.0 );
  if ( aa <= 0.0 ) discard;
  float coda = vL > 0.5 ? mix( 0.25, 1.0, x / vL ) : 1.0;
  float rr = d / max( vR, 0.5 );
  vec3 c = mix( uAcBordo, mix( uAcCorpo, uAcBordo, 0.3 ), vG * ( 1.0 - smoothstep( 0.2, 0.9, rr ) ) );
  vec2 h = vec2( q.x - vL, q.y ) / max( vR, 0.5 );
  c = mix( c, uAcLuce, ( 1.0 - smoothstep( 0.05, 0.4, length( h - vec2( -0.3, 0.32 ) ) ) ) * vG );
  gl_FragColor = vec4( c, vA * aa * coda * mix( 0.85, 0.72, vG ) );
}`;

// ---------------------------------------------------------------- linee di corrente (inchiostro azzurro)
// Tratti istanziati larghi uLarg px che scorrono su curve campionate in una DataTexture FloatType (NearestFilter,
// texelFetch, interpolazione MANUALE). Per curva due righe: A = punti uniformi nella risoluzione (xyz, w = scala
// del tratto), B = coordinata di flusso φ uniforme → indice frazionario in A. La testa avanza in φ a velocità
// costante (la regola di lettura); dove la curva entra nelle macchine φ corre più piano e i tratti si accorciano.
export const VS_LINEE = /* glsl */`
uniform highp sampler2D uCurve;
uniform float uS, uTempo, uLarg, uPx;
uniform vec2 uRis;
uniform vec3 uCop, uFlusso, uEstremi;
attribute vec4 aCurva;   // riga A, fase (φ), Φ, gruppo
attribute vec4 aTratto;  // velocità (φ/s), lunghezza (φ), corsia (0..1), numero di corsie
varying vec3 vP;
varying float vA, vK, vLato, vHw, vW, vTono;
// riga B: φ → (indice frazionario nella riga A, intensità dell'inchiostro, tono del filo)
vec3 acIndice( int rB, float phi, float Phi ) {
  float u = clamp( phi / Phi, 0.0, 1.0 ) * ( uS - 1.0 );
  int i = int( floor( u ) ); int i1 = min( i + 1, int( uS ) - 1 );
  vec3 a = texelFetch( uCurve, ivec2( i, rB ), 0 ).xyz, b = texelFetch( uCurve, ivec2( i1, rB ), 0 ).xyz;
  return mix( a, b, u - float( i ) );
}
void acPunto( int rA, float idx, out vec3 P, out vec3 T, out float mu ) {
  int n = int( uS ) - 1;
  int i = clamp( int( floor( idx ) ), 0, n - 1 );
  vec4 a = texelFetch( uCurve, ivec2( i, rA ), 0 ), b = texelFetch( uCurve, ivec2( i + 1, rA ), 0 );
  float f = clamp( idx - float( i ), 0.0, 1.0 );
  P = mix( a.xyz, b.xyz, f ); T = b.xyz - a.xyz; mu = mix( a.w, b.w, f );
}
void main() {
  float k = position.x, lato = position.y;
  int rA = int( aCurva.x + 0.5 ), rB = rA + 1;
  float Phi = aCurva.z, L = aTratto.y;
  float testa = mod( aCurva.y + aTratto.x * uTempo, Phi + L );
  vec3 P, T; float mu;
  acPunto( rA, acIndice( rB, min( testa, Phi ), Phi ).x, P, T, mu );
  float phi = testa - k * L * mu;
  float dentro = step( 0.0, phi ) * step( phi, Phi );
  float pc = clamp( phi, 0.0, Phi );
  float m2;
  vec3 ib = acIndice( rB, pc, Phi );
  acPunto( rA, ib.x, P, T, m2 );
  vTono = ib.z;
  int g = int( aCurva.w + 0.5 );
  float cop = g == 0 ? uCop.x : ( g == 1 ? uCop.y : uCop.z );
  float flu = g == 0 ? uFlusso.x : ( g == 1 ? uFlusso.y : uFlusso.z );
  float corsia = clamp( ( flu - aTratto.z ) * aTratto.w, 0.0, 1.0 );
  float estremi = smoothstep( 0.0, uEstremi.x, pc ) * ( 1.0 - smoothstep( Phi - uEstremi.y, Phi, pc ) );
  vA = cop * ib.y * corsia * estremi * dentro * pow( 1.0 - k, 1.35 );
  vK = k; vP = P;
  // spessore costante in px: offset perpendicolare alla tangente proiettata
  vec4 c0 = projectionMatrix * viewMatrix * vec4( P, 1.0 );
  vec3 Tn = normalize( T + vec3( 1e-7 ) );
  vec4 c1 = projectionMatrix * viewMatrix * vec4( P + Tn * 0.004 * max( c0.w, 0.05 ), 1.0 );
  vec2 d = ( c1.xy / c1.w - c0.xy / c0.w ) * uRis;
  float ld = length( d ); d = ld > 1e-6 ? d / ld : vec2( 1.0, 0.0 );
  float w = uLarg * uPx * mix( 1.0, 0.5, k );
  vW = 0.5 * w; vHw = 0.5 * w + 0.8; vLato = lato;
  c0.xy += vec2( -d.y, d.x ) * lato * vHw * 2.0 / uRis * c0.w;
  gl_Position = vA < 0.002 ? vec4( 2.0, 2.0, 2.0, 1.0 ) : c0;
}`;
export const FS_LINEE = /* glsl */`
uniform vec3 uAcInch, uAcChiaro, uAcNucleo;
uniform float uYF, uZK;
uniform vec4 uBoxF, uBoxK;   // x0, x1, y0, y1 delle sale tagliate (Francis da YF, Kaplan da ZK)
uniform vec3 uAsseK;         // asse della Kaplan (x, z) e raggio dell'anello di scarico: dentro, la vena resta intera
varying vec3 vP;
varying float vA, vK, vLato, vHw, vW, vTono;
void main() {
  // tagli: le linee seguono le sezioni delle macchine (niente acqua dove l'involucro è stato aperto)
  if ( vP.z > 0.0 ) discard;
  if ( vP.x > uBoxF.x && vP.x < uBoxF.y && vP.y > uBoxF.z && vP.y < uBoxF.w && vP.y > uYF ) discard;
  // Kaplan: semi-chiocciola, gomito e diffusore restano aperti a metà da ZK; nella girante e nel cono (dentro l'anello
  // di scarico, aperto dal taglio) la vena si vede intera, come in uno spaccato
  if ( vP.x > uBoxK.x && vP.x < uBoxK.y && vP.y > uBoxK.z && vP.y < uBoxK.w && vP.z > uZK
       && length( vP.xz - uAsseK.xy ) > uAsseK.z ) discard;
  float dpx = abs( vLato ) * vHw;
  float a = vA * clamp( vW + 0.5 - dpx, 0.0, 1.0 ) * min( 2.0 * vW, 1.0 );
  if ( a < 0.003 ) discard;
  // filo a due toni: anima chiara e bordi a inchiostro. Tono 0 (fondi chiari: plastico, canali azzurri): anima
  // sottile, si legge il blu; tono 1 (fondi scuri: casse della Francis): anima larga, restano due fili di bordo
  float a0 = mix( 0.05, 0.4, vTono ), a1 = mix( 0.4, 0.8, vTono );
  float anima = 1.0 - smoothstep( a0 * vW, a1 * vW, dpx );
  vec3 c = mix( uAcInch, uAcNucleo, anima * mix( 0.55, 0.95, vTono ) );
  c = mix( c, uAcChiaro, smoothstep( 0.4, 1.0, vK ) * 0.35 * vTono );
  gl_FragColor = vec4( c, a );
}`;

// ---------------------------------------------------------------- colonne del diagramma (vetro d'acqua)
// Cilindro aperto (y 0..1, scala = raggio e altezza). Corpo velato azzurro (fresnel), filo del contorno a inchiostro,
// N linee di corrente che CADONO lungo la colonna (N = linee della turbina, velocità ∝ √(2gH)), riflesso verticale.
export const VS_COLONNA = /* glsl */`
varying vec3 vW, vN, vL;
void main() {
  vec4 w = modelMatrix * vec4( position, 1.0 );
  vW = w.xyz; vL = position;
  vN = normalize( mat3( modelMatrix ) * normalize( vec3( position.x, 0.0, position.z ) + 1e-7 ) );
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
export const FS_COLONNA = /* glsl */`
uniform float uN, uV, uTempo, uAlfa, uPasso, uTh0, uPx;
uniform vec3 uAcTinta, uAcProfondo, uAcInch, uAcLuce;
varying vec3 vW, vN, vL;
void main() {
  vec3 V = normalize( cameraPosition - vW ), N = normalize( vN );
  float nv = dot( N, V ), F = 1.0 - abs( nv );
  float fronte = gl_FrontFacing ? 1.0 : 0.0;
  // corpo: vetro pieno d'acqua, azzurro velato, più denso sui bordi e un poco più profondo in basso
  vec3 c = mix( uAcTinta, uAcProfondo, 0.15 + 0.6 * pow( F, 1.4 ) );
  c = mix( c, uAcProfondo, ( 1.0 - clamp( vL.y, 0.0, 1.0 ) ) * 0.2 );
  float a = mix( 0.34, 0.66, pow( F, 1.6 ) ) * mix( 0.55, 1.0, fronte );
  // filo del contorno (sagoma), ~1,4 px
  float fwn = max( fwidth( nv ), 1e-5 );
  float filo = 1.0 - smoothstep( 0.8 * uPx, 2.1 * uPx, abs( nv ) / fwn );
  // corsie: N linee di corrente attorno alla colonna, 0 = verso la camera (+z)
  float th = atan( vL.x, vL.z );
  float th2 = mod( th + 6.2831853, 6.2831853 );
  float fwt = max( min( fwidth( th ), fwidth( th2 ) ), 1e-5 );
  float passo = 6.2831853 / uN;
  float x = th - uTh0 + 0.5 * passo;
  float corsiaI = floor( x / passo );
  float dth = abs( x - ( corsiaI + 0.5 ) * passo );
  float corsia = 1.0 - smoothstep( 0.6 * uPx, 1.5 * uPx, dth / fwt );
  float ph = fract( ( vW.y + uV * uTempo ) / uPasso + fract( sin( corsiaI * 12.9898 + 4.1 ) * 43758.5453 ) );
  float tratto = smoothstep( 0.0, 0.035, ph ) * ( 1.0 - smoothstep( 0.06, 0.52, ph ) );
  float lin = corsia * tratto * mix( 0.45, 1.0, fronte );
  // riflessi verticali del vetro (solo davanti): una banda morbida e un filo netto
  vec3 H = normalize( normalize( vec3( -0.55, 0.25, 0.8 ) ) + V );
  float nh = max( dot( N, H ), 0.0 );
  float sp = ( pow( nh, 260.0 ) * 0.9 + pow( nh, 24.0 ) * 0.22 ) * fronte;
  c = mix( c, uAcLuce, clamp( sp, 0.0, 1.0 ) ); a = max( a, sp * 0.6 );
  c = mix( c, uAcInch, lin * 0.92 ); a = max( a, lin * 0.85 );
  c = mix( c, uAcInch, filo * 0.9 ); a = max( a, filo * 0.85 );
  gl_FragColor = vec4( c, a * uAlfa );
}`;
// Pelo libero in cima alla colonna: ellisse velata con il menisco a inchiostro.
export const VS_CIMA = /* glsl */`
varying vec2 vQ;
void main() { vQ = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); }`;
export const FS_CIMA = /* glsl */`
uniform float uAlfa, uPx;
uniform vec3 uAcTinta, uAcInch;
varying vec2 vQ;
void main() {
  float r = length( vQ ), fw = max( fwidth( r ), 1e-5 );
  float dentro = 1.0 - smoothstep( 1.0 - fw, 1.0, r );
  if ( dentro <= 0.0 ) discard;
  float anello = 1.0 - smoothstep( 0.7 * uPx, 1.9 * uPx, abs( r - 1.0 + 0.8 * fw ) / fw );
  float menisco = ( 1.0 - smoothstep( 0.4 * uPx, 1.2 * uPx, abs( r - 0.86 ) / fw ) ) * 0.4;
  vec3 c = mix( uAcTinta, uAcInch, max( anello, menisco ) );
  float a = max( 0.34 * dentro, max( anello * 0.9, menisco ) );
  gl_FragColor = vec4( c, a * uAlfa );
}`;
