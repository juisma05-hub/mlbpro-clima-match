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
       saber hacia dónde mira cada parque (hpACF). Se llama a lo sumo
       una vez por lado (hoy / histórico) dentro de evaluarTrayectoria()
       cuando la clasificación no es DIRECCION_NO_CONFIABLE, y otra vez
       en el bloque de dirección puntual de scoreMatch() (sin cambios).
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
       ANTES de calcular cualquier punto de clima, se evalúa la
       trayectoria con evaluarTrayectoria() (ver CORRECCIÓN DE ESTA
       PASADA). Si evalTraj.compatible es false, la función devuelve 0
       de inmediato — el histórico queda fuera de los similares. Si es
       true, se calcula el score climático EXACTAMENTE igual que en
       la pasada anterior al arreglo de trayectoria flexible: los
       mismos componentes (temperatura/viento/humedad/precipitación/
       parque/bearing-bonus del windDir puntual), los mismos pesos,
       los mismos umbrales. La evaluación de trayectoria funciona
       ÚNICAMENTE como candado de entrada (pasa o no pasa) — no aporta
       ni resta ningún punto al score. El máximo teórico del score es
       idéntico al del archivo original.

     evaluarViento(windDir, hpACF) → {categoria, favoreceBateo, bearingDiff}
       SIN CAMBIOS en esta pasada.

     tipoBrisa(today) → string. SIN CAMBIOS en esta pasada.

   CORRECCIÓN DE ESTA PASADA (27 jul 2026) — TRAYECTORIA FLEXIBLE
   POR COBERTURA PARCIAL:

     PROBLEMA: el candado anterior exigía los 7 offsets completos
     [-2,-1,0,+1,+2,+3,+4] con windFromDeg y windMph numéricos en
     AMBOS lados, y un solo punto fuera de tolerancia (velocidad o
     dirección) descartaba el histórico completo con score 0. En la
     práctica esto vaciaba Coincidencia casi siempre: bastaba con que
     faltara un dato horario o que un solo punto de 7 no calzara para
     perder un histórico que en el resto de sus puntos sí era
     comparable.

     AHORA el candado se reemplaza por evaluarTrayectoria(today, h),
     que:
       1. Ya NO exige los 7 offsets completos. Construye un mapa por
          lado con construirMapaTrayectoria(), que toma cada punto de
          trayectoriaViento.puntos que tenga offsetHoras y windMph
          como número real (esNumeroReal) — sin exigir windFromDeg en
          esta etapa, porque el caso DIRECCION_NO_CONFIABLE nunca lo
          necesita. No se inventa ni se rellena ningún punto faltante.
       2. Calcula los offsetsCompartidos = offsets presentes en AMBOS
          mapas (solo esos se comparan; los que solo tiene uno de los
          dos lados no participan).
       3. Exige cobertura mínima: si offsetsCompartidos.length < 4,
          devuelve estado "COBERTURA_INSUFICIENTE" y compatible=false
          — no hay suficiente base real para comparar, así que no se
          inventa una.
       4. Si trajToday.clasificacion es DIRECCION_NO_CONFIABLE (y por
          la verificación de clasificación idéntica, trajHist también
          lo es): NO exige orientación de parque, NO llama a
          getOrientacionParque(), NO calcula ángulo ni compara
          dirección — evalúa cada offset compartido solo por
          diferencia de windMph (≤2 mph = compatible en ese punto).
       5. Si es BRISA_ESTABLE o BRISA_CAMBIANTE: exige orientación de
          parque confirmada en AMBOS lados (si falta, estado
          "ORIENTACION_NO_CONFIRMADA", compatible=false — igual que
          antes, pero ahora evaluado una sola vez por comparación, no
          por punto). Para cada offset compartido que además traiga
          windFromDeg real en ambos lados, normaliza con
          anguloRelativoParque() (conserva right/left, SIN CAMBIOS),
          aplica la MISMA tolerancia que antes (45° si ambos ángulos
          caen en el abanico de jardines ±45°, si no 30°) más ≤2 mph,
          y cuenta ese punto como compatible o no. Un punto compartido
          sin windFromDeg real en algún lado cuenta como compartido
          pero NO como compatible (no se asume compatibilidad sin
          dato).
       6. YA NO descarta el histórico por un solo punto fuera de
          rango. En vez de eso, calcula
          proporcionCompatible = puntosCompatibles / puntosCompartidos
          y exige proporcionCompatible >= 0.6 (mayoría clara) para
          que compatible sea true. Esto es lo que reemplaza la regla
          "un punto malo tumba todo".
       7. Devuelve un objeto de evaluación completo — NO solo
          true/false — con: puntosCompartidos, puntosCompatibles,
          cobertura, proporcionCompatible, diferenciaPromedioVelocidad,
          estado ("SIN_TRAYECTORIA" | "CLASIFICACION_DISTINTA" |
          "COBERTURA_INSUFICIENTE" | "ORIENTACION_NO_CONFIRMADA" |
          "COMPATIBLE" | "INCOMPATIBLE") y compatible (boolean). Este
          objeto se usa SOLO para decidir compatible true/false dentro
          de scoreMatch() — sus campos numéricos (proporcionCompatible,
          diferenciaPromedioVelocidad, etc.) NO se suman al score ni
          modifican ningún peso existente.

     Los pesos y cálculos de temperatura, viento, humedad,
     precipitación, bonus de parque, y el bloque de dirección puntual
     (windDir de hoy vs windDir del histórico) NO se tocaron — son
     línea por línea los mismos que en el archivo original, y el
     máximo teórico de scoreMatch() (antes de Math.min(100, ...)) es
     el mismo que en el archivo original. anguloRelativoParque(),
     diferenciaCircular(), esNumeroReal(), evaluarViento(),
     tipoBrisa() no se tocaron. No se cambió ningún nombre público ni
     la firma de ninguna función pública. No se tocó ningún otro
     archivo.

     Las funciones trayectoriaCompleta() y trayectoriasCompatibles()
     de la pasada anterior se ELIMINARON (eran internas, no forman
     parte de la API pública) y se reemplazan por
     construirMapaTrayectoria() y evaluarTrayectoria().

   ESTADO ANTERIOR (pasada del 23 jul 2026, ahora reemplazado):
     candado rígido de 7 puntos completos, sin cobertura parcial, sin
     objeto de evaluación, un solo punto fuera de tolerancia
     descartaba el histórico completo.

   CORRECCIÓN SOBRE LA PASADA ANTERIOR (misma fecha, 27 jul 2026):
     La primera versión de este arreglo agregaba un bono no
     autorizado al score (score += proporcionCompatible * 10). Ese
     bono se ELIMINÓ por completo. evaluarTrayectoria() ahora se usa
     ÚNICAMENTE como candado de entrada — decide si el histórico se
     calcula o no, pero no aporta ni resta ningún punto al score.

   QUÉ TOCA:
     Nada de DOM ni localStorage. Puras funciones de cálculo.

   FECHA:
     27 jul 2026.

   ESTADO:
     Pendiente de que Perez lo corra contra datos reales del
     histórico para confirmar que Coincidencia vuelve a mostrar
     resultados con cobertura parcial de trayectoria, y que
     DIRECCION_NO_CONFIABLE ya no se descarta por falta de los 7
     puntos completos.
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

  // Offsets posibles de una trayectoria de 7 puntos. Ya NO se exige
  // que estén todos presentes — solo se usan los que sí existen en
  // ambos lados (offsetsCompartidos dentro de evaluarTrayectoria()).
  const OFFSETS_CANDADO = [-2, -1, 0, 1, 2, 3, 4];

  // Cobertura mínima real para poder comparar trayectorias, y
  // proporción mínima de puntos compartidos que deben salir
  // compatibles para que el histórico no se descarte. Esta pasada
  // reemplaza el candado rígido de "los 7 completos, un punto malo
  // tumba todo" por estos dos umbrales explícitos.
  const MIN_PUNTOS_COMPARTIDOS = 4;
  const MIN_PROPORCION_COMPATIBLE = 0.6;

  // Construye un Map(offset -> punto) con los puntos de
  // trayectoriaViento.puntos que traigan offsetHoras y windMph como
  // número real. NO exige windFromDeg aquí (eso se evalúa punto por
  // punto más abajo, solo cuando la clasificación lo requiere). NO se
  // rellena ni se inventa ningún offset faltante.
  function construirMapaTrayectoria(traj) {
    const mapa = new Map();
    if (!traj || !Array.isArray(traj.puntos)) return mapa;

    traj.puntos.forEach(p => {
      if (p && esNumeroReal(p.offsetHoras) && esNumeroReal(p.windMph)) {
        mapa.set(Number(p.offsetHoras), p);
      }
    });

    return mapa;
  }

  // Evalúa la compatibilidad de trayectoria entre hoy y un histórico.
  // Devuelve un objeto de evaluación completo (no solo true/false):
  //   { puntosCompartidos, puntosCompatibles, cobertura,
  //     proporcionCompatible, diferenciaPromedioVelocidad, estado,
  //     compatible }
  // Este objeto se usa SOLO como candado de entrada en scoreMatch()
  // (evalTraj.compatible). Sus campos numéricos no se suman al score.
  //
  // CASO DIRECCION_NO_CONFIABLE: solo compara velocidad (≤2 mph) en
  // los offsets compartidos. No exige orientación de parque, no
  // calcula ángulo, no compara dirección.
  //
  // CASO BRISA_ESTABLE / BRISA_CAMBIANTE: exige orientación de parque
  // confirmada en ambos lados (una sola vez, no por punto). Cada
  // offset compartido que además tenga windFromDeg real en ambos
  // lados se normaliza con anguloRelativoParque() y se compara con la
  // MISMA tolerancia que antes (45°/30° según abanico de jardines,
  // más ≤2 mph). Un offset sin windFromDeg real cuenta como
  // compartido pero no como compatible.
  //
  // En ambos casos: ya no basta un solo punto fuera de rango para
  // descartar el histórico. Se exige cobertura mínima
  // (MIN_PUNTOS_COMPARTIDOS) y una proporción mínima de puntos
  // compatibles (MIN_PROPORCION_COMPATIBLE).
  function evaluarTrayectoria(today, h) {
    const trajToday = today && today.trayectoriaViento;
    const trajHist = h && h.trayectoriaViento;

    const base = {
      puntosCompartidos: 0,
      puntosCompatibles: 0,
      cobertura: 0,
      proporcionCompatible: 0,
      diferenciaPromedioVelocidad: null,
      estado: "SIN_TRAYECTORIA",
      compatible: false
    };

    if (!trajToday || !trajHist) return base;

    if (!trajToday.clasificacion || trajToday.clasificacion !== trajHist.clasificacion) {
      return { ...base, estado: "CLASIFICACION_DISTINTA" };
    }

    const mapaToday = construirMapaTrayectoria(trajToday);
    const mapaHist = construirMapaTrayectoria(trajHist);

    const offsetsCompartidos = OFFSETS_CANDADO.filter(
      off => mapaToday.has(off) && mapaHist.has(off)
    );

    if (offsetsCompartidos.length < MIN_PUNTOS_COMPARTIDOS) {
      return {
        ...base,
        puntosCompartidos: offsetsCompartidos.length,
        cobertura: offsetsCompartidos.length,
        estado: "COBERTURA_INSUFICIENTE"
      };
    }

    const esNoConfiable = trajToday.clasificacion === "DIRECCION_NO_CONFIABLE";

    let hpACFToday = null;
    let hpACFHist = null;

    if (!esNoConfiable) {
      const hpACFTodayRaw = (typeof getOrientacionParque !== "undefined")
        ? getOrientacionParque(today.venue)
        : null;
      const hpACFHistRaw = (typeof getOrientacionParque !== "undefined")
        ? getOrientacionParque(h.venue)
        : null;

      if (!esNumeroReal(hpACFTodayRaw) || !esNumeroReal(hpACFHistRaw)) {
        return {
          ...base,
          puntosCompartidos: offsetsCompartidos.length,
          cobertura: offsetsCompartidos.length,
          estado: "ORIENTACION_NO_CONFIRMADA"
        };
      }

      hpACFToday = Number(hpACFTodayRaw);
      hpACFHist = Number(hpACFHistRaw);
    }

    let puntosCompatibles = 0;
    let sumaDiferenciaVelocidad = 0;

    offsetsCompartidos.forEach(off => {
      const pToday = mapaToday.get(off);
      const pHist = mapaHist.get(off);

      const velDiff = Math.abs(Number(pToday.windMph) - Number(pHist.windMph));
      sumaDiferenciaVelocidad += velDiff;

      if (esNoConfiable) {
        if (velDiff <= 2) puntosCompatibles++;
        return;
      }

      // BRISA_ESTABLE / BRISA_CAMBIANTE: sin windFromDeg real en
      // ambos lados de este punto, no se puede evaluar dirección —
      // cuenta como compartido pero no como compatible.
      if (!esNumeroReal(pToday.windFromDeg) || !esNumeroReal(pHist.windFromDeg)) return;

      const anguloToday = anguloRelativoParque(Number(pToday.windFromDeg), hpACFToday);
      const anguloHist = anguloRelativoParque(Number(pHist.windFromDeg), hpACFHist);

      // Abanico de jardines: hasta 45° circulares desde center field,
      // por CUALQUIERA de los dos lados. La tolerancia de 45° SOLO
      // aplica si AMBOS puntos caen dentro del abanico; si no, 30°.
      // SIN CAMBIOS respecto a la pasada anterior.
      const zonaTodayJardines = Math.abs(anguloToday) <= 45;
      const zonaHistJardines = Math.abs(anguloHist) <= 45;
      const toleranciaGrados = (zonaTodayJardines && zonaHistJardines) ? 45 : 30;

      const dirDiff = diferenciaCircular(anguloToday, anguloHist);

      if (dirDiff <= toleranciaGrados && velDiff <= 2) puntosCompatibles++;
    });

    const proporcionCompatible = puntosCompatibles / offsetsCompartidos.length;
    const diferenciaPromedioVelocidad = sumaDiferenciaVelocidad / offsetsCompartidos.length;
    const compatible = proporcionCompatible >= MIN_PROPORCION_COMPATIBLE;

    return {
      puntosCompartidos: offsetsCompartidos.length,
      puntosCompatibles,
      cobertura: offsetsCompartidos.length,
      proporcionCompatible,
      diferenciaPromedioVelocidad,
      estado: compatible ? "COMPATIBLE" : "INCOMPATIBLE",
      compatible
    };
  }

  function scoreMatch(today, h) {
    // Evaluación de trayectoria (reemplaza el candado rígido anterior).
    // Funciona ÚNICAMENTE como candado de entrada: si no es
    // compatible (cobertura insuficiente, orientación no confirmada
    // cuando se requiere, clasificación distinta, o proporción de
    // puntos compatibles por debajo del mínimo), el histórico queda
    // fuera: 0, sin excepción. No aporta ningún punto al score.
    const evalTraj = evaluarTrayectoria(today, h);
    if (!evalTraj.compatible) return 0;

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
    // del histórico, aparte de los offsets de trayectoria evaluados
    // arriba). SIN CAMBIOS en esta pasada.
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
