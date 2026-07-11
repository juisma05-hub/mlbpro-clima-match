// ============================================================
// PRÓLOGO — parques-orientacion.js
// ============================================================
// QUÉ ES:
//   FUENTE ÚNICA del grado hpACF (Home Plate -> Centerfield) de cada
//   parque MLB, es decir hacia dónde mira el campo. Es el dato base
//   del que depende TODA la lógica de viento (mlbpro-viento.js) y la
//   brújula visual (index.html: renderBrujula).
//
// DE QUÉ DEPENDE:
//   De nada. Es standalone, debe cargar PRIMERO (antes que
//   mlbpro-viento.js, roof-status.js, y cualquier script inline que
//   llame a getOrientacionParque()).
//
// QUIÉN LO USA:
//   mlbpro-viento.js (scoreMatch, tipoBrisa), index.html (renderBrujula,
//   evaluarMercados), viento-parque.html (evaluarVientoParque).
//
// API GLOBAL (no está namespaced en un objeto, son globals directos):
//   PARQUES_ORIENTACION → objeto {nombreParque: {hpACF, roof, confianza, fuente}}
//     hpACF: number en grados, o null si "no_confirmado".
//     confianza: "exacta" | "direccion" | "contradiccion" | "no_confirmado".
//   PARQUES_ALIAS → objeto {nombreAlterno: nombreCanonico}. Nombres de
//     patrocinio viejos, apodos, o nombres previos del mismo estadio.
//
//   getOrientacionParque(venue) → number en grados (0-360).
//     Busca exacto → alias exacto → substring difuso → alias difuso.
//     Devuelve 45 (valor neutro) si no encuentra nada o si el dato
//     confirmado es null. NUNCA devuelve undefined/NaN.
//   getInfoParque(venue) → objeto completo {hpACF,roof,confianza,fuente}
//     o null si no se encuentra. Para mostrar detalle, no para cálculo.
//
// DATOS PENDIENTES (marcados "contradiccion", no inventados):
//   Daikin Park, American Family Field, Sutter Health Park.
//   Si el usuario manda coordenadas GPS nuevas de estos 3 (home plate
//   + jardín central), recalcular hpACF y subir confianza a "exacta".
//
// QUÉ TOCA:
//   Nada. Solo lectura de datos estáticos en memoria.
// ============================================================
//
// Orientacion de los 30 parques MLB - grado hpACF (Home Plate -> Centerfield).
// ACTUALIZADO 3 jul 2026 con mediciones GPS propias (3 puntos: jardin
// central, segunda base, home plate) - reemplaza valores previos menos
// precisos. Fuente de esta pasada: investigacion nueva con coordenadas.
//
// PENDIENTE DE DATO (no inventado, no confirmado todavia):
//   - Daikin Park: contradiccion NNW/NW vs NE entre fuentes, sin resolver.
//   - American Family Field: contradiccion SE vs NNW entre fuentes, sin resolver.
//   - Sutter Health Park: salto de 56 (consenso previo) a 330 (Shadium),
//     sin una segunda fuente que lo confirme.
//   - Tropicana Field: sin fuente citable, pero tiene domo fijo cerrado
//     (roof-status.js lo marca domeClosedFixed:true) asi que el viento
//     exterior no se usa para ese parque de todas formas.
// Si me pasas coordenadas GPS propias (home plate + jardin central) de
// estos 4, los actualizo con confianza:"exacta" igual que el resto.
//
// confianza: "exacta" = medicion GPS propia o grado citado puntual
// "direccion" = solo direccion cardinal, sin grado fino
// "contradiccion" = fuentes se contradicen, sin resolver
// "no_confirmado" = sin dato

var PARQUES_ORIENTACION = {
  "Wrigley Field":            { hpACF: 38,    roof:"abierto",   confianza:"exacta", fuente:"GPS propio - coincide Hardball Times/Shaded Seats" },
  "Nationals Park":           { hpACF: 27,    roof:"abierto",   confianza:"exacta", fuente:"GPS propio - contradice TickPick (ENE)" },
  "Yankee Stadium":           { hpACF: 75,    roof:"abierto",   confianza:"exacta", fuente:"GPS propio - coincide TickPick" },
  "Progressive Field":        { hpACF: 0,     roof:"abierto",   confianza:"exacta", fuente:"GPS propio - coincide exacto Clem's" },
  "Citizens Bank Park":       { hpACF: 9.5,   roof:"abierto",   confianza:"exacta", fuente:"GPS propio" },
  "T-Mobile Park":            { hpACF: 54.5,  roof:"retractil", confianza:"exacta", fuente:"GPS propio - coincide Clem's" },
  "Petco Park":               { hpACF: 1.5,   roof:"abierto",   confianza:"exacta", fuente:"GPS propio - coincide Clem's" },
  "Comerica Park":            { hpACF: 150.5, roof:"abierto",   confianza:"exacta", fuente:"GPS propio - coincide Clem's (SSE)" },
  "Dodger Stadium":           { hpACF: 26,    roof:"abierto",   confianza:"exacta", fuente:"GPS propio verificado 5 jul 2026 (home 34.073413,-118.240223 / segunda 34.073726,-118.240038 / jardin central 34.074357,-118.239658) - distancia home-segunda 38.8m calza con oficial MLB (38.79m). Reemplaza 25.5 anterior." },
  "Oracle Park":              { hpACF: 96,    roof:"abierto",   confianza:"exacta", fuente:"GPS propio - remedido" },
  "Busch Stadium":            { hpACF: 63,    roof:"abierto",   confianza:"exacta", fuente:"GPS propio - recalculado" },
  "Rate Field":               { hpACF: 127,   roof:"abierto",   confianza:"exacta", fuente:"GPS propio - recalculado" },
  "Kauffman Stadium":         { hpACF: 46.4,  roof:"abierto",   confianza:"exacta", fuente:"GPS propio del usuario 5 jul 2026 (jardin central 39.051993,-94.479810 / segunda base 39.051485,-94.480495 / home plate 39.051247,-94.480819) - distancia home-segunda 38.55m vs 38.79m oficial (0.6% margen). Reemplaza 147." },
  "PNC Park":                 { hpACF: 152.5, roof:"abierto",   confianza:"exacta", fuente:"GPS propio - recalculado" },
  "Citi Field":               { hpACF: 17,    roof:"abierto",   confianza:"exacta", fuente:"GPS propio - coincide TickPick" },
  "Target Field":             { hpACF: 86,    roof:"abierto",   confianza:"exacta", fuente:"GPS propio" },
  "Oriole Park at Camden Yards": { hpACF: 33, roof:"abierto",   confianza:"exacta", fuente:"confirmado antes de esta pasada" },
  "Coors Field":              { hpACF: 4.5,   roof:"abierto",   confianza:"exacta", fuente:"Ajuste directo confirmado por Perez 5 jul 2026 - hpACF 4.5" },
  "Fenway Park":              { hpACF: 146,   roof:"abierto",   confianza:"exacta", fuente:"GPS propio - contradice otras fuentes (decian NE), no es error de calculo" },
  "Truist Park":              { hpACF: 202,   roof:"abierto",   confianza:"exacta", fuente:"GPS propio - contradice Clem's (SSE), no es error de calculo" },
  "Angel Stadium": {
    hpACF: 17, roof:"abierto", confianza:"exacta",
    fuente:"GPS propio del usuario - aproximado, campo obstruido por pista de motocross, sin verificacion de distancia real",
    jardin_central:"33.800640,-117.882295", segunda_base:"33.800265,-117.882734", home_plate:"33.799906,-117.883171"
  },
  "Great American Ball Park": {
    hpACF: 121, roof:"abierto", confianza:"exacta",
    fuente:"GPS propio del usuario - verificado, campo visible, contra Shaded Seats/orientacion del rio",
    jardin_central:"39.096917,-84.505866", segunda_base:"39.097286,-84.506673", home_plate:"39.097470,-84.507044"
  },
  "Chase Field":              { hpACF: 23,  roof:"retractil", confianza:"exacta",    fuente:"theshadium.com" },
  "Sutter Health Park": {
    hpACF: 330, roof:"abierto", confianza:"contradiccion",
    fuente:"theshadium.com dice 330. Pasada anterior habia rechazado este valor como outlier y usaba 56 por consenso de otras fuentes. SIN SEGUNDA FUENTE QUE CONFIRME 330 - se marca contradiccion, no exacta, hasta tener una medicion GPS propia que decida."
  },
  "Globe Life Field":         { hpACF: 67.5, roof:"retractil", confianza:"direccion", fuente:"MLB.com/Rangers oficial - solo ENE, sin grado exacto" },
  "loanDepot park":           { hpACF: 135,  roof:"retractil", confianza:"direccion", fuente:"shadedseats.com - solo SE, sin grado exacto" },
  "Rogers Centre":            { hpACF: 0,    roof:"retractil", confianza:"direccion", fuente:"shadedseats.com - 'el bateador mira hacia el norte', sin grado exacto" },
  "Daikin Park": {
    hpACF: 20, roof:"retractil", confianza:"contradiccion",
    fuente:"shadedseats.com y wherestheshade.com dicen NNW/NW; houstonticketbrokers.com dice home plate mira NE (jardin central SO) - SIN RESOLVER, valor previo mantenido. Nombre 2026 de Minute Maid Park."
  },
  "American Family Field": {
    hpACF: 330, roof:"retractil", confianza:"contradiccion",
    fuente:"wherestheshade.com dice SE; theshadium.com dice NNW repetidamente - SIN RESOLVER, valor previo mantenido"
  },
  "Tropicana Field": {
    hpACF: null, roof:"domo_fijo", confianza:"no_confirmado",
    fuente:"sin fuente citable de orientacion encontrada - domo fijo cerrado (ver roof-status.js domeClosedFixed:true), se excluye del calculo de viento de todas formas"
  }
};

// Alias para nombres alternos del mismo parque (renombres de patrocinio,
// nombres usados en otros archivos del proyecto como park-factors.js).
var PARQUES_ALIAS = {
  "Guaranteed Rate Field": "Rate Field",
  "US Cellular Field": "Rate Field",
  "Comiskey Park": "Rate Field",
  "UNIQLO Field at Dodger Stadium": "Dodger Stadium",
  "Camden Yards": "Oriole Park at Camden Yards",
  "AT&T Park": "Oracle Park",
  "loanDepot Park": "loanDepot park",
  "Raley Field": "Sutter Health Park",
  "Minute Maid Park": "Daikin Park"
};

// Busca la orientacion (hpACF) de un parque por nombre de venue, con
// coincidencia difusa. Devuelve el numero de grados, o 45 (valor neutro)
// si no encuentra nada o si el parque no tiene grado confirmado (null).
function getOrientacionParque(venue) {
  if (!venue) return 45;
  var v = venue.toLowerCase();

  if (PARQUES_ORIENTACION[venue]) {
    var hp = PARQUES_ORIENTACION[venue].hpACF;
    return (hp === null || hp === undefined) ? 45 : hp;
  }

  for (var alias in PARQUES_ALIAS) {
    if (alias.toLowerCase() === v) {
      var real = PARQUES_ALIAS[alias];
      if (PARQUES_ORIENTACION[real]) {
        var hp2 = PARQUES_ORIENTACION[real].hpACF;
        return (hp2 === null || hp2 === undefined) ? 45 : hp2;
      }
    }
  }

  for (var key in PARQUES_ORIENTACION) {
    if (v.indexOf(key.toLowerCase()) >= 0 || key.toLowerCase().indexOf(v) >= 0) {
      var hp3 = PARQUES_ORIENTACION[key].hpACF;
      return (hp3 === null || hp3 === undefined) ? 45 : hp3;
    }
  }
  for (var a in PARQUES_ALIAS) {
    if (v.indexOf(a.toLowerCase()) >= 0 || a.toLowerCase().indexOf(v) >= 0) {
      var real2 = PARQUES_ALIAS[a];
      if (PARQUES_ORIENTACION[real2]) {
        var hp4 = PARQUES_ORIENTACION[real2].hpACF;
        return (hp4 === null || hp4 === undefined) ? 45 : hp4;
      }
    }
  }

  return 45;
}

function getInfoParque(venue) {
  if (!venue) return null;
  var v = venue.toLowerCase();
  if (PARQUES_ORIENTACION[venue]) return PARQUES_ORIENTACION[venue];
  for (var alias in PARQUES_ALIAS) {
    if (alias.toLowerCase() === v) return PARQUES_ORIENTACION[PARQUES_ALIAS[alias]] || null;
  }
  for (var key in PARQUES_ORIENTACION) {
    if (v.indexOf(key.toLowerCase()) >= 0 || key.toLowerCase().indexOf(v) >= 0) {
      return PARQUES_ORIENTACION[key];
    }
  }
  return null;
}
