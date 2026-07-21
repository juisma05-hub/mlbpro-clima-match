/* ============================================================
   PRÓLOGO — mlbpro-core.js
   ============================================================
   (sin cambios respecto a la pasada anterior, salvo esta entrada)

   SEXTA PASADA (21 jul 2026) — auditoría de cruce de fecha local:
   - Cada punto de getTrayectoriaVientoHistorico() ahora incluye
     fechaLocalUsada (YYYY-MM-DD) y claveLocalUsada (el string exacto
     "YYYY-MM-DDTHH:00" que se usó para buscar el dato en Open-Meteo).
     Antes solo se devolvía horaLocalUsada (0-23), que por sí sola no
     alcanza para saber si dos puntos con la misma hora (ej. 23h y 01h
     del día siguiente, que NO son la misma hora, pero podrían
     confundirse) pertenecen a fechas locales distintas. Con estos dos
     campos nuevos, quien consuma la trayectoria puede detectar un
     cruce de medianoche local comparando fechaLocalUsada entre los 7
     puntos, sin tener que reimplementar ningún cálculo de fecha/hora.
   - No se tocó ninguna otra lógica: BRISA_RANGO_GRADOS=30,
     BRISA_RANGO_APROBADO=false, mediaCircularClasificacion y
     desviacionMaximaClasificacion (ya aprobados) siguen igual.
   ============================================================ */

window.MLBPRO_CORE = (function () {

  const PROXY = "https://mlb-score-proxy.jip0512.workers.dev/?url=";
  const MLB_BASE = "https://statsapi.mlb.com/api/v1";
  const CACHE_HIST = "MLBPRO_DATA_MADRE_HIST_2026_V1";
  const START_HIST = "2026-03-26";
  const TZ = "America/New_York";

  const UMBRAL_OK = 76;
  const UMBRAL_MID = 65;

  const OFFSETS_TRAYECTORIA = [-2, -1, 0, 1, 2, 3, 4];
  const OFFSETS_CLASIFICACION = [0, 1, 2, 3, 4];

  const BRISA_RANGO_GRADOS = 30;
  const BRISA_RANGO_APROBADO = false;

  function viaProxy(url) {
    return PROXY + encodeURIComponent(url);
  }

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  function fechaEnZona(date, tz) {
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit"
    });
    return fmt.format(date);
  }

  function fechaET(date) {
    return fechaEnZona(date, TZ);
  }

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

  function horaETNumero(date) {
    return horaEnZona(date, TZ);
  }

  function numeroRealOClima(v) {
    if (v === null || v === undefined) return null;
    if (typeof v === "boolean") return null;
    if (typeof v === "string" && v.trim() === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  function diferenciaAngular(a, b) {
    let d = Math.abs(a - b) % 360;
    return d > 180 ? 360 - d : d;
  }

  function promedioCircular(grados) {
    let sumX = 0, sumY = 0;
    grados.forEach(g => {
      const rad = g * Math.PI / 180;
      sumX += Math.cos(rad);
      sumY += Math.sin(rad);
    });
    const anguloMedio = Math.atan2(sumY / grados.length, sumX / grados.length) * 180 / Math.PI;
    return (anguloMedio + 360) % 360;
  }

  function hoyISO() {
    return fechaET(new Date());
  }

  function ayerISO() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return fechaET(d);
  }

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

  async function getClimaHistorico(lat, lon, dateISO, gameDate, venueNombre) {
    const stadium = (typeof stadiumGet === "function") ? stadiumGet(venueNombre) : null;
    const tzParque = stadium && stadium.timezone ? stadium.timezone : null;

    if (!tzParque) return null;

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

    const targetHour = dGame ? horaEnZona(dGame, tzParque) : 19;

    let best = 0, diff = 999;
    for (let i = 0; i < times.length; i++) {
      const hour = Number(String(times[i]).slice(11, 13));
      const dd = Math.abs(hour - targetHour);
      if (dd < diff) { diff = dd; best = i; }
    }

    const tempF = numeroRealOClima(h.temperature_2m?.[best]);
    const humidity = numeroRealOClima(h.relative_humidity_2m?.[best]);
    const precip = numeroRealOClima(h.precipitation?.[best]);
    const windMph = numeroRealOClima(h.wind_speed_10m?.[best]);
    const windDir = numeroRealOClima(h.wind_direction_10m?.[best]);

    if (windMph === null || windDir === null) return null;

    return {
      tempF: tempF,
      humidity: humidity,
      precip: precip,
      windMph: windMph,
      windDir: windDir,
      timezoneUsado: tzParque,
      horaLocalObjetivo: targetHour,
      horaClimaUtilizada: times[best]
    };
  }

  async function getTrayectoriaVientoHistorico(lat, lon, gameDate, venueNombre) {
    const stadium = (typeof stadiumGet === "function") ? stadiumGet(venueNombre) : null;
    const tzParque = stadium && stadium.timezone ? stadium.timezone : null;
    if (!tzParque) return null;

    if (!gameDate) return null;
    const dGame = new Date(gameDate);
    if (isNaN(dGame.getTime())) return null;

    const momentos = OFFSETS_TRAYECTORIA.map(ho => new Date(dGame.getTime() + ho * 3600000));

    const fechasLocales = momentos.map(m => fechaEnZona(m, tzParque));
    const fechaDesde = fechasLocales.reduce((a, b) => (a < b ? a : b));
    const fechaHasta = fechasLocales.reduce((a, b) => (a > b ? a : b));

    const url =
      "https://archive-api.open-meteo.com/v1/archive" +
      `?latitude=${lat}&longitude=${lon}` +
      `&start_date=${fechaDesde}&end_date=${fechaHasta}` +
      "&hourly=wind_speed_10m,wind_direction_10m" +
      `&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=${encodeURIComponent(tzParque)}`;
    const j = await fetchJSON(url);
    const h = j.hourly || {};
    const times = h.time || [];
    if (!times.length) return null;

    const indicePorTiempo = new Map();
    times.forEach((t, i) => indicePorTiempo.set(t, i));

    const puntos = OFFSETS_TRAYECTORIA.map((ho, idx) => {
      const momento = momentos[idx];
      const horaLocal = horaEnZona(momento, tzParque);
      const fechaLocal = fechaEnZona(momento, tzParque);
      const clave = `${fechaLocal}T${pad2(horaLocal)}:00`;
      const i = indicePorTiempo.get(clave);

      const windDirRaw = i !== undefined ? numeroRealOClima(h.wind_direction_10m?.[i]) : null;
      const windMphRaw = i !== undefined ? numeroRealOClima(h.wind_speed_10m?.[i]) : null;

      return {
        offsetHoras: ho,
        horaLocalUsada: horaLocal,
        // NUEVO en esta pasada — permite auditar cruce de medianoche
        // local sin reimplementar cálculo de fecha en otro archivo.
        fechaLocalUsada: fechaLocal,
        claveLocalUsada: clave,
        windFromDeg: windDirRaw,
        windToDeg: windDirRaw !== null ? (windDirRaw + 180) % 360 : null,
        windMph: windMphRaw
      };
    });

    const puntoInicio = puntos.find(p => p.offsetHoras === 0);
    const direccionInicio = puntoInicio ? puntoInicio.windFromDeg : null;
    const direccionFinal = puntos[puntos.length - 1].windFromDeg;

    const velocidadesValidas = puntos.filter(p => p.windMph !== null).map(p => p.windMph);
    const velocidadMin = velocidadesValidas.length ? Math.min(...velocidadesValidas) : null;
    const velocidadMax = velocidadesValidas.length ? Math.max(...velocidadesValidas) : null;
    const velocidadProm = velocidadesValidas.length
      ? Math.round((velocidadesValidas.reduce((a, b) => a + b, 0) / velocidadesValidas.length) * 100) / 100
      : null;

    const puntosClasificacion = puntos.filter(p => OFFSETS_CLASIFICACION.includes(p.offsetHoras));
    const direccionesClasificacion = puntosClasificacion
      .filter(p => p.windFromDeg !== null)
      .map(p => p.windFromDeg);

    let clasificacion = "NO_CONFIRMADO";
    let mediaCircularClasificacion = null;
    let desviacionMaximaClasificacion = null;

    if (direccionesClasificacion.length === OFFSETS_CLASIFICACION.length) {
      mediaCircularClasificacion = promedioCircular(direccionesClasificacion);
      desviacionMaximaClasificacion = Math.max(
        ...direccionesClasificacion.map(g => diferenciaAngular(g, mediaCircularClasificacion))
      );
      clasificacion = desviacionMaximaClasificacion <= BRISA_RANGO_GRADOS ? "BRISA_ESTABLE" : "BRISA_CAMBIANTE";
    }

    return {
      timezoneUsado: tzParque,
      offsets: OFFSETS_TRAYECTORIA,
      offsetsClasificacion: OFFSETS_CLASIFICACION,
      puntos: puntos,
      direccionInicio: direccionInicio,
      direccionFinal: direccionFinal,
      velocidadMin: velocidadMin,
      velocidadMax: velocidadMax,
      velocidadProm: velocidadProm,
      mediaCircularClasificacion: mediaCircularClasificacion,
      desviacionMaximaClasificacion: desviacionMaximaClasificacion,
      clasificacion: clasificacion,
      rangoGradosUsado: BRISA_RANGO_GRADOS,
      rangoAprobado: BRISA_RANGO_APROBADO
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
    getClimaActual, getClimaHistorico, getTrayectoriaVientoHistorico,
    getBoxScore, esJuegoFinal,
    guardarHistoricoCache, leerHistoricoCache, borrarHistoricoCache
  };
})();
