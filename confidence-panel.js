/* MLBPro · Confidence Panel
   Resumen de confianza arriba.
   No depende del index pesado.
*/

window.MLBPRO_CONFIDENCE_PANEL = {
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

  getDateKey(){
    const d = new Date();
    return d.toISOString().slice(0,10);
  },

  summarize(games){
    const total = Array.isArray(games) ? games.length : 0;

    let roofVerified = 0;
    let roofBad = 0;

    if(window.MLBPRO_ROOF_STATUS && Array.isArray(games)){
      games.forEach(g => {
        const venue = g.venue?.name || g.venue || "";
        const r = window.MLBPRO_ROOF_STATUS.getRoofStatus(venue);
        if(r.verified) roofVerified++;
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

    score -= 10; // pitchers pendientes
    score -= 20; // lineups no confirmadas
    score -= 10; // umpires pendientes

    score = Math.max(0, Math.min(100, score));

    let status = "🟢 CONFIABLE";
    let cls = "ok";

    if(score < 75){
      status = "🟡 USAR CON CUIDADO";
      cls = "mid";
    }

    if(score < 45){
      status = "🔴 NO LISTO";
      cls = "bad";
    }

    return {
      total,
      score,
      status,
      cls,
      roofVerified,
      roofBad,
      redCount,
      yellowCount,
      alerts
    };
  },

  getManualAlerts(){
    const key = this.getDateKey();

    if(key === "2026-06-23"){
      return this.manualAlerts20260623;
    }

    return [];
  },

  render(games){
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
          <div class="conf-item">Pitchers: 🟡 por confirmar</div>
          <div class="conf-item">Lineups: 🔴 no confirmadas</div>
          <div class="conf-item">Umpires: 🟡 por confirmar</div>
          <div class="conf-item">Histórico: 🟢 disponible</div>
        </div>

        ${this.renderAlerts(s.alerts)}
      </div>
    `;
  },

  renderAlerts(alerts){
    if(!alerts.length){
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
