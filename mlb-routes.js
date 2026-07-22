/*
  MLBPro · mlb-routes.js

  FUNCIÓN:
  Define el punto único de acceso al proxy (Cloudflare Worker) que todos
  los archivos del proyecto usan para llegar a MLB StatsAPI (y, en
  algunos casos, a otras APIs externas). Es infraestructura pura: no
  decide, no valida, no transforma datos.

  ENTRADAS:
  Ninguna en tiempo de carga. scheduleByDate(fecha) recibe una fecha
  "YYYY-MM-DD".

  SALIDAS / MODIFICACIONES:
  Expone el objeto global MLB_ROUTES = { WORKER_BASE, scheduleByDate }.
  No escribe ninguna caché, no hace ningún fetch por sí mismo.

  DEPENDENCIAS:
  Ninguna.

  NO TOCA:
  Nada — no tiene lógica propia de negocio, solo define constantes y un
  helper de construcción de URL.

  UTC / HORA LOCAL:
  No aplica.

  QUÉ HACE: expone MLB_ROUTES.WORKER_BASE (prefijo del proxy) y
  MLB_ROUTES.scheduleByDate(fecha) (arma la URL de schedule para UNA
  fecha puntual, vía el proxy).

  QUÉ NO HACE: no valida fechas, no maneja errores de red, no cachea
  nada.

  QUÉ AFECTA: todo archivo que use MLB_ROUTES.WORKER_BASE para llegar a
  MLB StatsAPI (o a otras APIs externas) a través del proxy.

  QUÉ NO AFECTA: nada por sí mismo — es infraestructura pasiva.

  NOTA DE AUDITORÍA (Bloque 2): scheduleByDate(fecha) solo soporta UNA
  fecha puntual (?date=fecha). jalar-clima.js NO usa este helper — arma
  su propia URL de schedule a mano con &startDate=&endDate= (rango),
  porque scheduleByDate() no soporta rangos. No es un bug: son dos
  necesidades distintas (una fecha vs. un rango) y cada archivo construye
  la URL que le corresponde. Se deja anotado para que quede claro por
  qué scheduleByDate() existe pero jalar-clima.js no lo llama.

  ESTADO:
  CONFIRMADO (sin cambios de lógica). Prólogo agregado en esta auditoría
  — el archivo no tenía ninguno antes.

  FECHA:
  12 jul 2026.
*/

// mlb-routes.js
const MLB_ROUTES = {
  WORKER_BASE: "https://mlb-score-proxy.jip0512.workers.dev/?url=",
  scheduleByDate: function (fecha) {
    const mlbUrl = "https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=" + fecha;
    return MLB_ROUTES.WORKER_BASE + encodeURIComponent(mlbUrl);
  }
};
