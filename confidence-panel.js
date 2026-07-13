/* ============================================================
   PRÓLOGO — confidence-panel.js
   ============================================================
   QUÉ ES:
     Panel resumen de "qué tan confiable está el día" (score 0-100),
     basado ÚNICAMENTE en lo que este archivo controla y verifica hoy:
     alertas manuales cargadas por fecha y estado real de techos
     (vía roof-status.js). Se renderiza arriba de la lista de juegos.

   CORRECCIÓN ACTUAL (esta sesión):
     summarize() restaba 40 puntos fijos por "pitchers pendientes"
     (-10), "lineups no confirmadas" (-20) y "umpires pendientes"
     (-10) SIEMPRE, sin comprobar ningún dato real de pitchers,
     lineups ni umpires — este archivo nunca tuvo acceso a esa
     información. Esas tres restas fijas se eliminaron: el score ahora
     solo baja por alertas manuales reales (rojo/amarillo) y por
     techos no verificados (roofBad), que sí son datos que este
     archivo efectivamente calcula. También se quitaron del HTML las
     tres filas fijas "Pitchers: 🟡 por confirmar", "Lineups: 🔴 no
     confirmadas" y "Umpires: 🟡 por confirmar", y la fila "Histórico:
     🟢 disponible" — ninguna de las cuatro tenía verificación real
     detrás: este archivo no comprueba pitchers, lineups, umpires ni
     el estado del histórico (eso vive en mlbpro-core.js /
     leerHistoricoCache(), no acá). Este panel solo debe mostrar y
     puntuar lo que efectivamente mide: alertas manuales y techos.

   DE QUÉ DEPENDE:
     mlbpro-core.js (para hoyISO(), evita recalcular fecha propia).
     window.MLBPRO_ROOF_STATUS (para contar techos verificados/no).
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
     summarize(games) → {total, score, status, cls, roofVerified,
       roofBad, redCount, yellowCount, alerts}. games = array de
       juegos crudos de MLB Stats API (con .venue.name).
     render(games) → string HTML del panel completo.
     renderAlerts(alerts) → string HTML de solo la sección de alertas.

   QUÉ TOCA:
     Nada de DOM directo ni localStorage — devuelve HTML como string,
     quien lo llama (index.html) lo inserta.

   PENDIENTE SI SE AGREGA MONEYLINE / K6:
     El score de este panel es "confianza operativa del día" (clima +
     techos + alertas manuales), NO tiene nada que ver con el score
     de coincidencia climática (ese vive en mlbpro-viento.js). Si se
     agrega MoneyLine, decidir si entra como otra resta al score de
     ACÁ o si es un panel aparte — no mezclar los dos conceptos.

   FECHA:
     13 jul 2026.

   ESTADO:
     NO_CONFIRMADO — corrección aplicada por lectura de código.
     Pendiente de prueba real que confirme que el score ya no baja 40
     puntos fijos sin motivo, y que las filas de Pitchers/Lineups/
     Umpires/Histórico ya no aparecen en el panel renderizado.
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

    let roofVerified = 0;
    let roofBad = 0;

    if (window.MLBPRO_ROOF_STATUS && Array.isArray(games)) {
      games.forEach(g => {
        const venue = g.venue?.name || g.venue || "";
        const r = window.MLBPRO_ROOF_STATUS.getRoofStatus(venue);
        if (r.verified) roofVerified++;
        else roofBad++;
      });
    }

    const alerts = this.getManualAlerts();
    const redCount = alerts.filter(a => a.level === "red").length;
    const yellowCount = alerts.filter(a => a.level === "yellow").length;

    let score = 100;
    score -= redCount * 20;
    score -= yellowCount * 8;
    score -= roofBad * 6;
    score = Math.max(0, Math.min(100, score));

    let status = "🟢 CONFIABLE";
    let cls = "ok";
    if (score < 75) { status = "🟡 USAR CON CUIDADO"; cls = "mid"; }
    if (score < 45) { status = "🔴 NO LISTO"; cls = "bad"; }

    return { total, score, status, cls, roofVerified, roofBad, redCount, yellowCount, alerts };
  },

  getManualAlerts() {
    const key = this.getDateKey();
    if (key === "2026-06-23") return this.manualAlerts20260623;
    return [];
  },

  render(games) {
    const s = this.summarize(games);
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
          <div class="conf-item">Techos: ${s.roofBad ? "🟡" : "🟢"} ${s.roofVerified} verificados</div>
          <div class="conf-item">Delay: ${s.redCount ? "🔴 riesgo fuerte" : "🟢 sin rojo"}</div>
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
