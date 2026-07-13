/* ============================================================
   PRÓLOGO — roof-status.js
   ============================================================
   QUÉ ES:
     FUENTE ÚNICA de qué parques tienen techo y su estado climático
     (confirmado o no) y de delay/lluvia (confirmado o no, cuando
     aplica). Antes había una segunda lista hardcodeada dentro de
     index.html (con el nombre viejo "Minute Maid Park" en vez de
     "Daikin Park"), y por eso el gate de techo cerrado nunca hacía
     match para Houston. Ahora solo existe esta.

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

   SEPARACIÓN CLIMA vs. DELAY (esta sesión — no mezclar los dos):
     Antes existía un solo campo "verified" que se usaba para dos
     cosas distintas a la vez: (a) si el CLIMA (viento/temperatura) es
     confiable, y (b) si el riesgo de lluvia/delay está confirmado.
     Para la mayoría de los parques ambas cosas coinciden (un domo
     retráctil sin confirmar es incierto en las dos), pero para
     T-Mobile Park NO: su clima siempre es real/activo (el canopy no
     encierra el estadio), pero el riesgo de lluvia/delay del canopy
     sí puede seguir sin confirmar. Mezclar ambos en un solo booleano
     obligaba a elegir entre mostrar mal el clima o mostrar mal el
     delay. Ahora son dos campos independientes:
       - climateVerified: boolean. Si el CLIMA (viento/temp) es
         confiable y usable. Es el que manda para bulb, clase CSS y
         confianza climática en renderRoofLine(), y es lo que usa
         esTechoNoVerificado().
       - delayVerified: boolean|undefined. Solo existe en parques
         donde el riesgo de lluvia/delay es un concepto separado del
         clima (hoy: T-Mobile Park). undefined en el resto = no
         aplica, no hay nada que mostrar aparte.
     "verified" se mantiene en el objeto devuelto por getRoofStatus()
     ÚNICAMENTE como alias de compatibilidad hacia atrás (= siempre
     igual a climateVerified), por si algún consumidor externo
     (game-cards.js, que no se tocó en esta sesión) todavía lo lee
     directo. Ningún cálculo interno de este archivo usa ya "verified"
     como fuente de verdad: todos usan climateVerified.

   API (window.MLBPRO_ROOF_STATUS):
     roofParks → objeto {nombreParque: {type, label, climateVerified,
       confidence, climate, domeClosedFixed, note, delayVerified?,
       delayLabel?}}. Datos crudos (sin el alias "verified" ni "bulb",
       que se calculan en getRoofStatus()).
       type puede ser: "OPEN_AIR" (default, sin techo), "RETRACTABLE"
       (domo que ENCIERRA el estadio y apaga el clima real cuando está
       cerrado), "FIXED_DOME" (domo fijo, siempre cerrado — Tropicana),
       o "CANOPY" (techo móvil que cubre el terreno como sombrilla
       pero NO encierra el estadio — hoy solo T-Mobile Park). La
       diferencia física entre RETRACTABLE y CANOPY importa: en
       RETRACTABLE cerrado, el clima exterior deja de aplicar de
       verdad; en CANOPY, el viento y la temperatura exterior siguen
       activos esté el canopy abierto o cerrado, así que el clima
       nunca se apaga por eso — lo único incierto en CANOPY es el
       riesgo de lluvia/delay, no el clima en sí.
       confidence = confianza CLIMÁTICA específicamente (no de delay).
     aliasVenue → objeto {nombreViejo: nombreNuevo}. Hoy solo tiene
       "Minute Maid Park" → "Daikin Park".

     normalizeVenue(name) → string. Resuelve alias y espacios extra.
     getRoofStatus(venueName) → objeto completo de estado del parque,
       con "verified" (alias de climateVerified) y "bulb" calculados
       (o "AIRE LIBRE" por defecto si no está en la lista = no tiene techo).
     esDomoCerradoFijo(venueName) → boolean. true SOLO para Tropicana
       Field (domo fijo, nunca se abre). Gate para "no calcular clima".
     esTechoNoVerificado(venueName) → boolean. true SOLO para parques
       type "RETRACTABLE" cuyo climateVerified es false (Rogers Centre,
       loanDepot park, Chase Field, Globe Life Field, Daikin Park,
       American Family Field). Gate para "no forzar veredicto
       climático". T-Mobile Park (type "CANOPY") queda EXCLUIDO de este
       gate a propósito: su clima siempre puede evaluarse porque el
       canopy no encierra el estadio — ver excepción documentada abajo.
     renderRoofLine(venueName) → string HTML. Usa climateVerified para
       decidir clase CSS ("roof-ok"/"roof-bad"), bombillo (💡🟢/💡🔴) y
       confianza climática mostrada. Si delayVerified === false, agrega
       una línea SEPARADA de delay/lluvia (no toca la línea de clima).
     isClimateActive / isVerified / getConfidence(venueName) → helpers
       cortos, todos basados en climateVerified (vía el alias verified).

   EXCEPCIÓN CONFIRMADA — T-MOBILE PARK:
     Antes T-Mobile Park estaba clasificado igual que Miami, Houston,
     Arizona, Texas y Toronto: type "RETRACTABLE" + verified:false, lo
     que lo hacía entrar en esTechoNoVerificado() y bloqueaba/apagaba
     el análisis climático (climate:"CASTIGADO", confianza climática
     10%, bombillo rojo, clase roof-bad). Eso es físicamente incorrecto:
     el techo de T-Mobile Park cubre el terreno como una sombrilla pero
     NO encierra el estadio — el viento y la temperatura exterior
     siguen activos siempre, esté el canopy abierto o cerrado.

     Se reclasificó así:
       - type: "CANOPY" (nuevo valor, exclusivo de este parque hoy).
       - climate: "ACTIVO".
       - climateVerified: true (el clima SIEMPRE es real/confiable acá
         por estructura física, no hace falta "verificarlo" cada día).
       - confidence: 100 (confianza climática real, no 10%).
       - delayVerified: false (lo único genuinamente pendiente es si
         hubo o no delay/lluvia — un concepto de OPERACIÓN del juego,
         no de clima).
     esTechoNoVerificado() solo mira type==="RETRACTABLE", así que
     T-Mobile Park queda afuera del gate automáticamente sin tocar la
     función para los demás parques. renderRoofLine() ahora muestra su
     línea de clima en verde/roof-ok (climateVerified:true) y agrega
     una línea aparte de "Delay/Lluvia: NO CONFIRMADO" porque
     delayVerified es false — el riesgo de delay se ve, pero ya no se
     confunde con "clima malo". Los otros 6 parques con techo
     retráctil real (que sí encierran el estadio) y Tropicana Field no
     se tocaron: mismos valores de climateVerified/confidence/climate
     que tenían antes como "verified"/"confidence"/"climate", mismo
     resultado en esTechoNoVerificado()/esDomoCerradoFijo(), mismo
     HTML de renderRoofLine() (ninguno de ellos tiene delayVerified,
     así que no aparece línea de delay para ellos).

     confidence-panel.js se ajustó en paralelo (ver ese archivo) para
     usar esTechoNoVerificado() en vez de leer verified/climateVerified
     directo, y para nombrar sus contadores climateUsable/
     climateBlocked en vez de roofVerified/roofBad — así T-Mobile Park
     ya no resta puntos por techo y ya no se cuenta con un texto de
     "techo verificado" que no le corresponde a un estadio abierto.

   QUÉ TOCA:
     Nada de DOM directo (renderRoofLine devuelve HTML como string,
     quien lo llama lo inserta). Nada de localStorage.

   PENDIENTE SI SE AGREGA MONEYLINE / K6:
     Si esos motores necesitan saber "hay clima real o no" para un
     parque, deben preguntarle a ESTE archivo (esDomoCerradoFijo /
     esTechoNoVerificado), no reimplementar su propia lista de techos.

   FECHA:
     13 jul 2026.

   ESTADO:
     NO_CONFIRMADO — corrección aplicada por lectura de código y
     probada en runtime (node) dentro de esta sesión, pendiente de
     prueba real en el navegador. Confirmado por ejecución: (a)
     esTechoNoVerificado("T-Mobile Park") === false, (b)
     isClimateActive("T-Mobile Park") === true, (c) climateVerified de
     T-Mobile Park es true con confidence 100 (ya no 10%), (d)
     renderRoofLine("T-Mobile Park") usa clase "roof-ok" y bombillo
     verde, y agrega una línea de delay separada, (e)
     esTechoNoVerificado("Rogers Centre") === true (sin cambio), (f)
     esDomoCerradoFijo("Tropicana Field") === true y su climate sigue
     "APAGADO" (sin cambio), (g) un parque no listado (ej. Yankee
     Stadium) sigue devolviendo type "OPEN_AIR" / climateVerified true.
   ============================================================ */

window.MLBPRO_ROOF_STATUS = {
  roofParks: {
    "Rogers Centre": {
      type: "RETRACTABLE", label: "NO VERIFICADO", climateVerified: false,
      confidence: 10, climate: "CASTIGADO", domeClosedFixed: false,
      note: "Techo retráctil pendiente de verificar"
    },
    "Tropicana Field": {
      type: "FIXED_DOME", label: "DOMO FIJO CERRADO", climateVerified: true,
      confidence: 100, climate: "APAGADO", domeClosedFixed: true,
      note: "Domo fijo cerrado; clima exterior no afecta"
    },
    "loanDepot park": {
      type: "RETRACTABLE", label: "NO VERIFICADO", climateVerified: false,
      confidence: 10, climate: "CASTIGADO", domeClosedFixed: false,
      note: "Techo retráctil pendiente de verificar"
    },
    "Chase Field": {
      type: "RETRACTABLE", label: "NO VERIFICADO", climateVerified: false,
      confidence: 10, climate: "CASTIGADO", domeClosedFixed: false,
      note: "Techo retráctil pendiente de verificar"
    },
    "Globe Life Field": {
      type: "RETRACTABLE", label: "NO VERIFICADO", climateVerified: false,
      confidence: 10, climate: "CASTIGADO", domeClosedFixed: false,
      note: "Techo retráctil pendiente de verificar"
    },
    "Daikin Park": {
      type: "RETRACTABLE", label: "NO VERIFICADO", climateVerified: false,
      confidence: 10, climate: "CASTIGADO", domeClosedFixed: false,
      note: "Techo retráctil pendiente de verificar (nombre 2026 de Minute Maid Park)"
    },
    "American Family Field": {
      type: "RETRACTABLE", label: "NO VERIFICADO", climateVerified: false,
      confidence: 10, climate: "CASTIGADO", domeClosedFixed: false,
      note: "Techo retráctil pendiente de verificar"
    },
    // T-Mobile Park NO es un domo retráctil que encierra el estadio:
    // es un techo/canopy móvil que cubre el terreno como una sombrilla,
    // pero no encierra el estadio. Viento y temperatura exterior siguen
    // activos independientemente de si el canopy está abierto o
    // cerrado — por eso climateVerified:true y confidence:100 (clima
    // real, no una suposición). Lo único genuinamente pendiente es si
    // hubo delay/lluvia, que es un concepto de OPERACIÓN del juego, no
    // de clima: por eso vive en delayVerified, un campo aparte.
    "T-Mobile Park": {
      type: "CANOPY", label: "CANOPY MÓVIL — CLIMA ACTIVO", climateVerified: true,
      confidence: 100, climate: "ACTIVO", domeClosedFixed: false,
      delayVerified: false, delayLabel: "LLUVIA/DELAY NO CONFIRMADO",
      note: "Cubre el terreno, no encierra el estadio: viento y temperatura exterior siguen activos siempre. El delay/lluvia es un riesgo aparte, no confirmado, que no afecta la confianza climática."
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
      const p = this.roofParks[venue];
      return {
        venue, ...p,
        // Alias de compatibilidad hacia atrás — SIEMPRE espeja
        // climateVerified, nunca delayVerified. Ver "SEPARACIÓN CLIMA
        // vs. DELAY" en el prólogo.
        verified: p.climateVerified,
        bulb: p.climateVerified ? "💡🟢" : "💡🔴"
      };
    }
    return {
      venue, type: "OPEN_AIR", label: "AIRE LIBRE", climateVerified: true, verified: true,
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
    // Solo bloquea RETRACTABLE (domo que encierra el estadio y apaga
    // el clima real cuando está cerrado) con climateVerified false.
    // CANOPY (T-Mobile Park) queda afuera a propósito: cubre el
    // terreno pero no encierra el estadio, así que viento/temperatura
    // exterior siguen activos sin importar si el canopy está abierto
    // o cerrado — no es el mismo caso físico que Miami, Houston,
    // Arizona, Texas o Toronto. Usa climateVerified explícitamente
    // (nunca delayVerified): el delay es un concepto aparte.
    const r = this.getRoofStatus(venueName);
    return r.type === "RETRACTABLE" && r.climateVerified === false;
  },

  renderRoofLine(venueName) {
    const r = this.getRoofStatus(venueName);
    // La línea de clima usa SIEMPRE climateVerified (vía r.verified,
    // que es su alias) para clase CSS, bombillo y confianza climática
    // — nunca delayVerified. Eso es lo que evita que T-Mobile Park se
    // vea como "clima malo" solo porque el delay sigue sin confirmar.
    const lineaClima = `
      <div class="roof-line ${r.climateVerified ? "roof-ok" : "roof-bad"}">
        <span class="roof-bulb">${r.bulb}</span>
        <span><b>Techo:</b> ${r.label}</span>
        <span><b>Clima:</b> ${r.climate}</span>
        <span><b>Conf:</b> ${r.confidence}%</span>
      </div>
    `;
    // Línea SEPARADA de delay/lluvia — solo aparece cuando el parque
    // tiene delayVerified===false explícito (hoy: T-Mobile Park). No
    // toca ni reemplaza la línea de clima de arriba.
    const lineaDelay = (r.delayVerified === false)
      ? `
      <div class="roof-line roof-delay-pending">
        <span class="roof-bulb">🌧️🟡</span>
        <span><b>Delay/Lluvia:</b> ${r.delayLabel || "NO CONFIRMADO"}</span>
      </div>
    `
      : "";
    return lineaClima + lineaDelay;
  },

  isClimateActive(venueName) { return this.getRoofStatus(venueName).climate === "ACTIVO"; },
  isVerified(venueName) { return this.getRoofStatus(venueName).climateVerified === true; },
  getConfidence(venueName) { return Number(this.getRoofStatus(venueName).confidence || 0); }
};
