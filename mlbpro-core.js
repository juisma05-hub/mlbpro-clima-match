/* ============================================================
   PRÓLOGO — mlbpro-core.js
   ============================================================
   QUÉ ES:
     Fuente ÚNICA de verdad para fecha/hora en zona horaria de MLB
     (America/New_York, para el gate de "qué día es hoy" a nivel de
     liga), rutas de API (MLB Stats API + Open-Meteo vía proxy), fetch
     helpers, umbrales de coincidencia, y el gate de "juego Final" para
     el histórico.

   DE QUÉ DEPENDE:
     Depende de que estadios.js ya esté cargado como <script> ANTES que
     este archivo, porque getClimaHistorico() necesita
     stadiumGet(venueNombre).timezone para saber la zona horaria REAL
     de cada parque (America/New_York NUNCA es correcta para todos los
     parques). El orden de carga en index.html ya cumple esto
     (estadios.js primero) y hay que mantenerlo así.

   QUIÉN LO USA:
     index.html, viento-parque.html, game-cards.js, confidence-panel.js,
     mlb-climate-match.js (shim de compatibilidad).

   REGLA DE ORO — NO ROMPER ESTO:
     Ningún otro archivo puede tener su propia función hoyISO(),
     ayerISO(), fechaHoyISO(), o lógica de "qué hora es" A NIVEL DE
     LIGA (qué día es hoy en MLB). Todos usan MLBPRO_CORE.hoyISO() /
     .horaETNumero(). Esa duplicación fue exactamente lo que causó el
     bug de "hora de la costa" original: tres archivos calculaban "hoy"
     de tres formas distintas.

     Ningún otro archivo puede tener su propia lógica de "a qué hora
     local del PARQUE fue el juego", ni de "qué fecha local del PARQUE
     corresponde a un gameDate" — eso vive únicamente en
     getClimaHistorico() de este archivo, que resuelve el timezone real
     vía stadiumGet() de estadios.js. Antes este archivo asumía
     America/New_York para todos los parques al construir la hora
     objetivo Y al consultar Open-Meteo — eso hacía que los parques del
     Oeste, Centro, Denver y Arizona tomaran datos de una hora del día
     equivocada, y como consecuencia aparecían demasiados juegos con la
     misma dirección de viento repetida. Corregido.

   API (window.MLBPRO_CORE):
     PROXY, MLB_BASE, CACHE_HIST, START_HIST, TZ   → constantes de config
     UMBRAL_OK (76), UMBRAL_MID (65)               → semáforo único de coincidencia

     hoyISO() → string "YYYY-MM-DD". Fecha de HOY en America/New_York
       (gate de liga — nunca cambia, no tiene que ver con el parque).
     ayerISO() → string "YYYY-MM-DD". Fecha de AYER en America/New_York.
     addDays(dateISO, n) → string "YYYY-MM-DD". Suma/resta días en UTC
       puro sobre el string (nunca se corre de día por zona horaria).
     horaETNumero(dateObj) → number 0-23. Hora del Date en ET real
       (América/New_York fijo — se usa solo donde el dato es "hora de
       liga", no hora de parque).
     horaJuego(gameDateISO) → string "H:MM AM/PM ET" para MOSTRAR en UI.
     viaProxy(url) → string. Envuelve una URL en el proxy configurado.

     fetchJSON(url) → Promise<object>. GET + parseo JSON, lanza si !ok.
     scheduleByDate(dateISO) → Promise<Array<game>>. Schedule de MLB.
     getVenueFull(venueId) → Promise<venue|null>. Venue con location.
     coordsFromVenue(venueObj) → {lat,lon}|null.
     getClimaActual(lat,lon) → Promise<{tempF,humidity,precip,windMph,windDir}>.
       Sin cambios en ninguna corrección — el clima actual (juego de
       HOY) no depende de encontrar una hora/fecha histórica pasada.

     getClimaHistorico(lat, lon, dateISO, gameDate, venueNombre)
       → Promise<clima|null>.

       Resuelve stadiumGet(venueNombre) para obtener el timezone REAL
       del parque. Si no puede confirmarlo (sin venueNombre, o
       stadiumGet no devuelve nada, o el objeto no trae .timezone),
       devuelve null de inmediato — NUNCA cae a America/New_York como
       respaldo silencioso.

       FECHA LOCAL DEL PARQUE (corrección de esta pasada): antes se le
       pasaba dateISO (la fecha del recorrido, en ET) directo a
       start_date/end_date de Open-Meteo, sin importar el parque. Ahora
       primero calcula la fecha LOCAL real del parque a partir de
       gameDate + tzParque (misma familia de conversión que ya usa
       horaEnZona(), pero para día-mes-año en vez de hora), y esa es la
       fecha que se usa en start_date/end_date. Solo si gameDate falta
       o es inválido, se cae a dateISO como fecha de respaldo — dateISO
       sigue siendo un dato real (la fecha de schedule que ya trajo
       MLB), nunca un valor inventado.

       HORA LOCAL OBJETIVO: calculada igual que antes, convirtiendo
       gameDate a la zona horaria real del parque (horaEnZona), con
       19 (7pm local) como default solo si gameDate falta o es
       inválido.

       VALIDACIÓN DE VALORES DE CLIMA (corrección de esta pasada): ya
       no se usa Number(valor) directo sobre lo que devuelve Open-Meteo
       — Number(null) da 0, así que un dato ausente se convertía en un
       0 válido de forma silenciosa. Ahora cada valor (tempF, humidity,
       precip, windMph, windDir) pasa por numeroRealOClima(), que
       descarta null/undefined/""/booleanos ANTES de convertir y
       devuelve null si no es un número real. windMph y windDir son
       OBLIGATORIOS: si cualquiera de los dos sale null, la función
       completa devuelve null (no hay compás de viento sin esos dos
       datos reales). tempF/humidity/precip pueden salir null sin que
       eso tumbe la función entera — se guardan tal cual (null), nunca
       como 0.

       Devuelve, además de los campos de clima (tempF, humidity,
       precip, windMph, windDir — cualquiera puede ser null salvo
       windMph/windDir que ya vienen garantizados no-null si la función
       no devolvió null antes), tres campos de auditoría:
         timezoneUsado        → string. El timezone real usado.
         horaLocalObjetivo    → number 0-23. Hora local buscada.
         horaClimaUtilizada   → string. Timestamp exacto elegido del
                                 archivo de Open-Meteo.
       No agrega "trayectoria de siete horas" ni ninguna lógica nueva
       de rango horario — sigue fuera de alcance, tal como se pidió.

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
     debe llamar a localStorage directo. Nada de DOM.

   CORRECCIÓN 21 jul 2026 (primera pasada) — zona horaria real por
   parque:
   - getClimaHistorico() recibe venueNombre, resuelve timezone real vía
     stadiumGet(), null si no se confirma. Hora objetivo calculada en
     esa zona real. Campos de auditoría agregados.

   CORRECCIÓN 21 jul 2026 (segunda pasada — esta) — fecha local y
   validación numérica real:
   - Se agregó fechaEnZona(date, tz): misma idea que fechaET() pero
     parametrizada por timezone, para calcular el día-mes-año LOCAL del
     parque a partir de gameDate. start_date/end_date de la consulta a
     Open-Meteo ahora usan esa fecha local real del parque, no dateISO
     a secas. dateISO solo se usa como respaldo si gameDate falta o es
     inválido (dateISO sigue siendo dato real, no inventado).
   - Se agregó numeroRealOClima(v): valida cada valor de clima antes de
     convertirlo (rechaza null/undefined/""/booleanos), en vez de
     Number(v) directo. windMph y windDir son obligatorios — si
     cualquiera sale null, toda la función devuelve null. tempF,
     humidity y precip pueden ser null sin invalidar el resto.

   ESTADO:
     NO_CONFIRMADO — lógica de fecha/hora por timezone verificada
     offline (Intl.DateTimeFormat, sin red) en la pasada anterior para
     ET/Central/Mountain-Phoenix/Pacific. Esta pasada (fecha local +
     validación numérica) todavía no se corrió en el navegador real.
     Pendiente que Perez corra jalarHistorico2026() y confirme: (a) sin
     404 de Open-Meteo, (b) consola limpia, (c) que la fecha local
     usada en start_date/end_date coincide con el día real del parque
     para cada zona horaria, y (d) que ningún juego real termina con
     tempF/humidity/precip en 0 falso cuando en realidad faltaba el
     dato.

   FECHA:
     21 jul 2026.
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

  // Fecha "YYYY-MM-DD" de una fecha, en CUALQUIER zona horaria IANA
  // (tz). Generaliza fechaET() (que solo servía para TZ fijo) — usada
  // por getClimaHistorico() para calcular la fecha LOCAL real del
  // parque a partir de gameDate, en vez de asumir la fecha de recorrido
  // (dateISO, en ET) para todos los parques.
  function fechaEnZona(date, tz) {
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit"
    });
    return fmt.format(date);
  }

  function fechaET(date) {
    return fechaEnZona(date, TZ);
  }

  // Hora (0-23) de una fecha, en CUALQUIER zona horaria IANA (tz), sin
  // importar en qué zona horaria esté el dispositivo de quien usa la
  // app. Generaliza la lógica que antes solo existía fija a ET
  // (horaETNumero) — getClimaHistorico() la usa con el timezone real
  // de cada parque. Interna, no se expone en window.MLBPRO_CORE.
  function horaEnZona(date, tz) {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: tz, hour: "numeric", hour12: false
    });
    const parts = fmt.formatToParts(date);
    const h = parts.find(p => p.type === "hour");
    let val = h ? parseInt(h.value, 10) : NaN;
    if (val === 24) val = 0;
    return val;
  }

  // Hora (0-23) de una fecha, correctamente leída en America/New_York
  // (zona horaria de LIGA, no de parque). Envoltorio de horaEnZona()
  // sobre TZ fijo — mismo comportamiento público de siempre.
  function horaETNumero(date) {
    return horaEnZona(date, TZ);
  }

  // Valida un valor de clima ANTES de convertirlo a número. Number(v)
  // directo convierte null en 0, "" en 0, y true en 1 — eso metía datos
  // ausentes como si fueran un 0 real. Devuelve el número real si es
  // válido, o null si no lo es (nunca 0 de relleno).
  function numeroRealOClima(v) {
    if (v === null || v === undefined) return null;
    if (typeof v === "boolean") return null;
    if (typeof v === "string" && v.trim() === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
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

  // CORREGIDO 21 jul 2026 (segunda pasada): fecha LOCAL del parque
  // (no dateISO a secas) para start_date/end_date, y validación real
  // de cada valor de clima (no Number() directo). Sigue resolviendo el
  // timezone real vía stadiumGet(venueNombre) — null si no se confirma.
  async function getClimaHistorico(lat, lon, dateISO, gameDate, venueNombre) {
    const stadium = (typeof stadiumGet === "function") ? stadiumGet(venueNombre) : null;
    const tzParque = stadium && stadium.timezone ? stadium.timezone : null;

    if (!tzParque) return null;

    // Fecha LOCAL real del parque, calculada a partir de gameDate +
    // tzParque. Si gameDate falta o es inválido, se cae a dateISO
    // (dato real de todas formas, no inventado) como respaldo.
    let fechaLocalParque = dateISO;
    let dGame = null;
    if (gameDate) {
      try {
        const d = new Date(gameDate);
        if (!isNaN(d.getTime())) {
          dGame = d;
          fechaLocalParque = fechaEnZona(d, tzParque);
        }
      } catch (e) {}
    }

    const url =
      "https://archive-api.open-meteo.com/v1/archive" +
      `?latitude=${lat}&longitude=${lon}` +
      `&start_date=${fechaLocalParque}&end_date=${fechaLocalParque}` +
      "&hourly=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,wind_direction_10m" +
      `&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=${encodeURIComponent(tzParque)}`;
    const j = await fetchJSON(url);
    const h = j.hourly || {};
    const times = h.time || [];
    if (!times.length) return null;

    // Hora local OBJETIVO del juego, en el timezone REAL del parque.
    // Default 19 (7pm local) solo si gameDate faltó o fue inválido.
    const targetHour = dGame ? horaEnZona(dGame, tzParque) : 19;

    let best = 0, diff = 999;
    for (let i = 0; i < times.length; i++) {
      const hour = Number(String(times[i]).slice(11, 13));
      const dd = Math.abs(hour - targetHour);
      if (dd < diff) { diff = dd; best = i; }
    }

    // Validación real de cada valor — nunca Number(v) directo (eso
    // convierte null/""/booleano en 0 silencioso).
    const tempF = numeroRealOClima(h.temperature_2m?.[best]);
    const humidity = numeroRealOClima(h.relative_humidity_2m?.[best]);
    const precip = numeroRealOClima(h.precipitation?.[best]);
    const windMph = numeroRealOClima(h.wind_speed_10m?.[best]);
    const windDir = numeroRealOClima(h.wind_direction_10m?.[best]);

    // windMph y windDir son obligatorios: sin ellos no hay compás de
    // viento real que mostrar, así que la función completa devuelve
    // null en vez de un objeto a medias con esos dos campos vacíos.
    if (windMph === null || windDir === null) return null;

    return {
      tempF: tempF,
      humidity: humidity,
      precip: precip,
      windMph: windMph,
      windDir: windDir,
      // Campos de auditoría.
      timezoneUsado: tzParque,
      horaLocalObjetivo: targetHour,
      horaClimaUtilizada: times[best]
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
