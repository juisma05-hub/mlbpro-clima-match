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
       {tempF, windMph, humidity, precip, venue, windDir}. Compara
       clima + parque + dirección de viento relativa al parque. Cada
       componente (temp/viento/humedad/precip/bearing-bonus) solo suma
       puntos cuando AMBOS lados (today y h) traen ese valor como
       número real; si falta uno de los dos, ese componente no aporta
       nada al score (no se inventa 0 ni se fuerza NaN). La comparación
       de parque usa stadiumNorm(stadiumCanonName(...)) en ambos lados.

     evaluarViento(windDir, hpACF) → {categoria, favoreceBateo, bearingDiff}
       categoria: string para mostrar.
       favoreceBateo: true | false | null (null = neutral/cruzado o sin dato).
       Si windDir no es número real → "DIRECCIÓN NO CONFIRMADA".
       Si hpACF no es número real → "ORIENTACIÓN NO CONFIRMADA" (ya no
       se asume 45° por defecto).
       Usado por evaluarMercados() en index.html para decidir OVER/UNDER.

     tipoBrisa(today) → string. today = {venue, windMph, windDir}.
       PRIMERO chequea roof-status.js (domo cerrado / techo no
       verificado) antes de mirar el viento — ese orden importa, no
       invertirlo. Si windMph no es número real → "VELOCIDAD NO
       CONFIRMADA" (ya no se asume 0 mph). Devuelve: "ROOF CERRADO" |
       "ROOF NO CONFIRMADO" | "VELOCIDAD NO CONFIRMADA" | "MUERTA" |
       "TURBULENTA" | "CRUZADA" | "DIRECTA" | variantes
       "/ DIRECCIÓN NO CONFIRMADA" | variantes
       "/ ORIENTACIÓN NO CONFIRMADA" (mismos umbrales de mph que las
       variantes de dirección, ya usados en el archivo: 12 y 7).

   CORRECCIÓN ACTUAL (esta sesión — 4 puntos confirmados por lectura de código):
   1. Se eliminaron los tres fallback de 45° (en scoreMatch, evaluarViento
      y tipoBrisa). Sin orientación confirmada del parque (getOrientacionParque
      devolviendo algo no numérico), ya no se calcula relación viento/parque:
      en scoreMatch se omite el bonus de bearing; en evaluarViento se
      devuelve "ORIENTACIÓN NO CONFIRMADA"; en tipoBrisa se devuelve una
      variante "/ ORIENTACIÓN NO CONFIRMADA" sin llamar a evaluarViento()
      con un hpACF inventado.
   2. scoreMatch ya no convierte null/undefined/"" en 0: cada componente
      (temp, viento, humedad, precipitación) solo suma puntos si ambos
      lados (today y h) son números reales; si falta uno, ese componente
      simplemente no aporta (antes, Number(undefined)=NaN contaminaba
      todo el score con NaN de forma silenciosa). La comparación de
      parque ahora usa stadiumNorm(stadiumCanonName(...)) en ambos lados
      en vez de comparar el string crudo de venue.
   3. evaluarViento ya no asume hpACF=45 cuando no llega un número real:
      devuelve { categoria:"ORIENTACIÓN NO CONFIRMADA", favoreceBateo:null,
      bearingDiff:null }. El chequeo de windDir no confirmado se conserva
      exactamente igual que antes.
   4. tipoBrisa ya no convierte windMph ausente en 0 mph: si no es número
      real, devuelve "VELOCIDAD NO CONFIRMADA" antes de evaluar nada más.
      El orden roof-status.js → velocidad → dirección → orientación se
      mantiene. Las categorías, umbrales (4, 7, 8, 12, 14) y pesos de
      scoreMatch (30/25/20/10/15/10/5) quedan intactos. La convención
      física (windDir = de dónde viene; va hacia = windDir+180°) no se
      tocó.
   5. CORRECCIÓN DE SEGUIMIENTO (esta sesión, sobre el punto 2/3/4
      anteriores): la validación seguía usando Number.isFinite(Number(v)),
      y como Number(null)===0 y Number("")===0, un dato ausente pasaba
      como "0 real" en vez de quedar excluido. Se agregó el helper
      esNumeroReal(v), que descarta explícitamente null/undefined/""
      ANTES de convertir a número, y se usa ahora en los 6 puntos de
      entrada de datos: temperatura, viento mph, humedad, precipitación,
      dirección del viento y orientación del parque (hpACF/hpACFraw).
      No se tocaron pesos, umbrales, categorías ni la lógica de
      viene de / va hacia.

   QUÉ TOCA:
     Nada de DOM ni localStorage. Puras funciones de cálculo.

   FECHA:
     13 jul 2026.

   ESTADO:
     NO_CONFIRMADO — correcciones aplicadas por lectura de código.
     Pendiente de prueba real que confirme: (a) que un juego sin
     orientación de parque real ya no dispara ningún cálculo con 45°
     inventado, (b) que scoreMatch da un valor coherente cuando falta
     un solo campo climático (sin colapsar a NaN ni sumar de más),
     (c) que la comparación de venue por stadiumNorm(stadiumCanonName())
     sigue emparejando los mismos históricos que antes, (d) que
     tipoBrisa muestra "VELOCIDAD NO CONFIRMADA" cuando corresponde en
     vez de tratar viento ausente como calma, y (e) que un valor null o
     "" en cualquiera de los 6 campos (tempF, windMph, humidity, precip,
     windDir, hpACF) efectivamente cae en la rama NO_CONFIRMADO y ya no
     se cuela como 0 real.
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

  function scoreMatch(today, h) {
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
  // Ajustada a la orientación real del parque (antes no lo estaba: usaba
  // grados de compás absolutos NE-SE/SW-NW sin importar hacia dónde
  // miraba el estadio, y por eso podía contradecir a evaluarViento()).
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
