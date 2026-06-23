/* MLBPro · Game Cards
   Tarjetas compactas + Ver Detalles.
*/

window.MLBPRO_GAME_CARDS = {
  safe(x){
    if(x === null || x === undefined || x === "") return "NO";
    if(Number.isFinite(Number(x))) return Number(x);
    return x;
  },

  getTeamNames(g){
    return {
      away: g.teams?.away?.team?.name || g.away || "?",
      home: g.teams?.home?.team?.name || g.home || "?"
    };
  },

  getVenueName(g){
    return g.venue?.name || g.venue || "SIN PARQUE";
  },

  getCityLabel(venue){
    const map = {
      "Rogers Centre": "Toronto",
      "Tropicana Field": "Tampa Bay",
      "loanDepot park": "Miami",
      "PNC Park": "Pittsburgh",
      "Comerica Park": "Detroit",
      "Nationals Park": "Washington",
      "Citi Field": "New York",
      "Great American Ball Park": "Cincinnati",
      "Target Field": "Minnesota",
      "Rate Field": "Chicago",
      "Busch Stadium": "St. Louis",
      "Coors Field": "Colorado",
      "Angel Stadium": "Los Angeles",
      "Petco Park": "San Diego",
      "Oracle Park": "San Francisco"
    };

    return map[venue] || "";
  },

  toggleDetails(id){
    const el = document.getElementById(id);
    if(!el) return;
    el.classList.toggle("open");
  },

  renderTodayRow(today, roof){
    return `
      <div class="section-label">HOY</div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>FECHA</th>
              <th>TEMP</th>
              <th>HUM</th>
              <th>VIENTO</th>
              <th>DIR</th>
              <th>PRECIP</th>
              <th>TECHO</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>${today?.date || ""}</td>
              <td>${this.safe(today?.tempF)}°F</td>
              <td>${this.safe(today?.humidity)}%</td>
              <td>${this.safe(today?.windMph)} mph</td>
              <td>${Number.isFinite(Number(today?.windDir)) ? today.windDir + "°" : "NO"}</td>
              <td>${this.safe(today?.precip)}%</td>
              <td>${roof.label}</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
  },

  renderHistoryRows(ranked){
    const rows = Array.isArray(ranked) ? ranked.slice(0,3) : [];

    return `
      <div class="section-label">HISTÓRICO MISMO PARQUE</div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>FECHA</th>
              <th>JUEGO</th>
              <th>TEMP</th>
              <th>HUM</th>
              <th>VIENTO</th>
              <th>DIR</th>
              <th>COINC.</th>
            </tr>
          </thead>
          <tbody>
            ${
              rows.length
                ? rows.map(r => `
                  <tr>
                    <td>${r.date || ""}</td>
                    <td>${r.away || "?"} @ ${r.home || "?"}</td>
                    <td>${this.safe(r.tempF)}°F</td>
                    <td>${this.safe(r.humidity)}%</td>
                    <td>${this.safe(r.windMph)} mph</td>
                    <td>${Number.isFinite(Number(r.windDir)) ? r.windDir + "°" : "NO"}</td>
                    <td>${this.safe(r.score)}%</td>
                  </tr>
                `).join("")
                : `
                  <tr>
                    <td colspan="7">NO COINCIDENCIA · sin 3 juegos útiles del mismo parque</td>
                  </tr>
                `
            }
          </tbody>
        </table>
      </div>
    `;
  },

  renderConclusion(verdict){
    return `
      <div class="section-label">CONCLUSIÓN</div>
      <div class="short-row">
        <div class="pill">Carreras: ${verdict?.carreras || "NO COINCIDENCIA"}</div>
        <div class="pill">F5: ${verdict?.f5 || "NO COINCIDENCIA"}</div>
        <div class="pill">Ponches: ${verdict?.ponches || "NO COINCIDENCIA"}</div>
      </div>
      <div class="verdict">
        VEREDICTO: ${verdict?.final || "🔴 PASAR"}
      </div>
    `;
  },

  renderGameCard(g, today, ranked, verdict){
    const names = this.getTeamNames(g);
    const venue = this.getVenueName(g);
    const city = this.getCityLabel(venue);

    const roof = window.MLBPRO_ROOF_STATUS
      ? window.MLBPRO_ROOF_STATUS.getRoofStatus(venue)
      : {label:"NO VERIFICADO", bulb:"💡🔴", climate:"CASTIGADO", confidence:10, verified:false};

    const roofLine = window.MLBPRO_ROOF_STATUS
      ? window.MLBPRO_ROOF_STATUS.renderRoofLine(venue)
      : "";

    const best = Array.isArray(ranked) && ranked[0] ? Number(ranked[0].score || 0) : 0;
    const cls = best >= 85 ? "ok" : best >= 65 ? "mid" : "bad";
    const detailId = "details-" + (g.gamePk || Math.random().toString(36).slice(2));

    return `
      <div class="game-card">
        <div class="park-line">${venue}${city ? " · " + city : ""}</div>
        <div class="matchup">${names.away} @ ${names.home}</div>

        <div class="short-row">
          <div class="pill">Temp: ${this.safe(today?.tempF)}°F</div>
          <div class="pill">Lluvia: ${this.safe(today?.precip)}%</div>
          <div class="pill">Viento: ${this.safe(today?.windMph)} mph</div>
        </div>

        ${roofLine}

        <div class="short-row">
          <div class="pill">Coincidencia: <span class="${cls}">${best ? best + "%" : "NO"}</span></div>
          <div class="pill">Veredicto: ${verdict?.final || "🔴 PASAR"}</div>
        </div>

        <button class="details-btn" onclick="MLBPRO_GAME_CARDS.toggleDetails('${detailId}')">
          VER DETALLES
        </button>

        <div class="details" id="${detailId}">
          ${this.renderTodayRow(today, roof)}
          ${this.renderHistoryRows(ranked)}
          ${this.renderConclusion(verdict)}
        </div>
      </div>
    `;
  }
};
