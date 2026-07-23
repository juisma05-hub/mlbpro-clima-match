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
       saber hacia dónde mira cada parque (hpACF). Se llama DOS veces
       por comparación cuando aplica: una para el parque de hoy y otra
       para el parque del histórico (pueden ser parques distintos).
       NO se llama en absoluto cuando la clasificación de trayectoria
       es DIRECCION_NO_CONFIABLE (ver CORRECCIÓN DE ESTA PASADA).
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
       antes.
       ANTES de calcular cualquier punto de clima, se aplica el
       CANDADO DE TRAYECTORIA (ver más abajo). Si el candado no pasa,
       la función devuelve 0 de inmediato — el histórico queda fuera
       de los similares, y no se calcula ningún componente climático
       para él en esta llamada.
       Si el candado SÍ pasa, se calcula el score climático exactamente
       igual que en la pasada anterior (temperatura/viento/humedad/
       precipitación/parque/bearing-bonus del windDir puntual), sin
       cambios en pesos ni umbrales. Cada componente sigue sumando
       solo cuando AMBOS lados traen ese valor como número real
       (esNumeroReal); si falta uno de los dos, ese componente no
       aporta nada. La comparación de parque sigue usando
       stadiumNorm(stadiumCanonName(...)) en ambos lados. Ese
       bearing-bonus del bloque de windDir puntual es un componente
       MÁS del score (no es el candado) y no se tocó en esta pasada.

     evaluarViento(windDir, hpACF) → {categoria, favoreceBateo, bearingDiff}
       SIN CAMBIOS en esta pasada.

     tipoBrisa(today) → string. SIN CAMBIOS en esta pasada.

   CORRECCIÓN DE ESTA PASADA (23 jul 2026) — EXCEPCIÓN PARA
   DIRECCION_NO_CONFIABLE EN trayectoriasCompatibles():

     Antes de esta pasada, trayectoriasCompatibles() aplicaba el MISMO
     candado angular (orientación de parque obligatoria + ángulo
     normalizado ±45°/±30°) a las tres clasificaciones posibles de
     trayectoriaViento.clasificacion: BRISA_ESTABLE, BRISA_CAMBIANTE, y
     DIRECCION_NO_CONFIABLE. Eso era incorrecto para el tercer caso:
     DIRECCION_NO_CONFIABLE significa, por definición, que la
     dirección de viento en esos 7 puntos NO es confiable. Exigir
     orientación de parque y comparar un ángulo normalizado calculado
     sobre una dirección que la propia trayectoria ya marcó como no
     confiable no aporta ninguna señal real, y en la práctica dejaba
     este caso en score 0 casi siempre — descartando de los similares
     históricos juegos que sí eran comparables en velocidad, solo
     porque su dirección (ya sabida como no confiable) no calzaba
     dentro de la tolerancia angular.

     AHORA trayectoriasCompatibles() separa el caso:
       - Si trajToday.clasificacion === "DIRECCION_NO_CONFIABLE" (y,
         por la verificación de clasificación idéntica que ya existía,
         trajHist.clasificacion también lo es): el candado se reduce a
           1. mismos 7 offsets completos, con windFromDeg y windMph
              numéricos en ambos lados (verificación ya existente,
              sin cambios — se sigue usando trayectoriaCompleta()).
           2. clasificación idéntica entre hoy e histórico
              (verificación ya existente, sin cambios).
           3. diferencia de windMph ≤ 2 mph en CADA uno de los 7
              puntos.
         NO se exige orientación de parque confirmada, NO se llama a
         getOrientacionParque() para ninguno de los dos lados, NO se
         calcula anguloRelativoParque(), y NO se compara dirDiff en
         absoluto para este caso. Si los 7 puntos cumplen la
         velocidad, el candado pasa.
       - Para BRISA_ESTABLE y BRISA_CAMBIANTE: el candado angular
         completo (orientación de parque obligatoria en ambos lados,
         ángulo normalizado firmado por parque propio, tolerancia
         ±45° cuando ambos ángulos están dentro del abanico de
         jardines o ±30° en cualquier otro caso, más velocidad ≤2 mph
         por punto) se conserva EXACTAMENTE igual que en la pasada
         anterior — ninguna línea de esa rama cambió.
     El resto de trayectoriasCompatibles() (validación de trajToday/
     trajHist presentes, clasificación idéntica, trayectoria completa
     en ambos lados) no cambió. scoreMatch(), evaluarViento(),
     tipoBrisa(), anguloRelativoParque(), diferenciaCircular(),
     esNumeroReal(), trayectoriaCompleta() no se tocaron. No se
     cambió ningún nombre público ni la firma de ninguna función. No
     se tocó ningún otro archivo.

   ESTADO ANTERIOR (pasadas previas, ya vigente y sin cambios en esta
   pasada): candado normalizado por parque para BRISA_ESTABLE y
   BRISA_CAMBIANTE, con ángulo firmado (conserva right/left) y
   abanico de jardines de 45° desde center, probado contra casos
   sintéticos: right (+35°) vs left (-35°) con misma magnitud pero
   distancia circular real de 70° (excluye correctamente); borde
   exacto del abanico en 45° (pasa); simetría confirmada (invertir el
   orden hoy/histórico da el mismo resultado); dos parques con hpACF
   distinto y mismo ángulo firmado (pasa); velocidad fuera de ±2 mph
   en un punto (excluye); clasificación distinta (excluye);
   trayectoria incompleta (excluye); orientación de parque no
   confirmada en cualquiera de los dos lados (excluye, solo aplica a
   BRISA_ESTABLE/BRISA_CAMBIANTE desde esta pasada).

   QUÉ TOCA:
     Nada de DOM ni localStorage. Puras funciones de cálculo.

   FECHA:
     23 jul 2026.

   ESTADO:
     Pendiente de que Perez lo corra contra datos reales del
     histórico, en particular juegos clasificados como
     DIRECCION_NO_CONFIABLE, para confirmar que ahora sí producen
     coincidencias por velocidad cuando corresponde.
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

  // Ángulo relativo FIRMADO de un punto respecto al hpACF de SU PROPIO
  // parque: 0° = viento saliendo derecho hacia center field de ESE
  // parque; valores POSITIVOS y NEGATIVOS representan lados distintos
  // del campo (right vs left) — NUNCA se pliega a magnitud 0-180°,
  // porque eso borraba la diferencia entre un viento hacia right-
  // center y uno hacia left-center (ambos daban la misma magnitud y
  // parecían el mismo viento, lo cual es físicamente falso). Rango de
  // salida: (-180, 180]. ±180 = viento entrando derecho hacia home.
  function anguloRelativoParque(windFromDeg, hpACF) {
    const opuesto = (hpACF + 180) % 360;
    return ((windFromDeg - opuesto + 540) % 360) - 180;
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
  // puntos completa y misma clasificación exacta.
  //
  // CASO DIRECCION_NO_CONFIABLE (esta pasada): la dirección de esos 7
  // puntos ya está marcada como no confiable por definición, así que
  // el candado NO exige orientación de parque ni compara ángulo — se
  // reduce a velocidad ≤ ±2 mph por punto.
  //
  // CASO BRISA_ESTABLE / BRISA_CAMBIANTE (sin cambios): orientación de
  // parque confirmada en AMBOS lados (pueden ser parques distintos),
  // cada uno de los 7 puntos normalizado según el hpACF de su propio
  // parque, comparado con tolerancia ±45° (zona jardines, según el
  // ángulo de HOY) o ±30° (zona home) más ±2 mph. Un solo punto fuera
  // de tolerancia invalida el histórico completo — sin promedios.
  function trayectoriasCompatibles(today, h) {
    const trajToday = today && today.trayectoriaViento;
    const trajHist = h && h.trayectoriaViento;

    if (!trajToday || !trajHist) return false;
    if (!trajToday.clasificacion || trajToday.clasificacion !== trajHist.clasificacion) return false;

    const mapaToday = trayectoriaCompleta(trajToday);
    const mapaHist = trayectoriaCompleta(trajHist);
    if (!mapaToday || !mapaHist) return false;

    // CASO ESPECIAL: DIRECCION_NO_CONFIABLE. La clasificación idéntica
    // ya se verificó arriba, así que si trajToday cae acá, trajHist
    // también. No se pide orientación del parque, no se calcula
    // anguloRelativoParque(), no se compara dirDiff — solo velocidad.
    if (trajToday.clasificacion === "DIRECCION_NO_CONFIABLE") {
      for (const off of OFFSETS_CANDADO) {
        const pToday = mapaToday.get(off);
        const pHist = mapaHist.get(off);

        const velDiff = Math.abs(Number(pToday.windMph) - Number(pHist.windMph));
        if (velDiff > 2) return false;
      }
      return true;
    }

    // BRISA_ESTABLE y BRISA_CAMBIANTE: candado angular completo, sin
    // cambios respecto a la pasada anterior.
    const hpACFTodayRaw = (typeof getOrientacionParque !== "undefined")
      ? getOrientacionParque(today.venue)
      : null;
    const hpACFHistRaw = (typeof getOrientacionParque !== "undefined")
      ? getOrientacionParque(h.venue)
      : null;

    if (!esNumeroReal(hpACFTodayRaw) || !esNumeroReal(hpACFHistRaw)) return false;

    const hpACFToday = Number(hpACFTodayRaw);
    const hpACFHist = Number(hpACFHistRaw);

    for (const off of OFFSETS_CANDADO) {
      const pToday = mapaToday.get(off);
      const pHist = mapaHist.get(off);

      const anguloToday = anguloRelativoParque(Number(pToday.windFromDeg), hpACFToday);
      const anguloHist = anguloRelativoParque(Number(pHist.windFromDeg), hpACFHist);

      // Abanico de jardines: hasta 45° circulares desde center field,
      // por CUALQUIERA de los dos lados (right o left) — |ángulo|<=45.
      // Fuera de eso es lateral (cruce de primera a tercera) u home.
      // La tolerancia de 45° SOLO aplica si AMBOS puntos (hoy Y el
      // histórico) caen dentro del abanico de jardines — si cualquiera
      // de los dos está fuera, se usa 30°. Esto hace el candado
      // SIMÉTRICO: invertir el orden de la comparación (hoy vs
      // histórico, o histórico vs hoy) da el mismo resultado, porque
      // ya no depende de la zona de un solo lado.
      const zonaTodayJardines = Math.abs(anguloToday) <= 45;
      const zonaHistJardines = Math.abs(anguloHist) <= 45;
      const toleranciaGrados = (zonaTodayJardines && zonaHistJardines) ? 45 : 30;

      // Comparación CIRCULAR sobre los ángulos ya firmados (conservan
      // lado): un viento a +35° (right-center) y uno a -35° (left-
      // center) dan una distancia circular real de 70°, no 0 — ya no
      // se confunden entre sí.
      const dirDiff = diferenciaCircular(anguloToday, anguloHist);
      if (dirDiff > toleranciaGrados) return false;

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

    // Bloque de dirección de viento puntual (windDir de hoy vs windDir
    // del histórico, aparte de los 7 puntos de trayectoria que ya
    // pasaron el candado arriba). Cada lado se normaliza con SU PROPIO
    // hpACF, usando la misma anguloRelativoParque() ya definida
    // arriba, y tanto los 10 puntos de dirección como el bonus de 5 se
    // calculan sobre esos dos ángulos normalizados. Si el hpACF de
    // cualquiera de los dos parques no es un número real, este
    // componente completo (10 + 5) no aporta nada — no se inventa una
    // orientación por defecto ni se vuelve a comparar en crudo como
    // respaldo. SIN CAMBIOS en esta pasada.
    if (esNumeroReal(today.windDir) && esNumeroReal(h.windDir)) {
      const hpACFTodayDirRaw = (typeof getOrientacionParque !== "undefined")
        ? getOrientacionParque(today.venue)
        : null;
      const hpACFHistDirRaw = (typeof getOrientacionParque !== "undefined")
        ? getOrientacionParque(h.venue)
        : null;

      if (esNumeroReal(hpACFTodayDirRaw) && esNumeroReal(hpACFHistDirRaw)) {
        const anguloTodayDir = anguloRelativoParque(Number(today.windDir), Number(hpACFTodayDirRaw));
        const anguloHistDir = anguloRelativoParque(Number(h.windDir), Number(hpACFHistDirRaw));

        // Comparación CIRCULAR sobre los ángulos firmados (misma
        // dirección relativa que conserva right/left): una resta
        // simple podría dar un valor erróneo en el borde (-179 vs 179
        // son 2° de distancia real, no 358).
        const dd = diferenciaCircular(anguloTodayDir, anguloHistDir);
        score += Math.max(0, 10 - (dd / 18));

        if (dd < 40) score += 5;
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
