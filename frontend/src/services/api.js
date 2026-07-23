async function request(path, options = {}) {
  const response = await fetch(path, {
    headers: {
      "Content-Type": "application/json",
      ...options.headers
    },
    ...options
  });

  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json")
    ? await response.json()
    : null;

  if (!response.ok) {
    throw new Error(
      data?.message || "Ocurrió un error en la solicitud."
    );
  }

  return data;
}

export function getConductores() {
  return request("/api/catalogos/conductores");
}

export function getVehiculos() {
  return request("/api/catalogos/vehiculos");
}

export function getLugares() {
  return request("/api/catalogos/lugares");
}

export function createViaje(payload) {
  return request("/api/viajes", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}
