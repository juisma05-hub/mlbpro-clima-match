/* MLBPro · Roof Status Module
   Maneja bombillo de techo / domo.
   No depende del index.
   No rompe la lógica existente.
*/

window.MLBPRO_ROOF_STATUS = {
  roofParks: {
    "Rogers Centre": {
      type: "RETRACTABLE",
      label: "NO VERIFICADO",
      verified: false,
      confidence: 10,
      climate: "CASTIGADO",
      note: "Techo retráctil pendiente de verificar"
    },

    "Tropicana Field": {
      type: "FIXED_DOME",
      label: "DOMO FIJO CERRADO",
      verified: true,
      confidence: 100,
      climate: "APAGADO",
      note: "Domo fijo cerrado; clima exterior no afecta"
    },

    "loanDepot park": {
      type: "RETRACTABLE",
      label: "NO VERIFICADO",
      verified: false,
      confidence: 10,
      climate: "CASTIGADO",
      note: "Techo retráctil pendiente de verificar"
    },

    "Chase Field": {
      type: "RETRACTABLE",
      label: "NO VERIFICADO",
      verified: false,
      confidence: 10,
      climate: "CASTIGADO",
      note: "Techo retráctil pendiente de verificar"
    },

    "Globe Life Field": {
      type: "RETRACTABLE",
      label: "NO VERIFICADO",
      verified: false,
      confidence: 10,
      climate: "CASTIGADO",
      note: "Techo retráctil pendiente de verificar"
    },

    "Daikin Park": {
      type: "RETRACTABLE",
      label: "NO VERIFICADO",
      verified: false,
      confidence: 10,
      climate: "CASTIGADO",
      note: "Techo retráctil pendiente de verificar"
    },

    "Minute Maid Park": {
      type: "RETRACTABLE",
      label: "NO VERIFICADO",
      verified: false,
      confidence: 10,
      climate: "CASTIGADO",
      note: "Techo retráctil pendiente de verificar"
    },

    "American Family Field": {
      type: "RETRACTABLE",
      label: "NO VERIFICADO",
      verified: false,
      confidence: 10,
      climate: "CASTIGADO",
      note: "Techo retráctil pendiente de verificar"
    },

    "T-Mobile Park": {
      type: "RETRACTABLE",
      label: "NO VERIFICADO",
      verified: false,
      confidence: 10,
      climate: "CASTIGADO",
      note: "Techo retráctil pendiente de verificar"
    }
  },

  normalizeVenue(name) {
    return String(name || "")
      .trim()
      .replace(/\s+/g, " ");
  },

  getRoofStatus(venueName) {
    const venue = this.normalizeVenue(venueName);

    if (this.roofParks[venue]) {
      return {
        venue,
        ...this.roofParks[venue],
        bulb: this.roofParks[venue].verified ? "💡🟢" : "💡🔴"
      };
    }

    return {
      venue,
      type: "OPEN_AIR",
      label: "AIRE LIBRE",
      verified: true,
      confidence: 100,
      climate: "ACTIVO",
      note: "Estadio abierto; clima exterior aplica",
      bulb: "💡🟢"
    };
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

  isClimateActive(venueName) {
    const r = this.getRoofStatus(venueName);
    return r.climate === "ACTIVO";
  },

  isVerified(venueName) {
    const r = this.getRoofStatus(venueName);
    return r.verified === true;
  },

  getConfidence(venueName) {
    const r = this.getRoofStatus(venueName);
    return Number(r.confidence || 0);
  }
};
