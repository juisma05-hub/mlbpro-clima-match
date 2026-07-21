/*
  MLBPro · estadios.js

  FUNCIÓN:
  Fuente única de datos de estadios: coordenadas, timezone, roof, alias de
  nombre de parque, y funciones de resolución de venue. Es la BASE de la
  cadena — se carga antes que clima-cache.js, jalar-clima.js,
  score-match.js, casar-series-test.html y calcular-coincidencia.js.

  ENTRADAS:
  Ninguna en tiempo de carga (dato estático, hardcodeado). stadiumGet(),
  stadiumCanonName() y stadiumNorm() reciben un string de venue.

  SALIDAS / MODIFICACIONES:
  Expone STADIUM_COORDS_2026, STADIUM_ESPECIALES_2026, STADIUM_INDEX
  (Map), STADIUM_ALIAS_2026, stadiumNorm(), stadiumCanonName(),
  stadiumGet(). No escribe ninguna caché ni localStorage.

  DEPENDENCIAS:
  Ninguna — es la base de la cadena. Debe cargarse ANTES que cualquier
  archivo que use stadiumNorm(), stadiumGet(), stadiumCanonName() o
  STADIUM_INDEX.

  NO TOCA:
  clima, carreras, score, series, Data Madre. No hace fetch, no escribe
  caché ni localStorage.

  UTC / HORA LOCAL:
  No aplica directamente — este archivo solo EXPONE el campo timezone de
  cada parque (ej. "America/Los_Angeles"), no hace ninguna conversión de
  hora por sí mismo. La conversión real vive en clima-cache.js
  (climaKeyTZ), que consume este campo.

  QUÉ HACE: da coordenadas/timezone/roof por parque, resuelve nombres de
  patrocinio a nombre canónico (stadiumCanonName), y resuelve el objeto
  completo del estadio a partir de cualquier variante de nombre
  (stadiumGet).

  QUÉ NO HACE: no decide clima, no calcula Coincidencia/F5/K6, no aplica
  ninguna Regla Madre de fechas/carreras (esa vive en clima-cache.js).

  QUÉ AFECTA: absolutamente todo lo que necesita resolver un parque —
  clima-cache.js, jalar-clima.js, score-match.js, calcular-coincidencia.js,
  casar-series-test.html, brujula-parque-test.html, parques-orientacion.js,
  orientacion-parques.js, y transitivamente F5/K6/MoneyLine/index.html.

  QUÉ NO AFECTA: nada decide su propio comportamiento — es puramente
  fuente de datos y resolución de nombres, sin lógica de negocio propia.

  REGLA MADRE (del propio archivo, sin cambios): este archivo es el
  ÚNICO lugar donde debe vivir el mapeo canónico de nombres de parque
  (alias → canónico). Ningún otro archivo debe mantener su propio
  mapeo de alias de parque en paralelo — todos deben resolver el parque
  a través de stadiumGet()/stadiumCanonName(). (Nota de auditoría,
  Bloque 3: esta regla se violaba en parques-orientacion.js y
  brisa-geo-parques.js — ya corregido, ver sus propios prólogos,
  Problemas #11/#12).

  ESTADO:
  CONFIRMADO — auditado en el Bloque 3, sin bugs encontrados, sin
  cambios de lógica. Prólogo agregado (el archivo ya tenía un
  encabezado detallado, pero no el formato obligatorio completo).

  FECHA:
  12 jul 2026.
*/

// estadios.js
//
// RUTA: Fuente única de datos de estadios (coordenadas, timezone, roof,
//   alias de nombre de parque, y funciones de resolución de venue). Está
//   en la BASE de la cadena — se carga antes que clima-cache.js,
//   jalar-clima.js, score-match.js, casar-series-test.html y
//   calcular-coincidencia.js.
//
// RECIBE DE: nada. Es dato estático (hardcodeado), sin fetch ni
//   dependencia de otros archivos.
//
// ENTREGA A: jalar-clima.js (stadiumNorm, STADIUM_INDEX), clima-cache.js
//   (indirectamente, vía el objeto "s" que jalar-clima.js le pasa a sus
//   funciones), score-match.js (stadiumGet, STADIUM_INDEX, stadiumNorm,
//   stadiumCanonName), calcular-coincidencia.js (stadiumGet),
//   casar-series-test.html (stadiumCanonName, stadiumGet), y
//   transitivamente index.html, F5, K6, Moneyline y cualquier módulo que
//   necesite resolver o comparar nombres de parque.
//
// NO TOCA: clima, carreras, score, series ni Data Madre. No hace fetch, no
//   escribe caché, no escribe localStorage.
//
// REGLA MADRE: Este archivo es el ÚNICO lugar donde debe vivir el mapeo
//   canónico de nombres de parque (alias -> canónico). Ningún otro archivo
//   debe mantener su propio mapeo de alias de parque en paralelo — todos
//   deben resolver el parque a través de stadiumGet()/stadiumCanonName().
//
// DEPENDENCIAS OBLIGATORIAS: ninguna (es la base de la cadena). Debe
//   cargarse ANTES que cualquier archivo que use stadiumNorm(),
//   stadiumGet(), stadiumCanonName() o STADIUM_INDEX.
//
// SALIDA: STADIUM_COORDS_2026 (array de los 30 parques estándar),
//   STADIUM_ESPECIALES_2026 (array de sedes neutrales/especiales),
//   STADIUM_INDEX (Map venue-normalizado -> objeto estadio, incluye
//   estándar + especiales + alias), STADIUM_ALIAS_2026 (mapa alias ->
//   nombre canónico), stadiumNorm(), stadiumCanonName(), stadiumGet().
//
// SI ESTE ARCHIVO FALLA: se cae toda la cadena — clima-cache.js /
//   jalar-clima.js no pueden resolver coordenadas/timezone/roof,
//   score-match.js no puede aplicar el interruptor de domo fijo,
//   calcular-coincidencia.js y casar-series-test.html no pueden confirmar
//   "mismo parque" (todo devuelve SIN_HISTORICO_MISMO_PARQUE /
//   VENUE_HOY_NO_RECONOCIDO), y F5/K6/Moneyline pierden la fuente única de
//   nombres de parque.
//
// PIEZA 4a - datos de estadios 2026 (coordenadas + roof).
// Copiados IDENTICOS de la app JALAR historial. No se cambio ningun valor.
// Dato centralizado, no suelto dentro del jalador.

const STADIUM_COORDS_2026 = [
  { venue:"Oriole Park at Camden Yards", lat:39.2839, lon:-76.6217, timezone:"America/New_York", roof:"open" },
  { venue:"Fenway Park", lat:42.3467, lon:-71.0972, timezone:"America/New_York", roof:"open" },
  { venue:"Yankee Stadium", lat:40.8296, lon:-73.9262, timezone:"America/New_York", roof:"open" },
  { venue:"Tropicana Field", lat:27.7682, lon:-82.6534, timezone:"America/New_York", roof:"fixed_dome" },
  { venue:"Rogers Centre", lat:43.6414, lon:-79.3894, timezone:"America/Toronto", roof:"retractable" },
  { venue:"Rate Field", lat:41.8299, lon:-87.6338, timezone:"America/Chicago", roof:"open" },
  { venue:"Progressive Field", lat:41.4962, lon:-81.6852, timezone:"America/New_York", roof:"open" },
  { venue:"Comerica Park", lat:42.3390, lon:-83.0485, timezone:"America/Detroit", roof:"open" },
  { venue:"Kauffman Stadium", lat:39.0517, lon:-94.4803, timezone:"America/Chicago", roof:"open" },
  { venue:"Target Field", lat:44.9817, lon:-93.2776, timezone:"America/Chicago", roof:"open" },
  { venue:"Daikin Park", lat:29.7572, lon:-95.3556, timezone:"America/Chicago", roof:"retractable" },
  { venue:"Angel Stadium", lat:33.8003, lon:-117.8827, timezone:"America/Los_Angeles", roof:"open" },
  { venue:"Sutter Health Park", lat:38.5802, lon:-121.5133, timezone:"America/Los_Angeles", roof:"open" },
  { venue:"T-Mobile Park", lat:47.5914, lon:-122.3325, timezone:"America/Los_Angeles", roof:"retractable" },
  { venue:"Globe Life Field", lat:32.7473, lon:-97.0825, timezone:"America/Chicago", roof:"retractable" },
  { venue:"Truist Park", lat:33.8907, lon:-84.4677, timezone:"America/New_York", roof:"open" },
  { venue:"loanDepot Park", lat:25.7781, lon:-80.2197, timezone:"America/New_York", roof:"retractable" },
  { venue:"Citi Field", lat:40.7571, lon:-73.8458, timezone:"America/New_York", roof:"open" },
  { venue:"Citizens Bank Park", lat:39.9061, lon:-75.1665, timezone:"America/New_York", roof:"open" },
  { venue:"Nationals Park", lat:38.8730, lon:-77.0074, timezone:"America/New_York", roof:"open" },
  { venue:"Wrigley Field", lat:41.9484, lon:-87.6553, timezone:"America/Chicago", roof:"open" },
  { venue:"Great American Ball Park", lat:39.0975, lon:-84.5067, timezone:"America/New_York", roof:"open" },
  { venue:"American Family Field", lat:43.0280, lon:-87.9712, timezone:"America/Chicago", roof:"retractable" },
  { venue:"PNC Park", lat:40.4469, lon:-80.0057, timezone:"America/New_York", roof:"open" },
  { venue:"Busch Stadium", lat:38.6226, lon:-90.1928, timezone:"America/Chicago", roof:"open" },
  { venue:"Chase Field", lat:33.4453, lon:-112.0667, timezone:"America/Phoenix", roof:"retractable" },
  { venue:"Coors Field", lat:39.7559, lon:-104.9942, timezone:"America/Denver", roof:"open" },
  { venue:"Dodger Stadium", lat:34.0739, lon:-118.2400, timezone:"America/Los_Angeles", roof:"open" },
  { venue:"Petco Park", lat:32.7073, lon:-117.1566, timezone:"America/Los_Angeles", roof:"open" },
  { venue:"Oracle Park", lat:37.7786, lon:-122.3893, timezone:"America/Los_Angeles", roof:"open" },
];

// PIEZA AGREGADA 8 jul 2026: sedes especiales / neutral_site.
// NO son parques estandar de las 30 franquicias. Se usan para que el clima,
// viento, timezone y roof dejen de caer en ERR:VENUE_NOT_IN_TABLE cuando el
// schedule trae un juego en una de estas sedes.
//
// especial:true marca explicitamente que NO deben tratarse como parque
// estandar (no llevan park factor propio, no llevan orientacion medida).
// No se agrega orientacion ni park_factor aqui: esos viven en
// parques-orientacion.js y park-factors.js, que no se tocan. Al no aparecer
// esos archivos con este venue, sus lookups devuelven NO_CONFIRMADO por
// ausencia (comportamiento ya existente en index.html y
// torear-ponches-test.html cuando getOrientacionParque devuelve undefined).
//
// Coordenadas verificadas (no aproximadas):
// - Estadio Alfredo Harp Helu: Wikidata/Wikipedia (Serie Mexico, D-backs @ Padres, 25-26 abr 2026)
// - Las Vegas Ballpark: Google Maps oficial (homestand Athletics, 8-14 jun 2026)
// - Field of Dreams (Dyersville, Iowa): coordenadas cruzadas en 2 fuentes independientes (13 ago 2026, Twins vs Phillies)
// - Historic Bowman Field (Williamsport, PA): latlong.net + direccion oficial (23 ago 2026, MLB Little League Classic)
const STADIUM_ESPECIALES_2026 = [
  { venue:"Estadio Alfredo Harp Helú", lat:19.4036, lon:-99.0853, timezone:"America/Mexico_City", roof:"open", especial:true, tipo:"neutral_site" },
  { venue:"Las Vegas Ballpark", lat:36.1532, lon:-115.3310, timezone:"America/Los_Angeles", roof:"open", especial:true, tipo:"neutral_site" },
  { venue:"Field of Dreams", lat:42.4980, lon:-91.0553, timezone:"America/Chicago", roof:"open", especial:true, tipo:"neutral_site" },
  { venue:"Historic Bowman Field", lat:41.2423, lon:-77.0475, timezone:"America/New_York", roof:"open", especial:true, tipo:"neutral_site" },
];

const STADIUM_INDEX = new Map(
  STADIUM_COORDS_2026.map(function (s) { return [stadiumNorm(s.venue), s]; })
);

// las sedes especiales se agregan al mismo indice, sin mezclarse con el
// array de los 30 parques estandar (STADIUM_COORDS_2026 queda intacto)
STADIUM_ESPECIALES_2026.forEach(function (s) {
  STADIUM_INDEX.set(stadiumNorm(s.venue), s);
});

// PIEZA AGREGADA 5 jul 2026: alias de venue por renombre de patrocinio.
// Mantener este archivo como maestro de nombres para clima, lineas,
// coincidencia, brujula, orientacion y F5.
const STADIUM_ALIAS_2026 = {
  "UNIQLO Field at Dodger Stadium": "Dodger Stadium",

  "Guaranteed Rate Field": "Rate Field",
  "US Cellular Field": "Rate Field",
  "Comiskey Park": "Rate Field",

  "loanDepot park": "loanDepot Park",
  "LoanDepot Park": "loanDepot Park",
  "Marlins Park": "loanDepot Park",

  "Minute Maid Park": "Daikin Park",

  "Miller Park": "American Family Field",

  "Oakland Coliseum": "Sutter Health Park",
  "Raley Field": "Sutter Health Park",

  "Camden Yards": "Oriole Park at Camden Yards",
  "AT&T Park": "Oracle Park",

  // sedes especiales: variantes de nombre que puede traer el schedule de MLB
  "Estadio Alfredo Harp Helu": "Estadio Alfredo Harp Helú",
  "Alfredo Harp Helu Stadium": "Estadio Alfredo Harp Helú",
  "Muncy Bank Ballpark at Historic Bowman Field": "Historic Bowman Field",
  "Journey Bank Ballpark at Historic Bowman Field": "Historic Bowman Field",
  "Bowman Field": "Historic Bowman Field"
};

Object.keys(STADIUM_ALIAS_2026).forEach(function(alias){
  var real = STADIUM_INDEX.get(stadiumNorm(STADIUM_ALIAS_2026[alias]));
  if (real) STADIUM_INDEX.set(stadiumNorm(alias), real);
});

function stadiumCanonName(venue) {
  var raw = String(venue || "").trim();
  if (!raw) return "";

  if (STADIUM_ALIAS_2026[raw]) return STADIUM_ALIAS_2026[raw];

  var rn = stadiumNorm(raw);
  for (var alias in STADIUM_ALIAS_2026) {
    if (stadiumNorm(alias) === rn) return STADIUM_ALIAS_2026[alias];
  }

  return raw;
}

function stadiumGet(venue) {
  var raw = String(venue || "").trim();
  var canon = stadiumCanonName(raw);

  return STADIUM_INDEX.get(stadiumNorm(canon)) ||
         STADIUM_INDEX.get(stadiumNorm(raw)) ||
         null;
}

function stadiumNorm(n) {
  return String(n || "").trim().toLowerCase();
}
