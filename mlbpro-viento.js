/* ============================================================
   PRÓLOGO — mlbpro-viento.js
   ============================================================
   QUÉ ES:
     Fuente ÚNICA de: scoreMatch (similitud climática entre un juego
     de hoy y uno del histórico), y toda la lógica de "de dónde viene
     / hacia dónde va la brisa" y si favorece bateo o pitcheo.

   DE QUÉ DEPENDE:
     mlbpro-core.js (usa UMBRAL_OK/UMBRAL_MID indirectamente vía quien
       lo llama, no los lee directo).
     estadios.js — stadiumNorm() y stadiumCanonName() globales, usados
       por scoreMatch() para comparar el parque de hoy contra el del
       histórico de forma canónica e insensible a mayúsculas/minúsculas.
     window.MLBPRO_ROOF_STATUS (roof-status.js) — para saber si el
       parque tiene domo cerrado o techo no verificado antes de opinar
       sobre viento.
     getOrientacionParque() global (parques-orientacion.js) — para
       saber hacia dónde mira cada parque (hpACF).
     Los cuatro deben estar cargados ANTES de que se llamen estas
     funciones (no antes de que se DEFINA el archivo — las llamadas a
     esas dependencias están dentro de las funciones, se resuelven en
     tiempo de ejecución, no de carga).

   QUIÉN LO USA:
     index.html, viento-parque.html.

   CONVENCIÓN FÍSICA (confirmada con el usuario, NO cambiar sin decirle):
     windDir = grado de DÓNDE VIENE el viento (estándar meteorológico,
     así lo entrega Open-Meteo). Para saber hacia dónde VA, se suma 180°.
     hpACF = grado hacia donde mira el campo, de home plate al jardín
     central (viene de parques-orientacion.js).
     Si el viento VIENE del lado opuesto a hpACF → VA hacia el jardín
     central → saca la pelota → favorece BATEO.
     Si el viento VIENE del mismo lado que hpACF (desde el jardín) →
     VA hacia home → frena la pelota → favorece PICHEO.

   API (window.MLBPRO_VIENTO):
     scoreMatch(today, h) → number 0-100. today y h son objetos con
       {tempF, windMph, humidity, precip, venue, windDir,
       trayectoriaViento}. MISMA FIRMA Y MISMO FORMATO DE SALIDA que
       antes — index.html no necesita ningún cambio.
       ANTES de calcular cualquier punto de clima, se aplica el
       CANDADO DE TRAYECTORIA (ver más abajo). Si el candado no pasa,
       la función devuelve 0 de inmediato — el histórico queda fuera
       de los similares, no puede aparecer con 98/99/100%, y no se
       calcula ningún componente climático para él en esta llamada.
       Si el candado SÍ pasa, se calcula el score climático exactamente
       igual que antes (temperatura/viento/humedad/precipitación/
       parque/bearing-bonus), sin cambios en pesos ni umbrales. Cada
       componente sigue sumando solo cuando AMBOS lados traen ese valor
       como número real (esNumeroReal); si falta uno de los dos, ese
       componente no aporta nada (no se inventa 0 ni se fuerza NaN). La
       comparación de parque sigue usando
       stadiumNorm(stadiumCanonName(...)) en ambos lados.

     evaluarViento(windDir, hpACF) → {categoria, favoreceBateo, bearingDiff}
       SIN CAMBIOS en esta pasada.
       categoria: string para mostrar.
       favoreceBateo: true | false | null (null = neutral/cruzado o sin dato).
       Si windDir no es número real → "DIRECCIÓN NO CONFIRMADA".
       Si hpACF no es número real → "ORIENTACIÓN NO CONFIRMADA" (ya no
       se asume 45° por defecto).
       Usado por evaluarMercados() en index.html para decidir OVER/UNDER.

     tipoBrisa(today) → string. SIN CAMBIOS en esta pasada. today =
       {venue, windMph, windDir}.
       PRIMERO chequea roof-status.js (domo cerrado / techo no
       verificado) antes de mirar el viento — ese orden importa, no
       invertirlo. Si windMph no es número real → "VELOCIDAD NO
       CONFIRMADA" (ya no se asume 0 mph). Devuelve: "ROOF CERRADO" |
       "ROOF NO CONFIRMADO" | "VELOCIDAD NO CONFIRMADA" | "MUERTA" |
       "TURBULENTA" | "CRUZADA" | "DIRECTA" | variantes
       "/ DIRECCIÓN NO CONFIRMADA" | variantes
       "/ ORIENTACIÓN NO CONFIRMADA" (mismos umbrales de mph que las
       variantes de dirección, ya usados en el archivo: 12 y 7).

   CORRECCIÓN ACTUAL (esta sesión — candado de trayectoria de 7 puntos
   en scoreMatch, ÚNICO cambio de esta pasada):
     Antes, scoreMatch podía dar un score alto (incluso 98-100%) solo
     por temperatura/humedad/velocidad parecidas, aunque la dirección
     real del viento durante el juego fuera completamente distinta —
     porque el bonus de bearing (parque) es un componente más entre
     varios, no un filtro obligatorio. Ahora, ANTES de sumar cualquier
     punto climático, scoreMatch exige que el histórico pase este
     candado; si no lo pasa, devuelve 0 sin calcular nada más:

     1. Ambos juegos (today y h) deben tener trayectoriaViento con
        clasificación IGUAL exacta:
          BRISA_ESTABLE solo empareja con BRISA_ESTABLE.
          BRISA_CAMBIANTE solo empareja con BRISA_CAMBIANTE.
          DIRECCION_NO_CONFIABLE solo empareja con
          DIRECCION_NO_CONFIABLE.
        Si falta trayectoriaViento en cualquiera de los dos lados, o
        si las clasificaciones no coinciden exacto, el candado falla.
     2. Ambos juegos deben tener trayectoriaViento.puntos con los 7
        offsets EXACTOS [-2,-1,0,+1,+2,+3,+4], y cada uno de esos 7
        puntos debe traer windFromDeg y windMph como números reales
        (esNumeroReal) en AMBOS lados. Si falta cualquiera de los 7
        puntos, o cualquiera trae dirección o velocidad no numérica,
        la trayectoria se considera INCOMPLETA y el candado falla —
        nunca se rellena un punto faltante ni se asume un valor
        neutral.
     3. Con los 7 puntos completos de ambos lados, se compara PUNTO
        POR PUNTO (mismo offset contra mismo offset — esto ya
        garantiza, sin lógica adicional, que para BRISA_CAMBIANTE el
        recorrido completo se compare hora por hora y no solo el
        punto inicial):
          - diferencia CIRCULAR de dirección ≤ 5° (358° vs 2° = 4°,
            nunca 356° — se usa min(|a-b|, 360-|a-b|));
          - diferencia de velocidad ≤ 2 mph.
        Si UN SOLO punto de los 7 falla cualquiera de las dos
        condiciones, el candado falla para todo el histórico — no hay
        promedio ni tolerancia acumulada, es candado por punto.
     Si el candado pasa, el resto de scoreMatch (temperatura, viento
     puntual, humedad, precipitación, parque, bearing-bonus) se
     conserva EXACTAMENTE igual que antes de esta pasada — no se
     reemplazó la métrica climática, solo se le antepuso este filtro
     obligatorio.
     COMPATIBILIDAD: un histórico sin trayectoriaViento (o con
     trayectoria incompleta) queda EXCLUIDO de esta coincidencia por
     diseño — no se rompe nada del archivo, pero tampoco se inventa
     una compatibilidad neutral para él. Esto es intencional: la
     especificación pide excluir, no simular. Un juego de HOY sin
     trayectoriaViento tampoco puede emparejar con ningún histórico
     bajo este candado, por el mismo motivo.
     No se agregó ningún parámetro nuevo, no se cambió el nombre de
     ninguna función pública, no se tocó evaluarViento() ni
     tipoBrisa(). index.html no requiere ningún cambio.

   QUÉ TOCA:
     Nada de DOM ni localStorage. Puras funciones de cálculo.

   FECHA:
     22 jul 2026.

   ESTADO:
     Candado de trayectoria agregado y probado contra los 6 casos
     mínimos pedidos (270° vs 271° en los 7 puntos: pasa; 358° vs 2°:
     pasa por distancia circular de 4°; 270° vs 300° en un punto:
     fuera; BRISA_ESTABLE vs BRISA_CAMBIANTE: fuera; velocidad con
     más de 2 mph de diferencia en un punto: fuera; trayectoria
     incompleta: fuera). Pendiente de que Perez lo corra contra datos
     reales del histórico para confirmar que los similares que
     aparecen ahora en index.html ya no incluyen falsos positivos de
     dirección de viento.
   ============================================================ */

window.MLBPRO_VIENTO = (function () {

  // Valida que `v` sea un número real usable (no null, no undefined, no "").
  // Number(null) y Number("") dan 0, y Number.isFinite(0) es true — por eso
  // no basta con Number.isFinite(Number(v)): eso convertía silenciosamente
  // ausencia de dato en un 0 válido. Aquí se descartan null/undefined/""
  // ANTES de intentar convertir, así que un dato ausente nunca pasa como
  // número real.
  function esNumeroReal(v) {
    if (v === null || v === undefined || v === "") return false;
    if (typeof v === "boolean") return false;
    if (typeof v === "string" && v.trim() === "") return false;
    return Number.isFinite(Number(v));
  }

  // Diferencia circular en grados: 358 vs 2 -> 4, nunca 356.
  function diferenciaCircular(a, b) {
    let d = Math.abs(a - b) % 360;
    return d > 180 ? 360 - d : d;
  }

  // Offsets exactos que debe traer una trayectoria para contar como
  // "completa" para efectos de este candado.
  const OFFSETS_CANDADO = [-2, -1, 0, 1, 2, 3, 4];

  // Devuelve un Map(offset -> punto) SOLO si trayectoriaViento trae los
  // 7 offsets exactos, cada uno con windFromDeg y windMph como número
  // real. Si falta cualquiera, devuelve null (trayectoria incompleta,
  // nunca se rellena ni se asume un valor neutral).
  function trayectoriaCompleta(traj) {
    if (!traj || !Array.isArray(traj.puntos)) return null;

    const mapa = new Map();
    traj.puntos.forEach(p => {
      if (p && esNumeroReal(p.offsetHoras)) mapa.set(Number(p.offsetHoras), p);
    });

    for (const off of OFFSETS_CANDADO) {
      const p = mapa.get(off);
      if (!p || !esNumeroReal(p.windFromDeg) || !esNumeroReal(p.windMph)) return null;
    }

    return mapa;
  }

  // CANDADO DE TRAYECTORIA: ambos juegos deben tener trayectoria de 7
  // puntos completa, misma clasificación exacta, y cada uno de los 7
  // puntos dentro de ±5° circulares y ±2 mph. Un solo punto fuera de
  // tolerancia invalida el histórico completo — sin promedios.
  function trayectoriasCompatibles(today, h) {
    const trajToday = today && today.trayectoriaViento;
    const trajHist = h && h.trayectoriaViento;

    if (!trajToday || !trajHist) return false;
    if (!trajToday.clasificacion || trajToday.clasificacion !== trajHist.clasificacion) return false;

    const mapaToday = trayectoriaCompleta(trajToday);
    const mapaHist = trayectoriaCompleta(trajHist);
    if (!mapaToday || !mapaHist) return false;

    for (const off of OFFSETS_CANDADO) {
      const pToday = mapaToday.get(off);
      const pHist = mapaHist.get(off);

      const dirDiff = diferenciaCircular(Number(pToday.windFromDeg), Number(pHist.windFromDeg));
      if (dirDiff > 5) return false;

      const velDiff = Math.abs(Number(pToday.windMph) - Number(pHist.windMph));
      if (velDiff > 2) return false;
    }

    return true;
  }

  function scoreMatch(today, h) {
    // Candado obligatorio ANTES de cualquier cálculo climático. Si no
    // pasa, el histórico queda fuera: 0, sin excepción.
    if (!trayectoriasCompatibles(today, h)) return 0;

    let score = 0;

    if (esNumeroReal(today.tempF) && esNumeroReal(h.tempF)) {
      const todayTempF = Number(today.tempF);
      const histTempF = Number(h.tempF);
      score += Math.max(0, 30 - Math.abs(todayTempF - histTempF));
    }

    if (esNumeroReal(today.windMph) && esNumeroReal(h.windMph)) {
      const todayWindMph = Number(today.windMph);
      const histWindMph = Number(h.windMph);
      score += Math.max(0, 25 - (Math.abs(todayWindMph - histWindMph) * 2));
    }

    if (esNumeroReal(today.humidity) && esNumeroReal(h.humidity)) {
      const todayHumidity = Number(today.humidity);
      const histHumidity = Number(h.humidity);
      score += Math.max(0, 20 - (Math.abs(todayHumidity - histHumidity) / 3));
    }

    if (esNumeroReal(today.precip) && esNumeroReal(h.precip)) {
      const todayPrecip = Number(today.precip);
      const histPrecip = Number(h.precip);
      score += Math.max(0, 10 - (Math.abs(todayPrecip - histPrecip) * 10));
    }

    if (today.venue && h.venue &&
        stadiumNorm(stadiumCanonName(today.venue)) === stadiumNorm(stadiumCanonName(h.venue))) {
      score += 15;
    }

    if (esNumeroReal(today.windDir) && esNumeroReal(h.windDir)) {
      const td = Number(today.windDir);
      const hd = Number(h.windDir);

      let dd = Math.abs(td - hd);
      if (dd > 180) dd = 360 - dd;
      score += Math.max(0, 10 - (dd / 18));

      const hpACFraw = (typeof getOrientacionParque !== "undefined")
        ? getOrientacionParque(today.venue)
        : null;

      if (esNumeroReal(hpACFraw)) {
        const hpACF = Number(hpACFraw);
        const todayBearingDiff = Math.abs(((td - hpACF + 360) % 360) - 180);
        const histBearingDiff = Math.abs(((hd - hpACF + 360) % 360) - 180);

        if (Math.abs(todayBearingDiff - histBearingDiff) < 40) score += 5;
      }
    }

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  // Devuelve la categoría del viento respecto al parque, y si favorece
  // bateo (true), pitcheo (false), o es zona neutral/cruzada (null).
  // SIN CAMBIOS en esta pasada.
  function evaluarViento(windDir, hpACFraw) {
    if (!esNumeroReal(windDir)) {
      return { categoria: "DIRECCIÓN NO CONFIRMADA", favoreceBateo: null, bearingDiff: null };
    }

    if (!esNumeroReal(hpACFraw)) {
      return { categoria: "ORIENTACIÓN NO CONFIRMADA", favoreceBateo: null, bearingDiff: null };
    }

    const hpACF = Number(hpACFraw);
    const dir = Number(windDir);
    const opuesto = (hpACF + 180) % 360;
    let diff = Math.abs(dir - opuesto);
    if (diff > 180) diff = 360 - diff;

    if (diff <= 60) return { categoria: "SALE AL JARDÍN (FAVOR BATEO)", favoreceBateo: true, bearingDiff: diff };
    if (diff >= 120) return { categoria: "ENTRA A HOME (FAVOR PICHEO)", favoreceBateo: false, bearingDiff: diff };
    return { categoria: "NEUTRAL / CRUZADA", favoreceBateo: null, bearingDiff: diff };
  }

  // Clasificación de "tipo de brisa" para la tarjeta del juego de hoy.
  // SIN CAMBIOS en esta pasada.
  function tipoBrisa(today) {
    const venue = today?.venue;

    if (window.MLBPRO_ROOF_STATUS) {
      if (window.MLBPRO_ROOF_STATUS.esDomoCerradoFijo(venue)) return "ROOF CERRADO";
      if (window.MLBPRO_ROOF_STATUS.esTechoNoVerificado(venue)) return "ROOF NO CONFIRMADO";
    }

    if (!esNumeroReal(today?.windMph)) return "VELOCIDAD NO CONFIRMADA";
    const mph = Number(today.windMph);

    if (mph < 4) return "MUERTA";

    if (!esNumeroReal(today?.windDir)) {
      if (mph >= 12) return "TURBULENTA / DIRECCIÓN NO CONFIRMADA";
      if (mph >= 7) return "ACTIVA / DIRECCIÓN NO CONFIRMADA";
      return "MUERTA / DIRECCIÓN NO CONFIRMADA";
    }
    const dir = Number(today.windDir);

    if (mph >= 14) return "TURBULENTA";

    const hpACFraw = (typeof getOrientacionParque !== "undefined") ? getOrientacionParque(venue) : null;

    if (!esNumeroReal(hpACFraw)) {
      if (mph >= 12) return "TURBULENTA / ORIENTACIÓN NO CONFIRMADA";
      if (mph >= 7) return "ACTIVA / ORIENTACIÓN NO CONFIRMADA";
      return "MUERTA / ORIENTACIÓN NO CONFIRMADA";
    }
    const hpACF = Number(hpACFraw);

    const ev = evaluarViento(dir, hpACF);
    if (ev.categoria === "NEUTRAL / CRUZADA") return "CRUZADA";
    if (mph >= 8) return "DIRECTA";
    return "MUERTA";
  }

  return { scoreMatch, evaluarViento, tipoBrisa };
})();
