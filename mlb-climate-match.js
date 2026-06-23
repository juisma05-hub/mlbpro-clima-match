(function () {
  const PROXY = "https://mlb-score-proxy.jip0512.workers.dev/?url=";
  function viaProxy(targetUrl) {
    return PROXY + encodeURIComponent(targetUrl);
  }
  function fechaHoyISO() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + day;
  }
  function scheduleUrl(fechaISO) {
    const base =
      "https://statsapi.mlb.com/api/v1/schedule" +
      "?sportId=1" +
      "&date=" + fechaISO +
      "&hydrate=venue";
    return viaProxy(base);
  }
  window.MLBClimateRoutes = {
    PROXY: PROXY,
    viaProxy: viaProxy,
    fechaHoyISO: fechaHoyISO,
    scheduleUrl: scheduleUrl
  };
})();
