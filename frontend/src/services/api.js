const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "";

async function request(path, options = {}) {
  const response = await fetch(
    `${API_BASE_URL}${path}`,
    {
      headers: {
        "Content-Type": "application/json",
        ...options.headers
      },
      ...options
    }
  );

  const contentType =
    response.headers.get("content-type") || "";
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
export function iniciarViaje(idViaje) {
  return request(
    `/api/viajes/${idViaje}/iniciar`,
    {
      method: "POST"
    }
  );
}

export function registrarUbicacion(
  idViaje,
  location
) {
  return request(
    `/api/viajes/${idViaje}/ubicaciones`,
    {
      method: "POST",
      body: JSON.stringify(location)
    }
  );
}
export function finalizarViaje(
  idViaje,
  kilometrajeFinal
) {
  return request(
    `/api/viajes/${idViaje}/finalizar`,
    {
      method: "POST",
      body: JSON.stringify({
        kilometrajeFinal
      })
    }
  );
}

export function cancelarViaje(idViaje) {
  return request(`/api/viajes/${idViaje}/cancelar`, {
    method: "POST"
  });
}

export function getViajeActivo(){
  return request(
    "/api/viajes/activo"
  );
}

export function getViajePorId(idViaje){
  return request(
    `/api/viajes/${idViaje}`
  );
}

export function autenticarTelegram(
  initData
){
  return request(
    "/api/telegram/autenticar",
    {
      method: "POST",

      body: JSON.stringify({
        initData
      })
    }
  );
}

export function registrarConductorTelegram(
  initData,
  conductorData
) {
  return request(
    "/api/telegram/registro-conductor",
    {
      method: "POST",
      body: JSON.stringify({
        initData,
        ...conductorData
      })
    }
  );
}
