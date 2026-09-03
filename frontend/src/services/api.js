const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "";

async function request(path, options = {}) {
  const telegramInitData = window.Telegram?.WebApp?.initData || "";
  const driverToken = localStorage.getItem("driver_token") || "";

  const response = await fetch(
    `${API_BASE_URL}${path}`,
    {
      headers: {
        "Content-Type": "application/json",
        ...(telegramInitData
          ? { "X-Telegram-Init-Data": telegramInitData }
          : {}),
        ...(driverToken
          ? { "Authorization": `Bearer ${driverToken}` }
          : {}),
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

export function createLugar({ nombre, direccion }) {
  return request("/api/catalogos/lugares", {
    method: "POST",
    body: JSON.stringify({ nombre, direccion })
  });
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

export function getInspeccionVehicular(idViaje) {
  return request(`/api/viajes/${idViaje}/inspeccion`);
}

export function enviarInspeccionVehicular(idViaje, data) {
  return request(`/api/viajes/${idViaje}/inspeccion`, {
    method: "POST",
    body: JSON.stringify(data)
  });
}

export function registrarUbicacionesLote(idViaje, ubicaciones) {
  return request(`/api/viajes/${idViaje}/ubicaciones/lote`, {
    method: "POST",
    body: JSON.stringify({ ubicaciones })
  });
}

export function registrarPuntoIntermedio(idViaje, data) {
  return request(`/api/viajes/${idViaje}/punto-intermedio`, {
    method: "POST",
    body: JSON.stringify(data)
  });
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

export function loginConductorConPin(idConductorOrPin, optionalPin) {
  let idConductor = null;
  let pin = "";
  if (optionalPin !== undefined) {
    idConductor = idConductorOrPin;
    pin = optionalPin;
  } else {
    pin = idConductorOrPin;
  }
  return request("/api/conductor/auth/login-pin", {
    method: "POST",
    body: JSON.stringify({ idConductor, pin })
  });
}

export function getDriverSession() {
  return request("/api/conductor/auth/session");
}

export function logoutDriver() {
  return request("/api/conductor/auth/logout", {
    method: "POST"
  });
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

export function getSupervisorAccess() { return request("/api/telegram/supervisor/acceso"); }
export function registrarSupervisor(data) { return request("/api/telegram/supervisor/registro", { method: "POST", body: JSON.stringify(data) }); }
export function vincularCuentaSupervisor(data) { return request("/api/telegram/supervisor/vincular-cuenta", { method: "POST", body: JSON.stringify(data) }); }
export function ingresarCorreoSupervisor(correo) { return request("/api/telegram/supervisor/ingresar-correo", { method: "POST", body: JSON.stringify({ correo }) }); }
export function getSupervisorInspecciones() { return request("/api/supervisor/inspecciones"); }
export function getSupervisorInspeccion(idInspeccion) { return request(`/api/supervisor/inspecciones/${idInspeccion}`); }
export function decidirSupervisorInspeccion(idInspeccion, data) { return request(`/api/supervisor/inspecciones/${idInspeccion}/decision`, { method: "PATCH", body: JSON.stringify(data) }); }
export function getSupervisorAsignaciones() { return request("/api/supervisor/inspecciones/asignaciones"); }
export function asignarVehiculoSupervisor({ idConductor, idVehiculo }) { return request("/api/supervisor/inspecciones/asignaciones", { method: "POST", body: JSON.stringify({ idConductor, idVehiculo }) }); }

export function crearGerenciamientoViaje(payload) {
  return request("/api/gerenciamiento-viajes", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function getGerenciamientoViaje(idGerenciamiento) {
  return request(`/api/gerenciamiento-viajes/${idGerenciamiento}`);
}

export function getGerenciamientoViajePorViaje(idViaje) {
  return request(`/api/gerenciamiento-viajes/viaje/${idViaje}`);
}

export function listGerenciamientosViaje(params = {}) {
  const search = new URLSearchParams(params).toString();
  return request(`/api/gerenciamiento-viajes${search ? `?${search}` : ''}`);
}

export function aprobarGerenciamientoViaje(idGerenciamiento, payload) {
  return request(`/api/gerenciamiento-viajes/${idGerenciamiento}/aprobar`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export function registrarReporteHoraGerenciamiento(idGerenciamiento, { puntoIndex, horaReportada }) {
  return request(`/api/gerenciamiento-viajes/${idGerenciamiento}/reporte-hora`, {
    method: "PATCH",
    body: JSON.stringify({ puntoIndex, horaReportada })
  });
}



