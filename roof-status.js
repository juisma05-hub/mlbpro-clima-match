/* ============================================================
   PRÓLOGO — roof-status.js
   ============================================================
   QUÉ ES:
     FUENTE ÚNICA de qué parques tienen techo y su estado (verificado
     o no, domo fijo o retráctil). Antes había una segunda lista
     hardcodeada dentro de index.html (con el nombre viejo "Minute
     Maid Park" en vez de "Daikin Park"), y por eso el gate de techo
     cerrado nunca hacía match para Houston. Ahora solo existe esta.

   DE QUÉ DEPENDE:
     De nada. Standalone, puede cargar en cualquier momento antes de
     que alguien lo llame.

   QUIÉN LO USA:
     index.html, viento-parque.html, mlbpro-viento.js (tipoBrisa),
     confidence-panel.js (summarize), game-cards.js (renderGameCard).

   REGLA DE ORO:
     Nadie fuera de este archivo debe comparar texto de "label" para
     decidir lógica (ej. `.includes("ROOF CERRADO")`). Eso fue un bug:
     el label real decía "DOMO FIJO CERRADO" y el `.includes()` de
     otro archivo buscaba literal "ROOF CERRADO", nunca hacía match.
     Usar SIEMPRE los gates booleanos: esDomoCerradoFijo() / esTechoNoVerificado().

   API (window.MLBPRO_ROOF_STATUS):
     roofParks → objeto {nombreParque: {type, label, verified,
       confidence, climate, domeClosedFixed, note}}. Datos crudos.
     aliasVenue → objeto {nombreViejo: nombreNuevo}. Hoy solo tiene
       "Minute Maid Park" → "Daikin Park".

     normalizeVenue(name) → string. Resuelve alias y espacios extra.
     getRoofStatus(venueName) → objeto completo de estado del parque
       (o "AIRE LIBRE" por defecto si no está en la lista = no tiene techo).
     esDomoCerradoFijo(venueName) → boolean. true SOLO para Tropicana
       Field (domo fijo, nunca se abre). Gate para "no calcular clima".
     esTechoNoVerificado(venueName) → boolean. true para parques con
       techo retráctil cuyo estado hoy no se confirmó. Gate para
       "no forzar veredicto climático".
     renderRoofLine(venueName) → string HTML. Línea visual para tarjeta.
     isClimateActive / isVerified / getConfidence(venueName) → helpers cortos.

   QUÉ TOCA:
     Nada de DOM directo (renderRoofLine devuelve HTML como string,
     quien lo llama lo inserta). Nada de localStorage.

   PENDIENTE SI SE AGREGA MONEYLINE / K6:
     Si esos motores necesitan saber "hay clima real o no" para un
     parque, deben preguntarle a ESTE archivo (esDomoCerradoFijo /
     esTechoNoVerificado), no reimplementar su propia lista de techos.
   ============================================================ */

window.MLBPRO_ROOF_STATUS = {
  roofParks: {
    "Rogers Centre": {
      type: "RETRACTABLE", label: "NO VERIFICADO", verified: false,
      confidence: 10, climate: "CASTIGADO", domeClosedFixed: false,
      note: "Techo retráctil pendiente de verificar"
    },
    "Tropicana Field": {
      type: "FIXED_DOME", label: "DOMO FIJO CERRADO", verified: true,
      confidence: 100, climate: "APAGADO", domeClosedFixed: true,
      note: "Domo fijo cerrado; clima exterior no afecta"
    },
    "loanDepot park": {
      type: "RETRACTABLE", label: "NO VERIFICADO", verified: false,
      confidence: 10, climate: "CASTIGADO", domeClosedFixed: false,
      note: "Techo retráctil pendiente de verificar"
    },
    "Chase Field": {
      type: "RETRACTABLE", label: "NO VERIFICADO", verified: false,
      confidence: 10, climate: "CASTIGADO", domeClosedFixed: false,
      note: "Techo retráctil pendiente de verificar"
    },
    "Globe Life Field": {
      type: "RETRACTABLE", label: "NO VERIFICADO", verified: false,
      confidence: 10, climate: "CASTIGADO", domeClosedFixed: false,
      note: "Techo retráctil pendiente de verificar"
    },
    "Daikin Park": {
      type: "RETRACTABLE", label: "NO VERIFICADO", verified: false,
      confidence: 10, climate: "CASTIGADO", domeClosedFixed: false,
      note: "Techo retráctil pendiente de verificar (nombre 2026 de Minute Maid Park)"
    },
    "American Family Field": {
      type: "RETRACTABLE", label: "NO VERIFICADO", verified: false,
      confidence: 10, climate: "CASTIGADO", domeClosedFixed: false,
      note: "Techo retráctil pendiente de verificar"
    },
    "T-Mobile Park": {
      type: "RETRACTABLE", label: "NO VERIFICADO", verified: false,
      confidence: 10, climate: "CASTIGADO", domeClosedFixed: false,
      note: "Techo retráctil pendiente de verificar"
    }
  },

  // Nombres viejos que pueden seguir apareciendo en datos cacheados o
  // en respuestas de la API durante la transición de nombre.
  aliasVenue: {
    "Minute Maid Park": "Daikin Park"
  },

  normalizeVenue(name) {
    let v = String(name || "").trim().replace(/\s+/g, " ");
    if (this.aliasVenue[v]) v = this.aliasVenue[v];
    return v;
  },

  getRoofStatus(venueName) {
    const venue = this.normalizeVenue(venueName);
    if (this.roofParks[venue]) {
      return { venue, ...this.roofParks[venue], bulb: this.roofParks[venue].verified ? "💡🟢" : "💡🔴" };
    }
    return {
      venue, type: "OPEN_AIR", label: "AIRE LIBRE", verified: true,
      confidence: 100, climate: "ACTIVO", domeClosedFixed: false,
      note: "Estadio abierto; clima exterior aplica", bulb: "💡🟢"
    };
  },

  // Gates estructurados — la lógica de negocio en otros archivos debe
  // usar ESTOS, nunca comparar contra el texto de "label".
  esDomoCerradoFijo(venueName) {
    return this.getRoofStatus(venueName).domeClosedFixed === true;
  },
  esTechoNoVerificado(venueName) {
    const r = this.getRoofStatus(venueName);
    return r.type === "RETRACTABLE" && r.verified === false;
  },

  renderRoofLine(venueName) {
    const r = this.getRoofStatus(venueName);
    return `
      <div class="roof-line ${r.verified ? "roof-ok" : "roof-bad"}">
        <span class="roof-bulb">${r.bulb}</span>
        <span><b>Techo:</b> ${r.label}</span>
        <span><b>Clima:</b> ${r.climate}</span>
        <span><b>Conf:</b> ${r.confidence}%</span>
      </div>
    `;
  },

  isClimateActive(venueName) { return this.getRoofStatus(venueName).climate === "ACTIVO"; },
  isVerified(venueName) { return this.getRoofStatus(venueName).verified === true; },
  getConfidence(venueName) { return Number(this.getRoofStatus(venueName).confidence || 0); }
};
