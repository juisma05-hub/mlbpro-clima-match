/* ============================================================
   PRÓLOGO — fuerza-equipo.js
   ============================================================
   QUÉ ES:
     Calculadora de perfiles de "fuerza de equipo" (récord, forma
     reciente, carreras anotadas/permitidas, récord local/visitante,
     racha) para dos equipos, usando ÚNICAMENTE juegos ya jugados que
     existen en el histórico de MLBPRO_CORE.

   DE QUÉ DEPENDE:
     window.MLBPRO_CORE.leerHistoricoCache()
     Nada más. No toca Moneyline, Coincidencia, F5, K6 ni clima.
     No recalcula fecha/hora — si en el futuro hiciera falta "hoy",
     debe pedirse a MLBPRO_CORE.hoyISO(), nunca recalcularse aquí.

     El propio archivo (esta función pública, la validación de fecha,
     el ordenamiento) NO depende de `window` para existir — solo la
     LECTURA del histórico depende de MLBPRO_CORE, que es browser-only
     por diseño. Esto permite que module.exports funcione en Node
     sin lanzar ReferenceError al cargar el archivo.

   QUIÉN LO USA:
     fuerza-equipo-test.html (por ahora). Ningún motor de producción
     lo consume todavía — es la herramienta cruda de auditoría.

   ENTRADAS:
     calcularFuerzaEquipo(homeTeam, awayTeam, fechaCorteISO)

       homeTeam
         string. Nombre exacto del equipo tal como aparece en las
         filas del histórico.

       awayTeam
         string. Igual que homeTeam.

       fechaCorteISO
         string "YYYY-MM-DD", con año/mes/día reales.
         Todo juego con fecha igual o posterior queda excluido.

   SALIDAS:
     {
       confirmado,
       estado,
       fecha_corte,
       home,
       away,
       score_home: null,
       score_away: null,
       nota
     }

   LIMITACIÓN DOCUMENTADA — DOUBLEHEADERS:
     La caché histórica guarda gamePk y date, pero no necesariamente
     la hora programada. Cuando existen dos juegos del mismo equipo
     el mismo día, se usa gamePk ascendente como desempate.

     Si falta gamePk o existe un empate de gamePk, se conserva el
     orden original de la caché y se expone advertencia_orden.

   QUÉ TOCA:
     Nada de localStorage directo.
     Nada de DOM.
     No escribe ninguna caché.

   QUÉ NO HACE:
     - No calcula índice final de fuerza.
     - score_home y score_away quedan siempre en null.
     - No inventa pesos.
     - No inventa valores neutrales.
     - No normaliza nombres de equipos.
   ============================================================ */

(function (root) {
  "use strict";

  function esFechaISOValida(str) {
    if (typeof str !== "string") return false;

    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str);
    if (!match) return false;

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);

    if (month < 1 || month > 12) return false;
    if (day < 1 || day > 31) return false;

    const fecha = new Date(Date.UTC(year, month - 1, day));

    return (
      fecha.getUTCFullYear() === year &&
      fecha.getUTCMonth() === month - 1 &&
      fecha.getUTCDate() === day
    );
  }

  function fechaDeFila(row) {
    const raw = row?.date;

    if (typeof raw !== "string" || raw.length < 10) {
      return null;
    }

    const fecha = raw.slice(0, 10);

    return esFechaISOValida(fecha)
      ? fecha
      : null;
  }

  function gamePkNumerico(row) {
    const valor = Number(row?.gamePk);

    return Number.isFinite(valor)
      ? valor
      : null;
  }

  function filaValida(row) {
    if (!row || typeof row !== "object") return false;

    if (
      typeof row.home !== "string" ||
      row.home.trim().length === 0
    ) {
      return false;
    }

    if (
      typeof row.away !== "string" ||
      row.away.trim().length === 0
    ) {
      return false;
    }

    if (!Number.isFinite(row.awayRuns)) return false;
    if (!Number.isFinite(row.homeRuns)) return false;

    if (fechaDeFila(row) === null) return false;

    return true;
  }

  function perfilVacio(equipo, motivo) {
    return {
      equipo: equipo,
      confirmado: false,

      juegos_totales: 0,
      ganados: null,
      perdidos: null,
      porcentaje_victorias: null,

      ultimos_5: {
        juegos: 0,
        ganados: null,
        perdidos: null
      },

      ultimos_10: {
        juegos: 0,
        ganados: null,
        perdidos: null
      },

      racha_actual: {
        tipo: null,
        cantidad: null
      },

      carreras_anotadas: null,
      carreras_permitidas: null,
      diferencial_carreras: null,

      promedio_anotadas: null,
      promedio_permitidas: null,

      record_local: {
        juegos: 0,
        ganados: null,
        perdidos: null
      },

      record_visitante: {
        juegos: 0,
        ganados: null,
        perdidos: null
      },

      juegos_excluidos_por_datos_invalidos: 0,
      advertencia_orden: null,
      nota: motivo
    };
  }

  function ordenarCronologico(filasEquipo) {
    return filasEquipo
      .map(function (item, indiceOriginal) {
        return {
          row: item.row,
          esLocal: item.esLocal,
          indiceOriginal: indiceOriginal
        };
      })
      .sort(function (a, b) {
        const fechaA = fechaDeFila(a.row);
        const fechaB = fechaDeFila(b.row);

        if (fechaA !== fechaB) {
          return fechaA < fechaB ? -1 : 1;
        }

        const gamePkA = gamePkNumerico(a.row);
        const gamePkB = gamePkNumerico(b.row);

        if (
          gamePkA !== null &&
          gamePkB !== null &&
          gamePkA !== gamePkB
        ) {
          return gamePkA - gamePkB;
        }

        if (gamePkA !== null && gamePkB === null) {
          return -1;
        }

        if (gamePkA === null && gamePkB !== null) {
          return 1;
        }

        return a.indiceOriginal - b.indiceOriginal;
      });
  }

  function detectarAdvertenciaOrden(filasOrdenadas) {
    const gruposPorFecha = new Map();

    for (const item of filasOrdenadas) {
      const fecha = fechaDeFila(item.row);

      if (!gruposPorFecha.has(fecha)) {
        gruposPorFecha.set(fecha, []);
      }

      gruposPorFecha.get(fecha).push(item);
    }

    const fechasProblema = [];

    for (const [fecha, grupo] of gruposPorFecha.entries()) {
      if (grupo.length < 2) continue;

      const faltaGamePk = grupo.some(function (item) {
        return gamePkNumerico(item.row) === null;
      });

      const gamePksValidos = grupo
        .map(function (item) {
          return gamePkNumerico(item.row);
        })
        .filter(function (gamePk) {
          return gamePk !== null;
        });

      const gamePksRepetidos =
        new Set(gamePksValidos).size < gamePksValidos.length;

      if (faltaGamePk || gamePksRepetidos) {
        fechasProblema.push(fecha);
      }
    }

    if (fechasProblema.length === 0) {
      return null;
    }

    return (
      "Doubleheader detectado sin desempate confiable por gamePk en: " +
      fechasProblema.join(", ") +
      ". El orden de esos juegos y, por lo tanto, la racha y los " +
      "últimos 5/10 alrededor de esas fechas puede no reflejar el " +
      "orden real."
    );
  }

  function construirPerfil(
    equipo,
    filasHistorico,
    fechaCorteISO
  ) {
    if (
      typeof equipo !== "string" ||
      equipo.trim().length === 0
    ) {
      return perfilVacio(
        equipo,
        "Nombre de equipo vacío o inválido."
      );
    }

    const nombreEquipo = equipo.trim();

    let excluidosPorDatosInvalidos = 0;
    const filasEquipo = [];

    for (const row of filasHistorico) {
      const esLocal = row?.home === nombreEquipo;
      const esVisitante = row?.away === nombreEquipo;

      if (!esLocal && !esVisitante) {
        continue;
      }

      if (!filaValida(row)) {
        excluidosPorDatosInvalidos++;
        continue;
      }

      const fechaFila = fechaDeFila(row);

      if (fechaFila >= fechaCorteISO) {
        continue;
      }

      filasEquipo.push({
        row: row,
        esLocal: esLocal
      });
    }

    if (filasEquipo.length === 0) {
      const perfil = perfilVacio(
        nombreEquipo,
        "Sin juegos válidos para este equipo antes de la fecha de corte."
      );

      perfil.juegos_excluidos_por_datos_invalidos =
        excluidosPorDatosInvalidos;

      return perfil;
    }

    const filasOrdenadas = ordenarCronologico(filasEquipo);

    const advertenciaOrden =
      detectarAdvertenciaOrden(filasOrdenadas);

    let ganados = 0;
    let perdidos = 0;

    let carrerasAnotadas = 0;
    let carrerasPermitidas = 0;

    let ganadosLocal = 0;
    let perdidosLocal = 0;

    let ganadosVisitante = 0;
    let perdidosVisitante = 0;

    const resultados = [];

    for (const item of filasOrdenadas) {
      const row = item.row;
      const esLocal = item.esLocal;

      const anotadas = esLocal
        ? row.homeRuns
        : row.awayRuns;

      const permitidas = esLocal
        ? row.awayRuns
        : row.homeRuns;

      const gano = anotadas > permitidas;

      carrerasAnotadas += anotadas;
      carrerasPermitidas += permitidas;

      if (gano) {
        ganados++;
      } else {
        perdidos++;
      }

      resultados.push(gano ? "G" : "P");

      if (esLocal) {
        if (gano) {
          ganadosLocal++;
        } else {
          perdidosLocal++;
        }
      } else {
        if (gano) {
          ganadosVisitante++;
        } else {
          perdidosVisitante++;
        }
      }
    }

    const juegosTotales = filasOrdenadas.length;

    function contarUltimos(cantidad) {
      const ultimos = resultados.slice(-cantidad);

      let ganadosUltimos = 0;
      let perdidosUltimos = 0;

      for (const resultado of ultimos) {
        if (resultado === "G") {
          ganadosUltimos++;
        } else {
          perdidosUltimos++;
        }
      }

      return {
        juegos: ultimos.length,
        ganados: ganadosUltimos,
        perdidos: perdidosUltimos
      };
    }

    const tipoRacha = resultados[resultados.length - 1];

    let cantidadRacha = 0;

    for (
      let indice = resultados.length - 1;
      indice >= 0;
      indice--
    ) {
      if (resultados[indice] === tipoRacha) {
        cantidadRacha++;
      } else {
        break;
      }
    }

    return {
      equipo: nombreEquipo,
      confirmado: true,

      juegos_totales: juegosTotales,
      ganados: ganados,
      perdidos: perdidos,

      porcentaje_victorias:
        +(ganados / juegosTotales * 100).toFixed(1),

      ultimos_5: contarUltimos(5),
      ultimos_10: contarUltimos(10),

      racha_actual: {
        tipo: tipoRacha,
        cantidad: cantidadRacha
      },

      carreras_anotadas: carrerasAnotadas,
      carreras_permitidas: carrerasPermitidas,

      diferencial_carreras:
        carrerasAnotadas - carrerasPermitidas,

      promedio_anotadas:
        +(carrerasAnotadas / juegosTotales).toFixed(2),

      promedio_permitidas:
        +(carrerasPermitidas / juegosTotales).toFixed(2),

      record_local: {
        juegos: ganadosLocal + perdidosLocal,
        ganados: ganadosLocal,
        perdidos: perdidosLocal
      },

      record_visitante: {
        juegos: ganadosVisitante + perdidosVisitante,
        ganados: ganadosVisitante,
        perdidos: perdidosVisitante
      },

      juegos_excluidos_por_datos_invalidos:
        excluidosPorDatosInvalidos,

      advertencia_orden: advertenciaOrden,
      nota: "OK"
    };
  }

  function tieneMLBProCore() {
    return (
      typeof root !== "undefined" &&
      root !== null &&
      root.MLBPRO_CORE &&
      typeof root.MLBPRO_CORE.leerHistoricoCache === "function"
    );
  }

  function calcularFuerzaEquipo(
    homeTeam,
    awayTeam,
    fechaCorteISO
  ) {
    if (!tieneMLBProCore()) {
      return {
        confirmado: false,
        estado: "NO_CONFIRMADO",
        fecha_corte: fechaCorteISO || null,

        home: null,
        away: null,

        score_home: null,
        score_away: null,

        nota:
          "MLBPRO_CORE no está disponible. Cargue " +
          "mlbpro-core.js antes que fuerza-equipo.js."
      };
    }

    if (!esFechaISOValida(fechaCorteISO)) {
      return {
        confirmado: false,
        estado: "NO_CONFIRMADO",
        fecha_corte: fechaCorteISO || null,

        home: null,
        away: null,

        score_home: null,
        score_away: null,

        nota:
          "fechaCorteISO inválida. Se espera formato " +
          "YYYY-MM-DD con año, mes y día reales."
      };
    }

    let filasHistorico;

    try {
      filasHistorico =
        root.MLBPRO_CORE.leerHistoricoCache();
    } catch (error) {
      filasHistorico = [];
    }

    if (!Array.isArray(filasHistorico)) {
      filasHistorico = [];
    }

    const perfilHome = construirPerfil(
      homeTeam,
      filasHistorico,
      fechaCorteISO
    );

    const perfilAway = construirPerfil(
      awayTeam,
      filasHistorico,
      fechaCorteISO
    );

    const confirmado =
      perfilHome.confirmado &&
      perfilAway.confirmado;

    let nota = "OK";

    if (!confirmado) {
      const problemas = [];

      if (!perfilHome.confirmado) {
        problemas.push(
          "home: " + perfilHome.nota
        );
      }

      if (!perfilAway.confirmado) {
        problemas.push(
          "away: " + perfilAway.nota
        );
      }

      nota = problemas.join(" | ");
    } else {
      const advertencias = [];

      if (perfilHome.advertencia_orden) {
        advertencias.push(
          "home: " + perfilHome.advertencia_orden
        );
      }

      if (perfilAway.advertencia_orden) {
        advertencias.push(
          "away: " + perfilAway.advertencia_orden
        );
      }

      if (advertencias.length > 0) {
        nota = advertencias.join(" | ");
      }
    }

    return {
      confirmado: confirmado,
      estado: confirmado
        ? "CONFIRMADO"
        : "NO_CONFIRMADO",

      fecha_corte: fechaCorteISO,

      home: perfilHome,
      away: perfilAway,

      score_home: null,
      score_away: null,

      nota: nota
    };
  }

  if (
    typeof module !== "undefined" &&
    module.exports
  ) {
    module.exports = {
      calcularFuerzaEquipo: calcularFuerzaEquipo
    };
  }

  if (root) {
    root.calcularFuerzaEquipo =
      calcularFuerzaEquipo;
  }

})(
  typeof window !== "undefined"
    ? window
    : (
        typeof global !== "undefined"
          ? global
          : this
      )
);
