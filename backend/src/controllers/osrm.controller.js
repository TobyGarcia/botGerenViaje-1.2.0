// Proxy acotado al servicio interno: no acepta URLs ni destinos arbitrarios.
export async function routeRoadController(request, response) {
  const points = request.body?.points;
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
    const upstream = await fetch(`${base}/route/v1/driving/${coordinates}?overview=full&geometries=geojson&steps=false&continue_straight=false&radiuses=${points.map(() => 100).join(";")}`, { signal: controller.signal });
    const data = await upstream.json();
    const geometry = data.routes?.[0]?.geometry?.coordinates;
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
