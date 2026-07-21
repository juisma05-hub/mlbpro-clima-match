/* ============================================================
   PRÓLOGO — mlbpro-core.js
   ============================================================
   (ver historial completo de correcciones abajo; este bloque resume
   solo lo vigente)

   QUÉ ES:
     Fuente ÚNICA de verdad para fecha/hora en zona horaria de MLB,
     rutas de API (MLB Stats API + Open-Meteo vía proxy), fetch
     helpers, umbrales de coincidencia, gate de "juego Final", y la
     trayectoria de viento de 7 horas por juego histórico.

   DE QUÉ DEPENDE:
     estadios.js debe cargar ANTES (stadiumGet().timezone).

   API relevante a esta pasada:
     getTrayectoriaVientoHistorico(lat, lon, gameDate, venueNombre)
       → Promise<trayectoria|null>.

       Cada uno de los 7 puntos (offsets -2,-1,0,+1,+2,+3,+4) ahora
       incluye direccionConfiable: boolean (windMph !== null && windMph
       >= VELOCIDAD_MINIMA_DIRECCION_CONFIABLE). Con viento casi calmo,
       un anemómetro puede reportar una dirección que gira mucho sin
       que eso sea una brisa real cambiante — este campo lo señala por
       punto, para auditoría, sin decidir nada por sí solo.

       CLASIFICACIÓN — regla aprobada por Perez (21 jul 2026), en este
       orden estricto sobre los 5 puntos de juego (0,+1,+2,+3,+4):
         1) Si a CUALQUIERA de los 5 le falta windFromDeg o windMph
            real → "NO_CONFIRMADO".
         2) Si los 5 tienen dato completo, pero CUALQUIERA tiene
            windMph < VELOCIDAD_MINIMA_DIRECCION_CONFIABLE (3 mph) →
            "DIRECCION_NO_CONFIABLE". No se calcula media circular ni
            desviación con esos datos — se declara explícitamente que
            la dirección no es confiable a esa velocidad, en vez de
            forzar un veredicto (ni estable ni cambiante) con evidencia
            débil.
         3) Solo si los 5 tienen dato completo Y los 5 con windMph ≥ 3
            → se calcula media circular (vectorial) + desviación
            angular máxima (sin suma acumulada de giros) → 
            "BRISA_ESTABLE" (≤ BRISA_RANGO_GRADOS) o "BRISA_CAMBIANTE"
            (> BRISA_RANGO_GRADOS).
       NO_CONFIRMADO y DIRECCION_NO_CONFIABLE son estados DISTINTOS:
       el primero es "falta el dato", el segundo es "el dato existe
       pero no es físicamente confiable a esa velocidad". Nunca se
       confunden ni se colapsan en uno solo.

       BRISA_RANGO_GRADOS = 30 → Perez lo ve razonable como punto de
       partida (confirmado en la prueba corta: Wrigley con viento real
       dio desviación 5.6°, bien dentro de rango). Sigue marcado
       rangoAprobado: false formalmente hasta reconstruir el histórico
       completo con esta regla ya validada.

   QUÉ TOCA:
     localStorage, SOLO vía guardarHistoricoCache()/leerHistoricoCache()/
     borrarHistoricoCache(). Esta pasada no llama a ninguna de esas —
     getTrayectoriaVientoHistorico() sigue siendo de solo lectura.

   HISTORIAL DE CORRECCIONES (21 jul 2026):
   1) Zona horaria real por parque en getClimaHistorico().
   2) Fecha local del parque + validación numérica real en
      getClimaHistorico(). PROBADO Y APROBADO: 1,520 filas, 4/4 zonas
      PASS.
   3) Trayectoria de viento de 7 horas (getTrayectoriaVientoHistorico),
      función nueva.
   4) Clasificación restringida a offsets 0,+1,+2,+3,+4; direccionInicio
      corregido a offset 0; BRISA_RANGO_GRADOS marcado explícitamente
      como no aprobado.
   5) fechaLocalUsada y claveLocalUsada agregados a cada punto (permite
      auditar cruce de medianoche local sin reimplementar cálculo en
      otro archivo).
   6) ESTA PASADA — viento casi calmo: se agregó direccionConfiable por
      punto y el estado DIRECCION_NO_CONFIABLE, con la regla de 3 pasos
      descrita arriba. Confirmado con casos reales de la prueba corta:
      Chase Field (mínimo 1.3 mph) y Dodger Stadium (mínimo 1 mph), que
      antes salían BRISA_CAMBIANTE por una desviación angular grande a
      velocidad casi nula, ahora salen DIRECCION_NO_CONFIABLE.

   ESTADO:
     Zona horaria/fecha local → PROBADO Y APROBADO (1,520 filas, 4/4
     zonas PASS). Trayectoria de 7 horas + clasificación con viento
     casi calmo → lógica aprobada por Perez, pendiente de correr la
     prueba corta actualizada (Toronto en bucket ET, búsqueda
     obligatoria de cruce de medianoche) antes de decidir integrar a
     jalarHistorico2026() y reconstruir el histórico completo (~1,500
     filas). BRISA_RANGO_GRADOS=30 visto como razonable pero
     rangoAprobado sigue en false formalmente.

   FECHA:
     21 jul 2026.
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

  // Umbral aprobado por Perez (21 jul 2026): por debajo de esta
  // velocidad, la dirección de viento no se considera confiable para
  // decidir BRISA_ESTABLE/CAMBIANTE.
  const VELOCIDAD_MINIMA_DIRECCION_CONFIABLE = 3;

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
        fechaLocalUsada: fechaLocal,
        claveLocalUsada: clave,
        windFromDeg: windDirRaw,
        windToDeg: windDirRaw !== null ? (windDirRaw + 180) % 360 : null,
        windMph: windMphRaw,
        // NUEVO en esta pasada — true solo si hay windMph real y es
        // >= VELOCIDAD_MINIMA_DIRECCION_CONFIABLE. Con viento casi
        // calmo, la dirección puede girar mucho sin representar una
        // brisa real cambiante.
        direccionConfiable: windMphRaw !== null && windMphRaw >= VELOCIDAD_MINIMA_DIRECCION_CONFIABLE
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

    // Regla de 3 pasos aprobada por Perez (21 jul 2026):
    let clasificacion = "NO_CONFIRMADO";
    let mediaCircularClasificacion = null;
    let desviacionMaximaClasificacion = null;

    // Paso 1: los 5 puntos de juego deben tener dirección Y velocidad reales.
    const datosCompletos = puntosClasificacion.every(p => p.windFromDeg !== null && p.windMph !== null);

    if (datosCompletos) {
      // Paso 2: si cualquiera está por debajo del umbral de velocidad,
      // la dirección no es confiable — no se calcula nada, se declara así.
      const todosConfiables = puntosClasificacion.every(p => p.windMph >= VELOCIDAD_MINIMA_DIRECCION_CONFIABLE);

      if (!todosConfiables) {
        clasificacion = "DIRECCION_NO_CONFIABLE";
      } else {
        // Paso 3: los 5 con dato completo y velocidad confiable — se
        // calcula media circular y desviación máxima, sin suma
        // acumulada de giros.
        const direccionesClasificacion = puntosClasificacion.map(p => p.windFromDeg);
        mediaCircularClasificacion = promedioCircular(direccionesClasificacion);
        desviacionMaximaClasificacion = Math.max(
          ...direccionesClasificacion.map(g => diferenciaAngular(g, mediaCircularClasificacion))
        );
        clasificacion = desviacionMaximaClasificacion <= BRISA_RANGO_GRADOS ? "BRISA_ESTABLE" : "BRISA_CAMBIANTE";
      }
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
      rangoAprobado: BRISA_RANGO_APROBADO,
      velocidadMinimaDireccionConfiable: VELOCIDAD_MINIMA_DIRECCION_CONFIABLE
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
