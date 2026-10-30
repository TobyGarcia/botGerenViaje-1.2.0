// Distancia a segmentos en metros; limita la influencia de GPS aislados.
export function referenceRouteScore(route, references) {
  const line = route.geometry.coordinates;
  return references.reduce((score, [lat, lon]) => {
    const sx = 111320 * Math.cos(lat * Math.PI / 180);
    let closest = Infinity;
    for (let i = 1; i < line.length; i++) {
      const ax = (line[i - 1][0] - lon) * sx;
      const ay = (line[i - 1][1] - lat) * 111320;
      const dx = (line[i][0] - line[i - 1][0]) * sx;
      const dy = (line[i][1] - line[i - 1][1]) * 111320;
      const t = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy || 1)));
      closest = Math.min(closest, Math.hypot(ax + t * dx, ay + t * dy));
    }
    return score + Math.min(150, Math.max(0, closest - 35));
  }, 0) / Math.max(1, references.length);
}

// Proxy acotado al servicio interno: no acepta URLs ni destinos arbitrarios.
export async function routeRoadController(request, response) {
  const points = request.body?.points;
  const references = request.body?.references ?? [];
  if (!Array.isArray(references) || references.length > 2000 || references.some((p) =>
    !Array.isArray(p) || p.length !== 2 || !p.every(Number.isFinite) || Math.abs(p[0]) > 90 || Math.abs(p[1]) > 180)) {
    return response.status(400).json({ message: "Referencias GPS inválidas." });
  }
  if (!Array.isArray(points) || points.length < 2 || points.length > 50 ||
      points.some((p) => !Array.isArray(p) || p.length !== 2 ||
        !p.every(Number.isFinite) || Math.abs(p[0]) > 90 || Math.abs(p[1]) > 180)) {
    return response.status(400).json({ message: "Coordenadas de ruta inválidas." });
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  const cancel = () => { if (!response.writableEnded) controller.abort(); };
  response.on("close", cancel);
  try {
    const base = (process.env.OSRM_URL || "http://osrm-routing:5000").replace(/\/$/, "");
    const coordinates = points.map(([lat, lon]) => `${lon},${lat}`).join(";");
    const upstream = await fetch(`${base}/route/v1/driving/${coordinates}?alternatives=true&overview=full&geometries=geojson&steps=false&continue_straight=false&radiuses=${points.map(() => 100).join(";")}`, { signal: controller.signal });
    const data = await upstream.json();
    const candidates = (data.routes || []).filter((r) => r.geometry?.coordinates?.length >= 2);
    candidates.sort((a, b) => referenceRouteScore(a, references) - referenceRouteScore(b, references) || a.duration - b.duration);
    const geometry = candidates[0]?.geometry?.coordinates;
    if (!upstream.ok || data.code !== "Ok" || !geometry?.length) {
      throw new Error("No hay ruta vial disponible para estos puntos.");
    }
    return response.json({ geometry: geometry.map(([lon, lat]) => [lat, lon]) });
  } catch (error) {
    if (!response.destroyed) response.status(503).json({ message: "No fue posible calcular la ruta vial. Se conservan los puntos GPS." });
  } finally {
    clearTimeout(timer);
    response.off("close", cancel);
  }
}
