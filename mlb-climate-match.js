/* ============================================================
   PRÓLOGO — mlb-climate-match.js
   ============================================================
   QUÉ ES:
     Capa de COMPATIBILIDAD. Ya no tiene lógica propia — delega todo
     a mlbpro-core.js. Antes tenía su PROPIA fechaHoyISO() calculada
     con la hora LOCAL del dispositivo (ni ET ni UTC — la hora que
     tuviera puesto el teléfono de quien abriera la app), y eso era
     una tercera fuente de "hoy" distinta a las otras dos. Ya no.

   DE QUÉ DEPENDE:
     mlbpro-core.js. Si no está cargado antes, este archivo se
     desactiva solo (console.warn) y no crea window.MLBClimateRoutes.

   QUIÉN LO USA:
     ⚠️ NADIE todavía dentro de este repo (ni index.html ni
     viento-parque.html llaman a window.MLBClimateRoutes). Se deja
     cargado por si algún archivo externo (de otra sesión/agente) lo
     está importando por su nombre viejo.

   API (window.MLBClimateRoutes):
     PROXY, viaProxy, fechaHoyISO → alias directos de MLBPRO_CORE.
     scheduleUrl(fechaISO) → string URL completa (con proxy) al
       schedule de esa fecha.
     venueUrl(venueId) → string URL completa al venue.
     weatherUrl(lat, lon) → string URL directa a Open-Meteo forecast
       (SIN proxy — Open-Meteo no lo necesita, a diferencia de MLB API).

   QUÉ TOCA:
     Nada. Solo arma strings de URL.

   SI SE AGREGA MONEYLINE / K6:
     Si el nuevo motor necesita rutas, que use MLBPRO_CORE directo
     (scheduleByDate, getVenueFull, etc., que ya hacen el fetch), no
     este archivo — este es solo compatibilidad hacia atrás.
   ============================================================ */

(function () {
  if (!window.MLBPRO_CORE) {
    console.warn("mlb-climate-match.js requiere que mlbpro-core.js se cargue antes.");
    return;
  }

  const core = window.MLBPRO_CORE;

  function weatherUrl(lat, lon) {
    return "https://api.open-meteo.com/v1/forecast" +
      "?latitude=" + lat +
      "&longitude=" + lon +
      "&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,wind_direction_10m" +
      "&temperature_unit=fahrenheit" +
      "&wind_speed_unit=mph";
  }

  window.MLBClimateRoutes = {
    PROXY: core.PROXY,
    viaProxy: core.viaProxy,
    fechaHoyISO: core.hoyISO,
    scheduleUrl: (fechaISO) => core.viaProxy(`${core.MLB_BASE}/schedule?sportId=1&date=${fechaISO}&hydrate=venue`),
    venueUrl: (venueId) => core.viaProxy(`${core.MLB_BASE}/venues/${venueId}?hydrate=location`),
    weatherUrl: weatherUrl
  };
})();
