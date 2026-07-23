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
       saber hacia dónde mira cada parque (hpACF). AHORA se llama DOS
       veces por comparación: una para el parque de hoy y otra para
       el parque del histórico (pueden ser parques distintos).
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
       CANDADO DE TRAYECTORIA NORMALIZADA (ver más abajo). Si el
       candado no pasa, la función devuelve 0 de inmediato — el
       histórico queda fuera de los similares, no puede aparecer con
       98/99/100%, y no se calcula ningún componente climático para
       él en esta llamada.
       Si el candado SÍ pasa, se calcula el score climático exactamente
       igual que antes (temperatura/viento/humedad/precipitación/
       parque/bearing-bonus del windDir puntual), sin cambios en pesos
       ni umbrales. Cada componente sigue sumando solo cuando AMBOS
       lados traen ese valor como número real (esNumeroReal); si falta
       uno de los dos, ese componente no aporta nada. La comparación
       de parque sigue usando stadiumNorm(stadiumCanonName(...)) en
       ambos lados. Ese bearing-bonus del bloque de windDir puntual es
       un componente MÁS del score (no es el candado) y no se tocó en
       esta pasada.

     evaluarViento(windDir, hpACF) → {categoria, favoreceBateo, bearingDiff}
       SIN CAMBIOS en esta pasada.

     tipoBrisa(today) → string. SIN CAMBIOS en esta pasada.

   CORRECCIÓN ACTUAL (esta sesión — REDISEÑO COMPLETO del candado de
   trayectoria, reemplaza el candado de ±5° circular fijo de la pasada
   anterior; no es solo ampliar el número):

     El candado anterior comparaba los 7 puntos de windFromDeg como
     grados de compás CRUDOS, con una tolerancia fija de ±5° para
     todos los casos. Eso tiene un problema real: dos parques con
     orientación física distinta (hpACF distinto) pueden tener el
     MISMO viento relativo al jardín/home (ej. "sale directo al
     jardín central" en ambos) con grados de compás crudos totalmente
     distintos — el candado anterior los habría descartado por error.
     También trataba igual un desvío hacia los jardines que un desvío
     hacia home, cuando físicamente no pesan igual (el viento que
     entra hacia home es más sensible a un pequeño cambio de grado que
     el que sale hacia jardines, por cómo se dispersa el aire en un
     estadio abierto).

     AHORA, para cada uno de los 7 puntos [-2,-1,0,+1,+2,+3,+4], en
     AMBOS juegos por separado:
       1. Se resuelve hpACF del parque de HOY (getOrientacionParque
          (today.venue)) y, por separado, hpACF del parque del
          HISTÓRICO (getOrientacionParque(h.venue)) — dos llamadas,
          un parque puede no ser el mismo que el otro. Si CUALQUIERA
          de los dos no es un número real (orientación no confirmada
          para ese parque), el candado falla para todo el histórico —
          nunca se asume una orientación por defecto.
       2. Se NORMALIZA la dirección de cada punto respecto al hpACF de
          SU PROPIO parque, con la misma fórmula ya usada en
          evaluarViento(): opuesto = (hpACF + 180) % 360; ángulo
          normalizado = diferencia CIRCULAR entre windFromDeg del
          punto y ese opuesto. Este ángulo normalizado va de 0° a
          180°: 0° = viento saliendo derecho hacia el jardín central
          de ESE parque (favor bateo pleno); 180° = viento entrando
          derecho hacia home de ESE parque (favor pitcheo pleno). Esto
          pone a los dos juegos en la MISMA escala relativa al campo,
          sin importar hacia qué punto cardinal absoluto mire cada
          estadio.
       3. Se comparan los DOS ángulos normalizados de ese punto (el de
          hoy contra el del histórico) con una tolerancia que depende
          de la ZONA del punto de HOY:
            - Si el ángulo normalizado de HOY es ≤ 60° (abanico de
              salida hacia jardines: de primera, pasando por right-
              center-left, hasta tercera): tolerancia ±45°.
            - Si el ángulo normalizado de HOY es > 60° (esto incluye
              TANTO el viento lateral que cruza de primera a tercera
              por delante de home, como el viento que entra derecho
              hacia home): tolerancia ±30°.
          DECISIÓN DE DISEÑO EXPLÍCITA: el corte de 60° NO es un
          número nuevo inventado para este candado — es el mismo
          umbral que evaluarViento() ya usa en este archivo para
          decidir "SALE AL JARDÍN (FAVOR BATEO)" (diff<=60). Se
          reutiliza aquí para no introducir un límite arbitrario
          adicional. CORRECCIÓN sobre un intento anterior de esta
          misma sesión: un corte binario en 90° metía el viento
          lateral (perpendicular, cruzando de primera a tercera) en
          el grupo de 45° junto con jardines — error real, porque
          Perez especificó que SOLO el abanico que apunta al outfield
          usa 45°, y todo lo demás —incluyendo el lateral— usa 30°.
          Si Perez prefiere otro grado exacto para el borde del
          abanico de jardines (distinto de 60°), hay que decirlo
          explícitamente y se ajusta.
       4. Se mantiene, sin cambios, la comparación de velocidad: la
          diferencia de windMph de ese punto entre hoy y el histórico
          debe ser ≤ 2 mph.
       5. Se mantiene, sin cambios, que ambos juegos deben tener
          trayectoriaViento.clasificacion IDÉNTICA (BRISA_ESTABLE con
          BRISA_ESTABLE, BRISA_CAMBIANTE con BRISA_CAMBIANTE,
          DIRECCION_NO_CONFIABLE con DIRECCION_NO_CONFIABLE), y que
          ambos traigan los 7 puntos completos con windFromDeg y
          windMph numéricos — una trayectoria incompleta excluye el
          histórico igual que antes.
     Si UN SOLO punto de los 7 falla el ángulo normalizado (fuera de
     ±45°/±30° según su zona) o la velocidad (fuera de ±2 mph), el
     candado falla para TODO el histórico — sin promedio, sin
     tolerancia acumulada, candado por punto, exactamente como en la
     pasada anterior.
     Si el candado pasa, el resto de scoreMatch (temperatura, viento
     puntual, humedad, precipitación, parque, bearing-bonus) se
     conserva EXACTAMENTE igual que en la pasada anterior — no se
     tocó esa parte.
     COMPATIBILIDAD: un histórico sin trayectoriaViento, con
     trayectoria incompleta, o cuyo parque (o el de hoy) no tenga
     orientación confirmada, queda EXCLUIDO de esta coincidencia por
     diseño — no se rompe nada del archivo, no se inventa una
     compatibilidad neutral. No se agregó ningún parámetro nuevo a
     scoreMatch, no se cambió ningún nombre público, no se tocó
     evaluarViento() ni tipoBrisa(). index.html no requiere cambio.
     No se tocó mlbpro-core.js, index.html, ni ninguna caché o
     histórico — solo este archivo.

   CORRECCIÓN DE SEGUIMIENTO (misma sesión, sobre el bloque final de
   windDir puntual dentro de scoreMatch, DESPUÉS del candado de 7
   puntos): el candado de trayectoria ya normalizaba correctamente
   cada lado con su propio hpACF, pero el bloque final que compara
   today.windDir contra h.windDir (los 10 puntos de dirección + el
   bonus de 5 del bearing) seguía comparando grados de compás CRUDOS
   entre sí, y además usaba el hpACF del parque de HOY para
   interpretar tanto el viento de hoy como el del histórico. Efecto
   real: dos vientos físicamente idénticos (misma relación con su
   propio jardín/home) en parques con orientación distinta pasaban el
   candado de 7 puntos correctamente, pero luego este bloque les
   restaba puntos de todas formas — el mismo error que ya se había
   corregido arriba, pero que seguía vivo aquí.
   Corregido: ahora se resuelve hpACF de today.venue y hpACF de
   h.venue POR SEPARADO, cada dirección puntual se normaliza con
   anguloRelativoParque() usando el hpACF de SU PROPIO parque (nunca
   el hpACF de hoy para interpretar el histórico), y tanto los 10
   puntos de dirección como el bonus de 5 se calculan sobre esos dos
   ángulos normalizados. Si el hpACF de cualquiera de los dos parques
   no es número real, este componente completo (10 + 5) no aporta
   nada — antes, el bloque de 10 puntos se calculaba igual aunque no
   hubiera hpACF disponible; ahora depende de que ambos hpACF existan,
   porque ya no hay forma honesta de normalizar sin ellos.

   SEGUNDA CORRECCIÓN DE SEGUIMIENTO (misma sesión — dos fallos reales
   señalados por Perez sobre la normalización y el candado, corregidos
   juntos):

   1. EL LÍMITE DEL ABANICO DE JARDINES ERA 60°, DEBÍA SER 45°: el
      terreno bueno desde primera hasta tercera abre ~90° completos
      (primera = -45° relativo a center, tercera = +45°), así que el
      abanico de jardines es hasta 45° desde center por cualquier
      lado — no 60°. El 60° reutilizado de evaluarViento() en la
      pasada anterior no correspondía a esta geometría; era una
      reutilización de un umbral pensado para otro propósito
      (categorizar "favor bateo" en evaluarViento, no delimitar el
      abanico físico de jardines aquí). Corregido a 45°.

   2. anguloRelativoParque() BORRABA LA DIFERENCIA ENTRE RIGHT Y LEFT:
      la versión anterior devolvía una MAGNITUD plegada de 0° a 180°
      (vía diferenciaCircular contra el opuesto), lo cual hacía que un
      viento a 35° hacia right-center y uno a 35° hacia left-center
      dieran EXACTAMENTE el mismo valor (35), como si fueran el mismo
      viento — físicamente falso, son direcciones distintas. Corregido:
      anguloRelativoParque() ahora devuelve un ángulo FIRMADO en rango
      (-180, 180], que conserva de qué lado del campo viene el viento
      (positivo de un lado, negativo del otro). La comparación entre
      dos ángulos firmados usa diferenciaCircular() (ya existente) para
      seguir siendo circular y correcta en los bordes (-179 vs 179 =
      2°, no 358°). Con esta corrección, un viento a +35° y uno a -35°
      dan una distancia circular real de 70° — ya no se confunden.

   Como consecuencia de conservar el signo, el candado de zona también
   se corrigió para no depender de un solo lado de la comparación:
   ahora la tolerancia de 45° SOLO se aplica cuando AMBOS ángulos (el
   de hoy Y el del histórico) tienen magnitud ≤45° (ambos dentro del
   abanico de jardines); si cualquiera de los dos está fuera de ese
   abanico —incluyendo el lateral que cruza de primera a tercera y la
   entrada directa a home— se usa 30°. Esto hace el candado SIMÉTRICO:
   invertir el orden de la comparación (hoy vs histórico, o histórico
   vs hoy) da exactamente el mismo resultado — antes, con la zona
   decidida solo por el ángulo de hoy, una comparación podía pasar en
   un sentido y fallar al invertir los juegos, lo cual era un error
   real de asimetría.
   El mismo ángulo relativo firmado se aplicó también al bloque final
   de windDir puntual (comparación circular sobre los ángulos
   firmados, en vez de resta simple sobre valores plegados).
   No se tocó ningún otro archivo. No se cambió ningún nombre público,
   ni la firma de scoreMatch, ni evaluarViento(), ni tipoBrisa().

   QUÉ TOCA:
     Nada de DOM ni localStorage. Puras funciones de cálculo.

   FECHA:
     23 jul 2026.

   ESTADO:
     Candado normalizado por parque, con ángulo firmado (conserva
     right/left) y abanico de jardines de 45° desde center, probado
     contra casos sintéticos: right (+35°) vs left (-35°) con misma
     magnitud pero distancia circular real de 70° (debe excluir, ya
     no se confunden); borde exacto del abanico en 45° (debe pasar);
     un punto dentro del abanico y otro fuera (tolerancia baja a 30°,
     ambos deben estar en jardines para 45°); simetría confirmada
     (invertir el orden hoy/histórico da el mismo resultado); dos
     parques con hpACF distinto y mismo ángulo firmado (debe pasar);
     velocidad fuera de ±2 mph en un punto (debe excluir);
     clasificación distinta (debe excluir); trayectoria incompleta
     (debe excluir); orientación de parque no confirmada en cualquiera
     de los dos lados (debe excluir). Pendiente de que Perez lo corra
     contra datos reales del histórico.
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

  // CANDADO DE TRAYECTORIA NORMALIZADA: ambos juegos deben tener
  // trayectoria de 7 puntos completa, misma clasificación exacta, y
  // orientación de parque confirmada en AMBOS lados (pueden ser
  // parques distintos). Cada uno de los 7 puntos se normaliza según
  // el hpACF de su propio parque, y se compara con tolerancia ±45°
  // (zona jardines, según el ángulo de HOY) o ±30° (zona home) más
  // ±2 mph. Un solo punto fuera de tolerancia invalida el histórico
  // completo — sin promedios.
  function trayectoriasCompatibles(today, h) {
    const trajToday = today && today.trayectoriaViento;
    const trajHist = h && h.trayectoriaViento;

    if (!trajToday || !trajHist) return false;
    if (!trajToday.clasificacion || trajToday.clasificacion !== trajHist.clasificacion) return false;

    const mapaToday = trayectoriaCompleta(trajToday);
    const mapaHist = trayectoriaCompleta(trajHist);
    if (!mapaToday || !mapaHist) return false;

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
    // pasaron el candado arriba). CORREGIDO: ya NO se comparan
    // today.windDir y h.windDir como grados de compás crudos, y ya NO
    // se usa el hpACF de HOY para interpretar el viento del histórico
    // — eso castigaba con score bajo a dos vientos físicamente
    // idénticos (misma relación con su propio jardín/home) en parques
    // con orientación distinta, justo el mismo error que ya se había
    // corregido en el candado de 7 puntos pero que aquí seguía intacto.
    // Ahora cada lado se normaliza con SU PROPIO hpACF, usando la
    // misma anguloRelativoParque() ya definida arriba, y tanto los 10
    // puntos de dirección como el bonus de 5 se calculan sobre esos
    // dos ángulos normalizados. Si el hpACF de cualquiera de los dos
    // parques no es un número real, este componente completo (10 + 5)
    // no aporta nada — no se inventa una orientación por defecto ni se
    // vuelve a comparar en crudo como respaldo.
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
        // dirección relativa que ahora conserva right/left): una resta
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
