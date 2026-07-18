<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Fuerza de Equipo — Backtest de señales</title>
<style>
  body { font-family: monospace; background:#0b0b0b; color:#e6e6e6; padding:20px; max-width:1000px; margin:0 auto; }
  input, button { font-family: monospace; font-size:14px; padding:6px; margin:4px 0; }
  label { display:block; margin-top:10px; }
  table { border-collapse: collapse; width:100%; margin-top:14px; font-size:13px; }
  th, td { border:1px solid #333; padding:6px 10px; text-align:right; }
  th { background:#161616; text-align:center; }
  td:first-child, th:first-child { text-align:left; }
  .bloque { border:1px solid #333; padding:12px; border-radius:4px; margin-top:16px; }
  .ok { color:#4caf50; }
  .no { color:#e05252; }
  .warn { color:#e0a552; }
  button { background:#1a1a1a; color:#e6e6e6; border:1px solid #444; cursor:pointer; }
  button:hover { background:#252525; }
  #log { white-space: pre-wrap; background:#111; padding:12px; border:1px solid #333; margin-top:16px; font-size:12px; max-height:300px; overflow:auto; }
  h1, h2, h3 { margin-bottom:6px; }
  p { margin:4px 0; }
</style>
</head>
<body>

<!--
============================================================
PRÓLOGO — fuerza-equipo-backtest.html
============================================================
QUÉ ES:
  Herramienta de auditoría que corre un backtest juego-por-juego
  sobre TODO el histórico disponible, midiendo si distintas señales
  individuales de "fuerza de equipo" (y unas pocas combinaciones
  simples de esas señales) habrían anticipado correctamente al
  ganador de cada partido, usando ÚNICAMENTE datos disponibles antes
  de ese partido.

  NO es un motor de predicción. NO fija pesos. NO decide una señal
  ganadora por sí sola — solo mide y muestra resultados para que el
  humano audite y decida.

DE QUÉ DEPENDE:
  1. window.MLBPRO_CORE.leerHistoricoCache()
     — única fuente de los juegos ya jugados.
  2. window.calcularFuerzaEquipo(homeTeam, awayTeam, fechaCorteISO)
     — de fuerza-equipo.js, SIN MODIFICAR. Este archivo reutiliza esa
     función tal cual está auditada; no reimplementa su lógica interna
     de récord/forma/racha.

  Ambos scripts deben cargar ANTES que este HTML, en este orden:
    <script src="mlbpro-core.js"></script>
    <script src="fuerza-equipo.js"></script>

CÓMO SE GARANTIZA "NUNCA USAR EL JUEGO EVALUADO NI JUEGOS POSTERIORES,
NI CONTAMINAR ENTRE JUEGOS DEL MISMO DÍA":
  Para cada juego G de la caché, se llama:
    calcularFuerzaEquipo(G.home, G.away, fechaDe(G))
  fuerza-equipo.js excluye internamente TODO juego cuya fecha sea
  IGUAL o POSTERIOR a fechaCorteISO. Como fechaCorteISO es la fecha
  exacta de G, esto excluye automáticamente:
    - G mismo,
    - cualquier juego futuro,
    - cualquier OTRO juego jugado ese mismo día (incluyendo el otro
      partido de un doubleheader).
  No se necesitó lógica adicional de "excluir mismo día": es un
  efecto directo, ya auditado, de fuerza-equipo.js. Este archivo no
  toca esa regla ni la reimplementa.

SEÑALES EVALUADAS (una predicción por señal, por juego):
  1. porcentaje_victorias general (home vs away)
  2. últimos 5 (tasa de victorias en los 5 juegos previos de cada equipo)
  3. últimos 10 (ídem con 10 juegos previos)
  4. récord correspondiente: record_local del home vs record_visitante del away
  5. diferencial promedio de carreras (diferencial_carreras / juegos_totales, SIN redondeo previo)
  6. promedio anotadas − promedio permitidas (usando los campos YA
     redondeados a 2 decimales que devuelve fuerza-equipo.js; por eso
     puede diferir mínimamente de la señal 5, que usa el diferencial crudo)

  Por señal, si cualquiera de los dos equipos no tiene el valor
  necesario (perfil no confirmado, o 0 juegos en la ventana pedida),
  ese juego se cuenta como "sin señal", nunca como acierto ni fallo.
  Si el valor es EXACTAMENTE igual entre ambos equipos, también se
  cuenta como "sin señal" (no se rompe el empate al azar).

COMBINACIONES SIMPLES (solo para observar, NADA se fija en producción):
  A. Unanimidad — predice solo si las 6 señales individuales
     coinciden todas en el mismo equipo; si no coinciden todas o hay
     alguna sin señal, es "sin señal".
  B. Mayoría simple — cuenta los votos de las señales que sí
     lograron predecir (ignora las "sin señal"); si un equipo tiene
     estrictamente más votos, ese es el predicho; empate = sin señal.
  C. Forma reciente (últimos 5 + últimos 10 + récord local/visitante)
     — mayoría simple, pero solo entre esas 3 señales.
  Ninguna combinación usa pesos, coeficientes ni ajustes inventados:
  son conteos de votos, nada más.

QUÉ TOCA:
  Nada de localStorage (ni lectura directa ni escritura — toda
  lectura pasa por MLBPRO_CORE.leerHistoricoCache()). No escribe
  ninguna caché nueva. No conecta con Moneyline, Coincidencia, F5, K6
  ni clima. No modifica fuerza-equipo.js ni mlbpro-core.js.

LIMITACIÓN DE RENDIMIENTO (documentada, no oculta):
  Por cada juego evaluado se vuelve a calcular el perfil completo de
  ambos equipos desde cero (calcularFuerzaEquipo barre todo el
  histórico otra vez). Con cachés grandes esto es O(n²) y puede tardar
  varios segundos. Hay un campo opcional para limitar cuántos juegos
  recientes se evalúan, solo por rendimiento — no cambia la regla de
  qué datos puede ver cada perfil.
============================================================
-->

<h1>Backtest de señales — Fuerza de Equipo</h1>
<p>Mide, juego por juego y usando solo historial ANTERIOR a cada partido, si cada señal individual (o una combinación simple sin pesos) habría acertado al ganador. No decide nada por sí solo: es para que el humano audite.</p>

<label>Límite de juegos a evaluar (opcional, más recientes primero; vacío = todos):
  <input type="text" id="inpLimite" placeholder="Ej: 500" style="width:120px">
</label>
<button onclick="ejecutarBacktest()">Correr backtest</button>

<div id="resumenGeneral"></div>
<div id="tablaSenales"></div>
<div id="tablaCombos"></div>
<div id="log"></div>

<script src="mlbpro-core.js"></script>
<script src="fuerza-equipo.js"></script>
<script>
(function () {

  // ---- Definición de señales: cada una extrae un valor numérico
  // (o null si no hay dato suficiente) del perfil de un equipo. ----
  const SENALES = [
    {
      nombre: "Porcentaje de victorias general",
      valor: (p) => (Number.isFinite(p.porcentaje_victorias) ? p.porcentaje_victorias : null)
    },
    {
      nombre: "Últimos 5",
      valor: (p) => {
        const u = p.ultimos_5;
        if (!u || u.juegos === 0 || !Number.isFinite(u.ganados)) return null;
        return u.ganados / u.juegos;
      }
    },
    {
      nombre: "Últimos 10",
      valor: (p) => {
        const u = p.ultimos_10;
        if (!u || u.juegos === 0 || !Number.isFinite(u.ganados)) return null;
        return u.ganados / u.juegos;
      }
    },
    {
      nombre: "Récord local/visitante correspondiente",
      // Para el home usamos su récord COMO LOCAL; para el away, su
      // récord COMO VISITANTE — que es la situación real del partido.
      valorHome: (p) => {
        const r = p.record_local;
        if (!r || r.juegos === 0 || !Number.isFinite(r.ganados)) return null;
        return r.ganados / r.juegos;
      },
      valorAway: (p) => {
        const r = p.record_visitante;
        if (!r || r.juegos === 0 || !Number.isFinite(r.ganados)) return null;
        return r.ganados / r.juegos;
      }
    },
    {
      nombre: "Diferencial promedio de carreras (crudo)",
      valor: (p) => {
        if (!Number.isFinite(p.diferencial_carreras) || !p.juegos_totales) return null;
        return p.diferencial_carreras / p.juegos_totales;
      }
    },
    {
      nombre: "Promedio anotadas − promedio permitidas (redondeado)",
      valor: (p) => {
        if (!Number.isFinite(p.promedio_anotadas) || !Number.isFinite(p.promedio_permitidas)) return null;
        return p.promedio_anotadas - p.promedio_permitidas;
      }
    }
  ];

  function valorSenalHome(senal, perfilHome) {
    return senal.valorHome ? senal.valorHome(perfilHome) : senal.valor(perfilHome);
  }
  function valorSenalAway(senal, perfilAway) {
    return senal.valorAway ? senal.valorAway(perfilAway) : senal.valor(perfilAway);
  }

  function predecir(valorHome, valorAway) {
    if (!Number.isFinite(valorHome) || !Number.isFinite(valorAway)) return null; // sin señal
    if (valorHome === valorAway) return null; // empate exacto = sin señal
    return valorHome > valorAway ? "home" : "away";
  }

  function nuevoContador() {
    return { juegos_evaluados: 0, aciertos: 0, fallos: 0, empates_sin_senal: 0 };
  }

  function registrar(cont, prediccion, realWinner) {
    cont.juegos_evaluados++;
    if (prediccion === null) { cont.empates_sin_senal++; return; }
    if (prediccion === realWinner) cont.aciertos++; else cont.fallos++;
  }

  function porcentajeAcierto(cont) {
    const decididos = cont.aciertos + cont.fallos;
    if (decididos === 0) return null;
    return +(cont.aciertos / decididos * 100).toFixed(1);
  }

  function fechaDeFila(row) {
    const raw = row?.date;
    if (typeof raw !== "string" || raw.length < 10) return null;
    return raw.slice(0, 10);
  }

  function filaValida(row) {
    if (!row || typeof row !== "object") return false;
    if (typeof row.home !== "string" || row.home.length === 0) return false;
    if (typeof row.away !== "string" || row.away.length === 0) return false;
    if (!Number.isFinite(row.awayRuns)) return false;
    if (!Number.isFinite(row.homeRuns)) return false;
    if (row.awayRuns === row.homeRuns) return false; // no hay empates en MLB; descarta datos corruptos
    if (fechaDeFila(row) === null) return false;
    return true;
  }

  function log(msg) {
    const el = document.getElementById("log");
    el.textContent += msg + "\n";
  }

  function ejecutarBacktest() {
    document.getElementById("log").textContent = "";
    document.getElementById("resumenGeneral").innerHTML = "";
    document.getElementById("tablaSenales").innerHTML = "";
    document.getElementById("tablaCombos").innerHTML = "";

    if (typeof window.MLBPRO_CORE === "undefined" ||
        typeof window.MLBPRO_CORE.leerHistoricoCache !== "function") {
      document.getElementById("resumenGeneral").innerHTML =
        '<p class="no">ERROR: mlbpro-core.js no cargó. Revisa el orden de los &lt;script&gt;.</p>';
      return;
    }
    if (typeof window.calcularFuerzaEquipo !== "function") {
      document.getElementById("resumenGeneral").innerHTML =
        '<p class="no">ERROR: fuerza-equipo.js no cargó.</p>';
      return;
    }

    let filas;
    try {
      filas = window.MLBPRO_CORE.leerHistoricoCache();
    } catch (e) {
      filas = [];
    }
    if (!Array.isArray(filas)) filas = [];

    const filasValidas = filas.filter(filaValida);
    filasValidas.sort((a, b) => {
      const fa = fechaDeFila(a), fb = fechaDeFila(b);
      if (fa !== fb) return fa < fb ? -1 : 1;
      const pa = Number(a.gamePk), pb = Number(b.gamePk);
      if (Number.isFinite(pa) && Number.isFinite(pb)) return pa - pb;
      return 0;
    });

    const limiteRaw = document.getElementById("inpLimite").value.trim();
    let juegosParaEvaluar = filasValidas;
    if (limiteRaw !== "") {
      const lim = Number(limiteRaw);
      if (Number.isFinite(lim) && lim > 0) {
        juegosParaEvaluar = filasValidas.slice(-Math.floor(lim));
      }
    }

    const contadoresSenal = {};
    SENALES.forEach(s => contadoresSenal[s.nombre] = nuevoContador());

    const contadoresCombo = {
      "Unanimidad (6 señales)": nuevoContador(),
      "Mayoría simple (6 señales)": nuevoContador(),
      "Forma reciente (últimos5 + últimos10 + récord L/V)": nuevoContador()
    };

    let juegosSinHistorialSuficiente = 0;
    let juegosProcesados = 0;

    for (const row of juegosParaEvaluar) {
      const fechaCorte = fechaDeFila(row);
      const realWinner = row.homeRuns > row.awayRuns ? "home" : "away";

      let res;
      try {
        res = window.calcularFuerzaEquipo(row.home, row.away, fechaCorte);
      } catch (e) {
        log("Error evaluando " + row.away + " @ " + row.home + " (" + fechaCorte + "): " + e.message);
        continue;
      }

      if (!res || !res.confirmado) {
        juegosSinHistorialSuficiente++;
        continue;
      }

      juegosProcesados++;

      const predicciones = [];
      for (const senal of SENALES) {
        const vh = valorSenalHome(senal, res.home);
        const va = valorSenalAway(senal, res.away);
        const pred = predecir(vh, va);
        registrar(contadoresSenal[senal.nombre], pred, realWinner);
        predicciones.push({ nombre: senal.nombre, pred });
      }

      // --- Combo A: Unanimidad ---
      const todasPred = predicciones.map(p => p.pred);
      let predUnanimidad = null;
      if (todasPred.every(p => p === "home")) predUnanimidad = "home";
      else if (todasPred.every(p => p === "away")) predUnanimidad = "away";
      registrar(contadoresCombo["Unanimidad (6 señales)"], predUnanimidad, realWinner);

      // --- Combo B: Mayoría simple entre las 6 ---
      registrar(
        contadoresCombo["Mayoría simple (6 señales)"],
        votoMayoria(todasPred),
        realWinner
      );

      // --- Combo C: Forma reciente (últimos5 + últimos10 + récord L/V) ---
      const nombresForma = ["Últimos 5", "Últimos 10", "Récord local/visitante correspondiente"];
      const votosForma = predicciones.filter(p => nombresForma.includes(p.nombre)).map(p => p.pred);
      registrar(
        contadoresCombo["Forma reciente (últimos5 + últimos10 + récord L/V)"],
        votoMayoria(votosForma),
        realWinner
      );
    }

    renderResumenGeneral(filas.length, filasValidas.length, juegosParaEvaluar.length,
      juegosProcesados, juegosSinHistorialSuficiente);
    renderTablaSenales(contadoresSenal);
    renderTablaCombos(contadoresCombo);
  }

  function votoMayoria(preds) {
    const validos = preds.filter(p => p !== null);
    if (validos.length === 0) return null;
    const votosHome = validos.filter(p => p === "home").length;
    const votosAway = validos.filter(p => p === "away").length;
    if (votosHome === votosAway) return null;
    return votosHome > votosAway ? "home" : "away";
  }

  function renderResumenGeneral(totalCache, totalValidas, totalEvaluadas, procesados, sinHistorial) {
    document.getElementById("resumenGeneral").innerHTML = `
      <div class="bloque">
        <p>Filas totales en caché: ${totalCache}</p>
        <p>Filas estructuralmente válidas: ${totalValidas}</p>
        <p>Juegos considerados para este backtest (según límite): ${totalEvaluadas}</p>
        <p class="ok">Juegos con historial suficiente en ambos equipos (evaluados de verdad): ${procesados}</p>
        <p class="warn">Juegos descartados por falta de historial previo (perfil no confirmado): ${sinHistorial}</p>
      </div>`;
  }

  function renderTablaSenales(contadores) {
    let filas = "";
    for (const s of SENALES) {
      const c = contadores[s.nombre];
      const pct = porcentajeAcierto(c);
      filas += `
        <tr>
          <td>${s.nombre}</td>
          <td>${c.juegos_evaluados}</td>
          <td>${c.aciertos}</td>
          <td>${c.fallos}</td>
          <td>${c.empates_sin_senal}</td>
          <td>${pct === null ? "N/D" : pct + "%"}</td>
        </tr>`;
    }
    document.getElementById("tablaSenales").innerHTML = `
      <h2>Señales individuales</h2>
      <table>
        <tr><th>Señal</th><th>Juegos evaluados</th><th>Aciertos</th><th>Fallos</th><th>Empates/sin señal</th><th>% acierto</th></tr>
        ${filas}
      </table>`;
  }

  function renderTablaCombos(contadores) {
    let filas = "";
    for (const nombre of Object.keys(contadores)) {
      const c = contadores[nombre];
      const pct = porcentajeAcierto(c);
      filas += `
        <tr>
          <td>${nombre}</td>
          <td>${c.juegos_evaluados}</td>
          <td>${c.aciertos}</td>
          <td>${c.fallos}</td>
          <td>${c.empates_sin_senal}</td>
          <td>${pct === null ? "N/D" : pct + "%"}</td>
        </tr>`;
    }
    document.getElementById("tablaCombos").innerHTML = `
      <h2>Combinaciones simples (sin pesos, solo conteo de votos)</h2>
      <table>
        <tr><th>Combinación</th><th>Juegos evaluados</th><th>Aciertos</th><th>Fallos</th><th>Empates/sin señal</th><th>% acierto</th></tr>
        ${filas}
      </table>`;
  }

  window.ejecutarBacktest = ejecutarBacktest;

})();
</script>
</body>
</html>
