/* ============================================================
   PRÓLOGO — mlbpro-core.js
   ============================================================
   QUÉ ES:
     Fuente ÚNICA de verdad para fecha/hora en zona horaria de MLB,
     rutas de API (MLB Stats API + Open-Meteo vía proxy), fetch
     helpers, umbrales de coincidencia, el gate de "juego Final" para
     el histórico, la trayectoria de viento de 7 horas por juego
     histórico, y el equivalente de pronóstico (juegos de hoy/futuros)
     para clima puntual y trayectoria de viento.

   DE QUÉ DEPENDE:
     estadios.js debe cargarse ANTES (stadiumGet().timezone).

   ESTADO VIGENTE DE MLBPRO CLIMA MATCH (21 jul 2026):
     Histórico reconstruido y CERRADO/APROBADO: 1,511 filas.
       - 1,511/1,511 filas con trayectoriaViento (0 null, 0 filas
         antiguas sin el campo).
       - Los 7 puntos exactos [-2,-1,0,+1,+2,+3,+4] confirmados en las
         1,511 filas, con fechaLocalUsada, claveLocalUsada y
         direccionConfiable completos en cada punto — auditados en
         auditar-trayectoria-historico.html.
       - Clasificación real sobre las 1,511 filas:
           911 BRISA_ESTABLE
           207 BRISA_CAMBIANTE
           393 DIRECCION_NO_CONFIABLE
             0 NO_CONFIRMADO
       - Zonas horarias, claves locales y cruces de fecha revisados y
         funcionando (incluye America/Toronto agrupado con ET en las
         pruebas cortas).
       - index.html actual, el histórico y auditar-trayectoria-
         historico.html están funcionando de forma coherente entre sí.
     BRISA_RANGO_GRADOS = 30 queda como regla VIGENTE Y APROBADA de
     clasificación — el histórico completo de 1,511 filas ya se cerró
     y aprobó con este rango, así que BRISA_RANGO_APROBADO = true en
     el código (corregido en esta pasada: antes decía false, lo cual
     contradecía el propio estado ya cerrado del histórico).

   API (window.MLBPRO_CORE):

     hoyISO() / ayerISO() / addDays() / horaETNumero() / horaJuego() /
     viaProxy() / fetchJSON() / scheduleByDate() / getVenueFull() /
     coordsFromVenue() / getClimaActual() / getClimaHistorico() /
     getTrayectoriaVientoHistorico() / getBoxScore() / esJuegoFinal() /
     guardarHistoricoCache() / leerHistoricoCache() /
     borrarHistoricoCache() → SIN CAMBIOS respecto al histórico ya
     aprobado. Ni una línea tocada.

     getClimaPronosticoJuego(lat, lon, gameDate, venueNombre)
       → Promise<clima|null>. Equivalente de getClimaHistorico() para
       juegos de HOY o futuros: usa el endpoint de PRONÓSTICO de
       Open-Meteo (api.open-meteo.com/v1/forecast), no el de archivo.
       Resuelve el timezone real del parque vía
       stadiumGet(venueNombre) — null si no se confirma. Calcula fecha
       y hora local real del parque a partir de gameDate (fechaEnZona()
       + horaEnZona(), mismo patrón que getClimaHistorico()), busca el
       punto horario más cercano dentro de la respuesta de pronóstico,
       y valida cada valor con numeroRealOClima() — nunca Number()
       directo. windMph y windDir son obligatorios: si cualquiera sale
       null, la función completa devuelve null. Mismo shape que
       getClimaHistorico(): {tempF, humidity, precip, windMph, windDir,
       timezoneUsado, horaLocalObjetivo, horaClimaUtilizada}.

     getTrayectoriaVientoPronostico(lat, lon, gameDate, venueNombre)
       → Promise<trayectoria|null>. Equivalente de
       getTrayectoriaVientoHistorico() contra el endpoint de
       PRONÓSTICO en vez del de archivo. MISMO CONTRATO EXACTO: los 7
       offsets (OFFSETS_TRAYECTORIA = [-2,-1,0,1,2,3,4]), el mismo
       subconjunto de clasificación (OFFSETS_CLASIFICACION =
       [0,1,2,3,4]), los mismos campos por punto (offsetHoras,
       horaLocalUsada, fechaLocalUsada, claveLocalUsada, windFromDeg,
       windToDeg, windMph, direccionConfiable), el mismo resumen
       (direccionInicio del offset 0, direccionFinal del offset +4,
       velocidadMin/Max/Prom), y la MISMA clasificación de 3 pasos
       (NO_CONFIRMADO si falta cualquier dato en los 5 puntos de juego;
       DIRECCION_NO_CONFIABLE si alguno tiene windMph <
       VELOCIDAD_MINIMA_DIRECCION_CONFIABLE; BRISA_ESTABLE/
       BRISA_CAMBIANTE con media circular + desviación máxima, sin
       suma acumulada de giros, contra BRISA_RANGO_GRADOS) —
       REPRODUCIENDO EXACTAMENTE LA MISMA LÓGICA DE CÁLCULO,
       CONSTANTES, CAMPOS Y CONTRATO DE LA VERSIÓN HISTÓRICA (esta
       función SÍ repite la estructura completa del cuerpo de
       getTrayectoriaVientoHistorico() — la única diferencia real es
       la URL del fetch, forecast en vez de archive; las constantes
       compartidas, como OFFSETS_TRAYECTORIA/OFFSETS_CLASIFICACION/
       BRISA_RANGO_GRADOS/VELOCIDAD_MINIMA_DIRECCION_CONFIABLE, y las
       funciones puramente matemáticas, como promedioCircular/
       diferenciaAngular/numeroRealOClima/fechaEnZona/horaEnZona, sí
       se reutilizan sin duplicar). Devuelve null si falta
       venueNombre/timezone confirmado, o si gameDate falta/es
       inválido. Ningún dato faltante se convierte en 0.

   QUÉ TOCA:
     localStorage, SOLO vía guardarHistoricoCache()/leerHistoricoCache()/
     borrarHistoricoCache(). Las dos funciones de pronóstico son de
     SOLO LECTURA (fetch a Open-Meteo), no tocan localStorage.

   NO TOCADO EN NINGUNA PASADA RECIENTE:
     jalarJuegosHoy(), Coincidencia (calcularCoincidencia,
     generarConclusionCoincidencia, evaluarMercados, renderBrujula),
     index.html, el histórico ya aprobado, K6, F5, MoneyLine,
     Over/Under, Aladino, ni ningún otro archivo del proyecto.

   HISTORIAL DE CORRECCIONES (21 jul 2026):
   1) Zona horaria real por parque en getClimaHistorico().
   2) Fecha local del parque + validación numérica real en
      getClimaHistorico().
   3) Trayectoria de viento de 7 horas (getTrayectoriaVientoHistorico),
      función nueva.
   4) Clasificación restringida a offsets 0,+1,+2,+3,+4; direccionInicio
      corregido a offset 0.
   5) fechaLocalUsada y claveLocalUsada agregados a cada punto.
   6) Viento casi calmo: direccionConfiable por punto y el estado
      DIRECCION_NO_CONFIABLE, regla de 3 pasos (umbral: 3 mph).
   7) Histórico reconstruido, auditado y CERRADO: 1,511 filas,
      1,511/1,511 con trayectoriaViento, clasificación real (911
      ESTABLE / 207 CAMBIANTE / 393 NO_CONFIABLE / 0 NO_CONFIRMADO).
   8) Pronóstico para juegos de hoy/futuros: getClimaPronosticoJuego()
      y getTrayectoriaVientoPronostico(), mismo contrato que sus
      equivalentes históricos. NO conectadas todavía a jalarJuegosHoy()
      ni a Coincidencia.
   9) ESTA PASADA — dos correcciones puntuales:
      - BRISA_RANGO_APROBADO cambiado de false a true: el rango de 30°
        ya está vigente y aprobado con el histórico cerrado de 1,511
        filas, así que el código ya no puede seguir devolviendo
        rangoAprobado:false en cada trayectoria.
      - Corregida la afirmación falsa del prólogo anterior ("sin
        duplicar ninguna lógica de cálculo"): getTrayectoriaVientoPronostico()
        SÍ reproduce la estructura completa de la función histórica —
        el prólogo ahora lo dice explícitamente en vez de negarlo.
      Ninguna otra línea de lógica se tocó.

   ESTADO FINAL DE ESTA PASADA:
     - Histórico de 1,511 filas: CERRADO Y APROBADO.
     - BRISA_RANGO_GRADOS = 30: VIGENTE Y APROBADO (rangoAprobado:true).
     - getClimaPronosticoJuego() y getTrayectoriaVientoPronostico():
       IMPLEMENTADAS, pero PENDIENTES DE PRUEBA REAL contra la API de
       pronóstico de Open-Meteo — no se han ejecutado todavía en el
       navegador.
     - Próximo paso: crear una prueba corta (de solo lectura, sin
       tocar jalarJuegosHoy() ni Coincidencia) que confirme estas dos
       funciones contra un juego de hoy o futuro en cada una de 4
       zonas horarias: Este, Central, Phoenix/Mountain y Pacífico.
     - Solo después de que esa prueba corta quede aprobada se
       conectarán estas funciones a jalarJuegosHoy().
     - Coincidencia (calcularCoincidencia, generarConclusionCoincidencia,
       evaluarMercados, renderBrujula) todavía NO se toca.

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
  const BRISA_RANGO_APROBADO = true;

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

    let clasificacion = "NO_CONFIRMADO";
    let mediaCircularClasificacion = null;
    let desviacionMaximaClasificacion = null;

    const datosCompletos = puntosClasificacion.every(p => p.windFromDeg !== null && p.windMph !== null);

    if (datosCompletos) {
      const todosConfiables = puntosClasificacion.every(p => p.windMph >= VELOCIDAD_MINIMA_DIRECCION_CONFIABLE);

      if (!todosConfiables) {
        clasificacion = "DIRECCION_NO_CONFIABLE";
      } else {
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

  async function getClimaPronosticoJuego(lat, lon, gameDate, venueNombre) {
    const stadium = (typeof stadiumGet === "function") ? stadiumGet(venueNombre) : null;
    const tzParque = stadium && stadium.timezone ? stadium.timezone : null;

    if (!tzParque) return null;

    if (!gameDate) return null;
    const dGame = new Date(gameDate);
    if (isNaN(dGame.getTime())) return null;

    const fechaLocalJuego = fechaEnZona(dGame, tzParque);
    const targetHour = horaEnZona(dGame, tzParque);

    const url =
      "https://api.open-meteo.com/v1/forecast" +
      `?latitude=${lat}&longitude=${lon}` +
      `&start_date=${fechaLocalJuego}&end_date=${fechaLocalJuego}` +
      "&hourly=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,wind_direction_10m" +
      `&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=${encodeURIComponent(tzParque)}`;
    const j = await fetchJSON(url);
    const h = j.hourly || {};
    const times = h.time || [];
    if (!times.length) return null;

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

  async function getTrayectoriaVientoPronostico(lat, lon, gameDate, venueNombre) {
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
      "https://api.open-meteo.com/v1/forecast" +
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

    let clasificacion = "NO_CONFIRMADO";
    let mediaCircularClasificacion = null;
    let desviacionMaximaClasificacion = null;

    const datosCompletos = puntosClasificacion.every(p => p.windFromDeg !== null && p.windMph !== null);

    if (datosCompletos) {
      const todosConfiables = puntosClasificacion.every(p => p.windMph >= VELOCIDAD_MINIMA_DIRECCION_CONFIABLE);

      if (!todosConfiables) {
        clasificacion = "DIRECCION_NO_CONFIABLE";
      } else {
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
    getClimaPronosticoJuego, getTrayectoriaVientoPronostico,
    getBoxScore, esJuegoFinal,
    guardarHistoricoCache, leerHistoricoCache, borrarHistoricoCache
  };
})();
