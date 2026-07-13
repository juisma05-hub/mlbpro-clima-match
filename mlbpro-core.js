/* ============================================================
   PRÓLOGO — mlbpro-core.js
   ============================================================
   QUÉ ES:
     Fuente ÚNICA de verdad para fecha/hora en zona horaria de MLB
     (America/New_York), rutas de API (MLB Stats API + Open-Meteo vía
     proxy), fetch helpers, umbrales de coincidencia, y el gate de
     "juego Final" para el histórico.

   DE QUÉ DEPENDE:
     De nada. Es el primer archivo de lógica que debe cargar (después
     de parques-orientacion.js, que es standalone también).

   QUIÉN LO USA:
     index.html, viento-parque.html, game-cards.js, confidence-panel.js,
     mlb-climate-match.js (shim de compatibilidad).

   REGLA DE ORO — NO ROMPER ESTO:
     Ningún otro archivo puede tener su propia función hoyISO(),
     ayerISO(), fechaHoyISO(), o lógica de "qué hora es". Todos usan
     MLBPRO_CORE.hoyISO() / .horaETNumero(). Esa duplicación fue
     exactamente lo que causó el bug de "hora de la costa": tres
     archivos calculaban "hoy" de tres formas distintas (una en ET
     correcto, una en UTC crudo, una en la hora local del dispositivo)
     y daban fechas distintas entre las 8pm y medianoche hora del Este.
     Antes de agregar MoneyLine, K6, o cualquier motor nuevo: que
     importe fecha/hora/proxy/umbrales DE ACÁ, nunca los recalcule.

   API (window.MLBPRO_CORE):
     PROXY, MLB_BASE, CACHE_HIST, START_HIST, TZ   → constantes de config
     UMBRAL_OK (76), UMBRAL_MID (65)               → semáforo único de coincidencia

     hoyISO() → string "YYYY-MM-DD". Fecha de HOY en America/New_York.
     ayerISO() → string "YYYY-MM-DD". Fecha de AYER en America/New_York.
     addDays(dateISO, n) → string "YYYY-MM-DD". Suma/resta días en UTC
       puro sobre el string (nunca se corre de día por zona horaria).
     horaETNumero(dateObj) → number 0-23. Hora del Date en ET real,
       sin importar la zona horaria del dispositivo que ejecuta el código.
     horaJuego(gameDateISO) → string "H:MM AM/PM ET" para MOSTRAR en UI.
     viaProxy(url) → string. Envuelve una URL en el proxy configurado.

     fetchJSON(url) → Promise<object>. GET + parseo JSON, lanza si !ok.
     scheduleByDate(dateISO) → Promise<Array<game>>. Schedule de MLB.
     getVenueFull(venueId) → Promise<venue|null>. Venue con location.
     coordsFromVenue(venueObj) → {lat,lon}|null.
     getClimaActual(lat,lon) → Promise<{tempF,humidity,precip,windMph,windDir}>.
     getClimaHistorico(lat,lon,dateISO,gameDate) → Promise<clima|null>.
       Usa gameDate para escoger la hora del día más cercana, EN ET.
     getBoxScore(gamePk) → Promise<{awayRuns,homeRuns,awayKs,homeKs,awayHRs,homeHRs}>.
       Lanza error si falla — quien llama debe decidir qué hacer (el
       histórico lo salta, no lo mete en 0).
     esJuegoFinal(gameObj) → boolean. ÚNICO gate válido para meter un
       juego al histórico. true solo si detailedState/abstractGameState
       dicen Final de verdad.

     guardarHistoricoCache(rows) → void. Escribe en localStorage[CACHE_HIST].
     leerHistoricoCache() → Array. Lee de localStorage[CACHE_HIST].
     borrarHistoricoCache() → boolean. Borra localStorage[CACHE_HIST].
       Devuelve true si el borrado se ejecutó sin lanzar error, false
       si no (quien llama debe respetar ese resultado, no asumir éxito).

   QUÉ TOCA:
     localStorage, clave "MLBPRO_DATA_MADRE_HIST_2026_V1", y SOLO a
     través de estas tres funciones: guardarHistoricoCache(),
     leerHistoricoCache(), borrarHistoricoCache(). Ningún otro archivo
     debe llamar a localStorage directo — si necesita leer, escribir o
     borrar el histórico, pasa por acá. Nada de DOM.
   ============================================================ */

window.MLBPRO_CORE = (function () {

  const PROXY = "https://mlb-score-proxy.jip0512.workers.dev/?url=";
  const MLB_BASE = "https://statsapi.mlb.com/api/v1";
  const CACHE_HIST = "MLBPRO_DATA_MADRE_HIST_2026_V1";
  const START_HIST = "2026-03-26";
  const TZ = "America/New_York";

  // Umbral único de "coincidencia buena / media". Antes index.html
  // usaba 76% y game-cards.js usaba 85% para el mismo semáforo verde.
  const UMBRAL_OK = 76;
  const UMBRAL_MID = 65;

  function viaProxy(url) {
    return PROXY + encodeURIComponent(url);
  }

  function fechaET(date) {
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit"
    });
    return fmt.format(date);
  }

  // Hora (0-23) de una fecha, correctamente leída en America/New_York,
  // sin importar en qué zona horaria esté el dispositivo de quien usa
  // la app. Antes esto se sacaba con d.getHours(), que usa la zona
  // horaria LOCAL del navegador — ese era el bug: la hora de clima
  // histórico que se buscaba dependía de dónde estuviera el usuario,
  // no de la hora real del juego en el parque.
  function horaETNumero(date) {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: TZ, hour: "numeric", hour12: false
    });
    const parts = fmt.formatToParts(date);
    const h = parts.find(p => p.type === "hour");
    let val = h ? parseInt(h.value, 10) : NaN;
    if (val === 24) val = 0;
    return val;
  }

  function hoyISO() {
    return fechaET(new Date());
  }

  function ayerISO() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return fechaET(d);
  }

  // Suma días trabajando en UTC puro sobre el string de fecha (no en
  // Date()+toISOString() con hora local), así nunca se corre un día
  // sin importar la zona horaria del navegador.
  function addDays(dateISO, n) {
    const [y, m, d] = dateISO.split("-").map(Number);
    const utcMs = Date.UTC(y, m - 1, d) + n * 86400000;
    const dd = new Date(utcMs);
    const yy = dd.getUTCFullYear();
    const mm = String(dd.getUTCMonth() + 1).padStart(2, "0");
    const da = String(dd.getUTCDate()).padStart(2, "0");
    return `${yy}-${mm}-${da}`;
  }

  function horaJuego(gameDateISO) {
    if (!gameDateISO) return "NO CONFIRMADA";
    try {
      const d = new Date(gameDateISO);
      if (isNaN(d.getTime())) return "NO CONFIRMADA";
      return d.toLocaleTimeString("es-US", { hour: "2-digit", minute: "2-digit", timeZone: TZ }) + " ET";
    } catch (e) {
      return "NO CONFIRMADA";
    }
  }

  async function fetchJSON(url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error("HTTP " + r.status);
    return await r.json();
  }

  async function scheduleByDate(dateISO) {
    const url = viaProxy(`${MLB_BASE}/schedule?sportId=1&date=${dateISO}&hydrate=venue`);
    const j = await fetchJSON(url);
    return j.dates?.[0]?.games || [];
  }

  async function getVenueFull(venueId) {
    const url = viaProxy(`${MLB_BASE}/venues/${venueId}?hydrate=location`);
    const j = await fetchJSON(url);
    return j.venues?.[0] || null;
  }

  function coordsFromVenue(v) {
    const loc = v?.location || {};
    const dc = loc.defaultCoordinates || {};
    const lat = Number(dc.latitude ?? loc.latitude);
    const lon = Number(dc.longitude ?? loc.longitude);
    if (Number.isFinite(lat) && Number.isFinite(lon)) return { lat, lon };
    return null;
  }

  async function getClimaActual(lat, lon) {
    const url =
      "https://api.open-meteo.com/v1/forecast" +
      `?latitude=${lat}&longitude=${lon}` +
      "&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,wind_direction_10m" +
      "&temperature_unit=fahrenheit&wind_speed_unit=mph";
    const j = await fetchJSON(url);
    const c = j.current || {};
    return {
      tempF: Number(c.temperature_2m),
      humidity: Number(c.relative_humidity_2m),
      precip: Number(c.precipitation),
      windMph: Number(c.wind_speed_10m),
      windDir: Number(c.wind_direction_10m)
    };
  }

  async function getClimaHistorico(lat, lon, dateISO, gameDate) {
    const url =
      "https://archive-api.open-meteo.com/v1/archive" +
      `?latitude=${lat}&longitude=${lon}` +
      `&start_date=${dateISO}&end_date=${dateISO}` +
      "&hourly=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,wind_direction_10m" +
      `&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=${TZ}`;
    const j = await fetchJSON(url);
    const h = j.hourly || {};
    const times = h.time || [];
    if (!times.length) return null;

    let targetHour = 19;
    if (gameDate) {
      try {
        const d = new Date(gameDate);
        if (!isNaN(d.getTime())) targetHour = horaETNumero(d);
      } catch (e) {}
    }

    let best = 0, diff = 999;
    for (let i = 0; i < times.length; i++) {
      const hour = Number(String(times[i]).slice(11, 13));
      const dd = Math.abs(hour - targetHour);
      if (dd < diff) { diff = dd; best = i; }
    }

    return {
      tempF: Number(h.temperature_2m?.[best]),
      humidity: Number(h.relative_humidity_2m?.[best]),
      precip: Number(h.precipitation?.[best]),
      windMph: Number(h.wind_speed_10m?.[best]),
      windDir: Number(h.wind_direction_10m?.[best])
    };
  }

  async function getBoxScore(gamePk) {
    const url = viaProxy(`${MLB_BASE}/game/${gamePk}/boxscore`);
    const j = await fetchJSON(url);
    const teams = j.teams || {};
    const away = teams.away?.teamStats?.batting || {};
    const home = teams.home?.teamStats?.batting || {};
    return {
      awayRuns: Number(away.runs), homeRuns: Number(home.runs),
      awayKs: Number(away.strikeOuts), homeKs: Number(home.strikeOuts),
      awayHRs: Number(away.homeRuns), homeHRs: Number(home.homeRuns)
    };
  }

  // ÚNICO gate válido para que un juego entre al histórico: tiene que
  // ser Final de verdad. Antes solo se excluían "postponed" y
  // "cancelled" — todo lo demás (en vivo, programado, suspendido)
  // pasaba de largo y se guardaba con 0 carreras / 0 ponches,
  // contaminando el cache para siempre porque nunca se vuelve a
  // recalcular una fecha ya guardada.
  function esJuegoFinal(g) {
    const detalle = String(g?.status?.detailedState || "").toLowerCase();
    const abstracto = String(g?.status?.abstractGameState || "").toLowerCase();
    if (abstracto === "final") return true;
    return detalle === "final" || detalle.startsWith("final:") || detalle.startsWith("completed early");
  }

  function guardarHistoricoCache(rows) {
    try { localStorage.setItem(CACHE_HIST, JSON.stringify(rows)); } catch (e) {}
  }

  function leerHistoricoCache() {
    try {
      const raw = localStorage.getItem(CACHE_HIST);
      if (!raw) return [];
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  }

  // Único borrado real y confirmado del histórico. Antes no existía
  // ninguna función expuesta para esto, así que index.html llamaba a
  // localStorage.removeItem(CORE.CACHE_HIST) directo — rompiendo la
  // regla de que localStorage solo se toca desde aquí. Devuelve
  // true/false real (no asume éxito) para que quien llame no afirme
  // "borrado" si el try/catch atrapó un error.
  function borrarHistoricoCache() {
    try {
      localStorage.removeItem(CACHE_HIST);
      return true;
    } catch (e) {
      return false;
    }
  }

  return {
    PROXY, MLB_BASE, CACHE_HIST, START_HIST, TZ, UMBRAL_OK, UMBRAL_MID,
    viaProxy, hoyISO, ayerISO, addDays, horaJuego, horaETNumero,
    fetchJSON, scheduleByDate, getVenueFull, coordsFromVenue,
    getClimaActual, getClimaHistorico, getBoxScore, esJuegoFinal,
    guardarHistoricoCache, leerHistoricoCache, borrarHistoricoCache
  };
})();
