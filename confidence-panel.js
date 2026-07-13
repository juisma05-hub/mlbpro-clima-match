/* ============================================================
   PRÓLOGO — confidence-panel.js
   ============================================================
   QUÉ ES:
     Panel resumen de "qué tan confiable está el día" (score 0-100),
     basado ÚNICAMENTE en lo que este archivo controla y verifica hoy:
     alertas manuales cargadas por fecha, techos que REALMENTE bloquean
     o vuelven incierto el análisis climático, y delay/lluvia pendiente
     de confirmar (todo vía roof-status.js). Se renderiza arriba de la
     lista de juegos.

   CORRECCIÓN ACTUAL (esta sesión):
     1) "climateUsable" (sesión anterior) sugería que todo parque no
        bloqueado tenía clima "utilizable", pero eso es incorrecto
        para Tropicana Field: su clima exterior está APAGADO (domo
        fijo cerrado), no "utilizable" — solo está RESUELTO (se sabe
        con certeza cuál es su estado, aunque ese estado sea "apagado").
        Se renombró a climateResolved: cuenta juegos cuyo estado
        climático está determinado con certeza, sea clima activo
        (aire libre, CANOPY, retráctil confirmado) o domo fijo cerrado
        (Tropicana). climateBlocked no cambia de significado: sigue
        siendo solo retráctiles reales sin confirmar.
     2) El HTML ya no dice "Clima utilizable: X" (impreciso para
        Tropicana). Ahora dice "Estado climático resuelto: X" y
        "Techos bloqueando clima: Y".
     3) La fila de Delay ahora también refleja delayVerified:false de
        roof-status.js (hoy: T-Mobile Park), no solo alertas manuales
        rojas. Se agregó delayPending: cuenta juegos cuyo
        getRoofStatus(venue).delayVerified === false — T-Mobile Park
        aparece como delay pendiente aunque no haya ninguna alerta roja
        manual cargada para el día. El texto ya no dice "sin rojo" como
        si eso significara "delay confirmado": ahora distingue tres
        casos — alerta roja manual (riesgo fuerte), delayPending sin
        alerta roja (pendiente por techo), o ninguno de los dos (sin
        riesgo conocido — nunca "confirmado sin delay", porque este
        panel no confirma eso, solo reporta ausencia de señales de
        riesgo).
     4) summarize() devuelve climateResolved, climateBlocked y
        delayPending como propiedades explícitas (antes climateUsable/
        climateBlocked de la sesión anterior).
     5) El score SIGUE restando solo por: alertas rojas (-20 c/u),
        alertas amarillas (-8 c/u), climateBlocked (-6 c/u).
        delayPending NO resta nada — se muestra pero no penaliza, tal
        como se pidió explícitamente (no inventar una penalización sin
        autorización).

   CORRECCIÓN ANTERIOR (sesión previa a esta):
     summarize() restaba 40 puntos fijos por "pitchers pendientes"
     (-10), "lineups no confirmadas" (-20) y "umpires pendientes"
     (-10) SIEMPRE, sin comprobar ningún dato real de pitchers,
     lineups ni umpires — este archivo nunca tuvo acceso a esa
     información. Esas tres restas fijas se eliminaron. También se
     quitaron del HTML las filas fijas "Pitchers: 🟡 por confirmar",
     "Lineups: 🔴 no confirmadas", "Umpires: 🟡 por confirmar" y
     "Histórico: 🟢 disponible" — ninguna de las cuatro tenía
     verificación real detrás: este archivo no comprueba pitchers,
     lineups, umpires ni el estado del histórico (eso vive en
     mlbpro-core.js / leerHistoricoCache(), no acá). Siguen eliminadas.

   DE QUÉ DEPENDE:
     mlbpro-core.js (para hoyISO(), evita recalcular fecha propia).
     window.MLBPRO_ROOF_STATUS:
       - esTechoNoVerificado(venue) → gate real de "clima bloqueado/
         incierto" (climateBlocked). NO se lee verified/climateVerified
         directo.
       - getRoofStatus(venue).delayVerified → señal real de delay/
         lluvia pendiente (delayPending). Campo separado de clima,
         documentado en roof-status.js ("SEPARACIÓN CLIMA vs. DELAY").
     Ambos deben estar cargados ANTES de llamar a summarize()/render().

   QUIÉN LO USA:
     index.html (generarConclusionCoincidencia la llama una vez y
     pone el resultado arriba de las tarjetas de juegos).

   ESTADO ACTUAL: CONECTADO.
     Antes existía en el repo pero ningún <script src=""> lo cargaba
     — era código muerto. Ahora sí está en el <script> de index.html
     y sí se ejecuta.

   API (window.MLBPRO_CONFIDENCE_PANEL):
     manualAlerts20260623 → array hardcodeado de alertas de ejemplo
       para esa fecha específica. Patrón: manualAlertsYYYYMMDD.
       Para agregar alertas de un día nuevo: agregar otro array así
       y un caso en getManualAlerts().

     getDateKey() → string "YYYY-MM-DD" en ET, vía MLBPRO_CORE.hoyISO().
     getManualAlerts() → array de alertas para hoy (vacío si no hay
       ninguna cargada para la fecha de hoy).
     summarize(games) → {total, score, status, cls, climateResolved,
       climateBlocked, delayPending, redCount, yellowCount, alerts}.
       games = array de juegos crudos de MLB Stats API (con .venue.name).
       climateResolved = juegos cuyo estado climático está determinado
         con certeza (aire libre, CANOPY activo, retráctil confirmado,
         O domo fijo cerrado tipo Tropicana — "resuelto" no significa
         "activo", significa "se sabe cuál es").
       climateBlocked = juegos cuyo clima SÍ está bloqueado/incierto
         (esTechoNoVerificado(venue) === true — techo retráctil real
         sin confirmar). climateResolved + climateBlocked === total.
       delayPending = juegos cuyo riesgo de lluvia/delay está sin
         confirmar según roof-status.js (delayVerified === false).
         Independiente de climateResolved/climateBlocked: un juego
         puede tener clima resuelto Y delay pendiente a la vez (caso
         T-Mobile Park). NO resta puntos del score.
     render(games) → string HTML del panel completo.
     renderAlerts(alerts) → string HTML de solo la sección de alertas.

   QUÉ TOCA:
     Nada de DOM directo ni localStorage — devuelve HTML como string,
     quien lo llama (index.html) lo inserta.

   PENDIENTE SI SE AGREGA MONEYLINE / K6:
     El score de este panel es "confianza operativa del día" (clima +
     alertas manuales), NO tiene nada que ver con el score de
     coincidencia climática (ese vive en mlbpro-viento.js). Si se
     agrega MoneyLine, decidir si entra como otra resta al score de
     ACÁ o si es un panel aparte — no mezclar los dos conceptos.

   FECHA:
     13 jul 2026.

   ESTADO:
     NO_CONFIRMADO — corrección aplicada por lectura de código y
     probada en runtime (node) junto con roof-status.js dentro de esta
     sesión, pendiente de prueba real en el navegador. Confirmado por
     ejecución: (a) T-Mobile Park → climateBlocked=0, climateResolved
     lo incluye, delayPending=1, no resta 6 puntos; (b) Rogers Centre →
     climateBlocked=1, resta 6 puntos; (c) Tropicana Field → NO se
     muestra como "clima utilizable" (esa etiqueta ya no existe), SÍ
     cuenta en climateResolved; (d) Yankee Stadium → climateResolved lo
     incluye, delayPending=0; (e) el HTML no contiene "Pitchers",
     "Lineups", "Umpires" ni "Histórico".
   ============================================================ */

window.MLBPRO_CONFIDENCE_PANEL = {
  // Alertas manuales: cárgalas a mano para una fecha específica si
  // querés que aparezcan en el panel ese día.
  manualAlerts20260623: [
    {
      level: "red",
      icon: "🔴",
      game: "Dodgers @ Twins",
      venue: "Target Field",
      text: "Delay likely / posible PPD · precip 78%"
    },
    {
      level: "yellow",
      icon: "🟡",
      game: "Cubs @ Mets",
      venue: "Citi Field",
      text: "GREEN/YELLOW · posible late start · precip 48%"
    },
    {
      level: "yellow",
      icon: "🟡",
      game: "Red Sox @ Rockies",
      venue: "Coors Field",
      text: "YELLOW · chance delay / late start · precip 32%"
    },
    {
      level: "yellow",
      icon: "🟡",
      game: "Phillies @ Nationals",
      venue: "Nationals Park",
      text: "Viento in from left aprox. 10 mph"
    }
  ],

  getDateKey() {
    // Antes: new Date().toISOString().slice(0,10) → UTC crudo, podía
    // desfasarse un día respecto a la fecha real de MLB (ET).
    return window.MLBPRO_CORE ? window.MLBPRO_CORE.hoyISO() : new Date().toISOString().slice(0, 10);
  },

  summarize(games) {
    const total = Array.isArray(games) ? games.length : 0;

    let climateResolved = 0;
    let climateBlocked = 0;
    let delayPending = 0;

    // climateBlocked/climateResolved: gate real de "clima bloqueado/
    // incierto" (esTechoNoVerificado). delayPending: señal real y
    // SEPARADA de lluvia/delay (delayVerified===false), independiente
    // de si el clima está resuelto o no — un juego puede tener clima
    // resuelto Y delay pendiente al mismo tiempo (T-Mobile Park).
    if (window.MLBPRO_ROOF_STATUS && Array.isArray(games)) {
      games.forEach(g => {
        const venue = g.venue?.name || g.venue || "";

        const bloqueado = window.MLBPRO_ROOF_STATUS.esTechoNoVerificado(venue);
        if (bloqueado) climateBlocked++;
        else climateResolved++;

        const r = window.MLBPRO_ROOF_STATUS.getRoofStatus(venue);
        if (r.delayVerified === false) delayPending++;
      });
    }

    const alerts = this.getManualAlerts();
    const redCount = alerts.filter(a => a.level === "red").length;
    const yellowCount = alerts.filter(a => a.level === "yellow").length;

    // Solo restan: alertas rojas, alertas amarillas, climateBlocked.
    // delayPending NUNCA resta — se muestra, no penaliza.
    let score = 100;
    score -= redCount * 20;
    score -= yellowCount * 8;
    score -= climateBlocked * 6;
    score = Math.max(0, Math.min(100, score));

    let status = "🟢 CONFIABLE";
    let cls = "ok";
    if (score < 75) { status = "🟡 USAR CON CUIDADO"; cls = "mid"; }
    if (score < 45) { status = "🔴 NO LISTO"; cls = "bad"; }

    return { total, score, status, cls, climateResolved, climateBlocked, delayPending, redCount, yellowCount, alerts };
  },

  getManualAlerts() {
    const key = this.getDateKey();
    if (key === "2026-06-23") return this.manualAlerts20260623;
    return [];
  },

  render(games) {
    const s = this.summarize(games);

    // Delay: alerta roja manual manda (riesgo fuerte confirmado por
    // humano); si no hay roja pero sí hay delayPending real (techo),
    // se muestra como pendiente; si no hay ninguna señal, se dice
    // "sin riesgo conocido" — nunca "sin rojo" como si eso confirmara
    // ausencia de delay, porque este panel no confirma eso.
    let delayTxt;
    if (s.redCount) {
      delayTxt = "🔴 riesgo fuerte (alerta roja)";
    } else if (s.delayPending) {
      delayTxt = "🟡 pendiente por techo (" + s.delayPending + ")";
    } else {
      delayTxt = "🟢 sin riesgo conocido";
    }

    return `
      <div class="panel">
        <div class="panel-title">MLBPRO · ESTADO DEL DÍA</div>
        <div class="verdict">
          CONFIANZA GENERAL:
          <span class="${s.cls}">${s.score}% · ${s.status}</span>
        </div>
        <div class="conf-grid" style="margin-top:10px">
          <div class="conf-item">Juegos: ${s.total}</div>
          <div class="conf-item">Clima: ${s.redCount ? "🔴" : s.yellowCount ? "🟡" : "🟢"} ${s.redCount + s.yellowCount} alertas</div>
          <div class="conf-item">Estado climático resuelto: ${s.climateResolved}</div>
          <div class="conf-item">Techos bloqueando clima: ${s.climateBlocked ? "🔴" : "🟢"} ${s.climateBlocked}</div>
          <div class="conf-item">Delay: ${delayTxt}</div>
        </div>
        ${this.renderAlerts(s.alerts)}
      </div>
    `;
  },

  renderAlerts(alerts) {
    if (!alerts.length) {
      return `
        <div class="section-label">ALERTAS DEL DÍA</div>
        <div class="alerta">🟢 Sin alertas manuales cargadas para esta fecha.</div>
      `;
    }
    return `
      <div class="section-label">ALERTAS DEL DÍA</div>
      ${alerts.map(a => `
        <div class="alerta">
          <b>${a.icon} ${a.game}</b><br>
          <span class="small">${a.venue}</span><br>
          ${a.text}
        </div>
      `).join("")}
    `;
  }
};
