// En Render ambos sitios reciben el dominio público de la API, sin el
// prefijo /api. Se admite también el valor anterior terminado en /api para
// que los despliegues existentes no construyan URLs como /api/api/...
const configuredApiBaseUrl = String(
  import.meta.env.VITE_API_BASE_URL || ""
).replace(/\/+$/, "");

const API_BASE_URL = configuredApiBaseUrl.replace(
  /\/api$/,
  ""
);

async function request(path, options = {}) {
  const response = await fetch(
    `${API_BASE_URL}/api${path}`,
    {
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...options.headers
      },
      ...options
    }
  );

  let body = null;

  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!response.ok) {
    throw new Error(
      body?.message ||
      "No fue posible completar la solicitud."
    );
  }

  return body;
}

export function loginAdmin({
  username,
  password
}) {
  return request(
    "/admin/auth/login",
    {
      method: "POST",
      body: JSON.stringify({
        username,
        password
      })
    }
  );
}

export function loginWithTenantEmail({ email }) {
  return request(
    "/admin/auth/tenant-login",
    {
      method: "POST",
      body: JSON.stringify({ email })
    }
  );
}

export function getAzureOAuthUrl() {
  return request("/admin/auth/azure/url");
}

export function exchangeAzureOAuthCode({ code, redirectUri }) {
  return request(
    "/admin/auth/azure/exchange-code",
    {
      method: "POST",
      body: JSON.stringify({ code, redirectUri })
    }
  );
}



export function getAdminSession() {
  return request(
    "/admin/auth/session"
  );
}

export function logoutAdmin() {
  return request(
    "/admin/auth/logout",
    {
      method: "POST"
    }
  );
}

export function getAdminConductores({
  search = "",
  status = "TODOS"
} = {}) {
  const params =
    new URLSearchParams();

  if (search.trim()) {
    params.set(
      "search",
      search.trim()
    );
  }

  if (status) {
    params.set(
      "status",
      status
    );
  }

  const query =
    params.toString();

  return request(
    `/admin/conductores${
      query ? `?${query}` : ""
    }`
  );
}

export function createAdminConductor(
  conductor
) {
  return request(
    "/admin/conductores",
    {
      method: "POST",

      body: JSON.stringify({
        nombre:
          conductor.nombre,

        telefono:
          conductor.telefono,

        licenciaNumero:
          conductor.licenciaNumero,

        tipoLicencia:
          conductor.tipoLicencia,

        empresa: conductor.empresa,

        licenciaVencimiento:
          conductor.licenciaVencimiento
      })
    }
  );
}

export function updateAdminConductorStatus(
  idConductor,
  activo
) {
  return request(
    `/admin/conductores/${idConductor}/estado`,
    {
      method: "PATCH",

      body: JSON.stringify({
        activo
      })
    }
  );
}

export function assignAdminConductorVehicle(idConductor, idVehiculo) {
  return request(
    `/admin/conductores/${idConductor}/asignar-vehiculo`,
    {
      method: "PATCH",
      body: JSON.stringify({
        idVehiculo
      })
    }
  );
}

export function approveAdminConductor(idConductor, aprobado) {
  return request(
    `/admin/conductores/${idConductor}/aprobar`,
    {
      method: "PATCH",
      body: JSON.stringify({
        aprobado
      })
    }
  );
}

export function setAdminConductorPin(idConductor, pin) {
  return request(
    `/admin/conductores/${idConductor}/pin`,
    {
      method: "PATCH",
      body: JSON.stringify({
        pin
      })
    }
  );
}


export function getAdminVehiculos({
  search = "",
  status = "TODOS"
} = {}) {
  const params =
    new URLSearchParams();

  if (search.trim()) {
    params.set(
      "search",
      search.trim()
    );
  }

  if (status) {
    params.set(
      "status",
      status
    );
  }

  const query =
    params.toString();

  return request(
    `/admin/vehiculos${
      query ? `?${query}` : ""
    }`
  );
}

export function createAdminVehiculo(
  vehiculo
) {
  return request(
    "/admin/vehiculos",
    {
      method: "POST",
      body: JSON.stringify({
        marca: vehiculo.marca,
        modelo: vehiculo.modelo,
        numeroEconomico: vehiculo.numeroEconomico,
        placas: vehiculo.placas,
        numeroPoliza: vehiculo.numeroPoliza,
        seguroVencimiento: vehiculo.seguroVencimiento,
        numeroSerie: vehiculo.numeroSerie,
        tipoVehiculo: vehiculo.tipoVehiculo,
        tipoPropiedad: vehiculo.tipoPropiedad,
        color: vehiculo.color,
        idConductorAsignado: vehiculo.idConductorAsignado,
        idSupervisorAsignado: vehiculo.idSupervisorAsignado,
        personalAsignadoNombre: vehiculo.personalAsignadoNombre
      })
    }
  );
}

export function getAdminUsers() { return request("/admin/usuarios"); }
export function createAdminUser(user) { return request("/admin/usuarios", { method: "POST", body: JSON.stringify(user) }); }
export function updateAdminUser(id, user) { return request(`/admin/usuarios/${id}`, { method: "PATCH", body: JSON.stringify(user) }); }
export function deleteAdminUser(id) { return request(`/admin/usuarios/${id}`, { method: "DELETE" }); }
export function updateMyProfile(profile) { return request("/admin/usuarios/perfil", { method: "PATCH", body: JSON.stringify(profile) }); }

export function getAdminVehiculoDetalle(idVehiculo) {
  return request(`/admin/vehiculos/${idVehiculo}`);
}

export function updateAdminVehiculoMantenimiento(idVehiculo, enMantenimiento) {
  return request(`/admin/vehiculos/${idVehiculo}/mantenimiento`, {
    method: "PATCH",
    body: JSON.stringify({ enMantenimiento })
  });
}

export function updateAdminVehiculoStatus(
  idVehiculo,
  activo
) {
  return request(
    `/admin/vehiculos/${idVehiculo}/estado`,
    {
      method: "PATCH",
      body: JSON.stringify({
        activo
      })
    }
  );
}

export function updateAdminVehiculo(idVehiculo, vehiculo) {
  return request(`/admin/vehiculos/${idVehiculo}`, {
    method: "PATCH",
    body: JSON.stringify(vehiculo)
  });
}
export function getAdminDestinos({
  search = "",
  status = "TODOS"
} = {}) {
  const params =
    new URLSearchParams();

  if (search.trim()) {
    params.set(
      "search",
      search.trim()
    );
  }

  if (status) {
    params.set(
      "status",
      status
    );
  }

  const query =
    params.toString();

  return request(
    `/admin/destinos${
      query ? `?${query}` : ""
    }`
  );
}

export function createAdminDestino(
  destino
) {
  return request(
    "/admin/destinos",
    {
      method: "POST",
      body: JSON.stringify({
        nombre: destino.nombre,
        direccion: destino.direccion
      })
    }
  );
}

export function updateAdminDestinoStatus(
  idDestino,
  activo
) {
  return request(
    `/admin/destinos/${idDestino}/estado`,
    {
      method: "PATCH",
      body: JSON.stringify({
        activo
      })
    }
  );
}

export function updateAdminDestino(
  idDestino,
  destino
) {
  return request(
    `/admin/destinos/${idDestino}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        nombre: destino.nombre,
        direccion: destino.direccion
      })
    }
  );
}
export function getAdminUbicacionesViaje({
  search = "",
  status = "TODOS"
} = {}) {
  const params =
    new URLSearchParams();

  if (search.trim()) {
    params.set(
      "search",
      search.trim()
    );
  }

  if (
    status &&
    status !== "TODOS"
  ) {
    params.set(
      "status",
      status
    );
  }

  const query =
    params.toString();

  return request(
    `/admin/ubicaciones-viaje${
      query ? `?${query}` : ""
    }`
  );
}

export function getAdminUbicacionesViajeDetalle(
  idViaje
) {
  return request(
    `/admin/ubicaciones-viaje/${idViaje}`
  );
}

export function getAdminViajes({
  search = "",
  status = "TODOS",
  dateFrom = "",
  dateTo = ""
} = {}) {
  const params =
    new URLSearchParams();

  if (search.trim()) {
    params.set(
      "search",
      search.trim()
    );
  }

  if (
    status &&
    status !== "TODOS"
  ) {
    params.set(
      "status",
      status
    );
  }

  if (dateFrom) {
    params.set(
      "dateFrom",
      dateFrom
    );
  }

  if (dateTo) {
    params.set(
      "dateTo",
      dateTo
    );
  }

  const query =
    params.toString();

  return request(
    `/admin/viajes${
      query ? `?${query}` : ""
    }`
  );
}

export function getAdminViajeDetalle(
  idViaje
) {
  return request(
    `/admin/viajes/${idViaje}`
  );
}

export function deleteAdminViaje(
  idViaje
) {
  return request(
    `/admin/viajes/${idViaje}`,
    {
      method: "DELETE"
    }
  );
}

export function getAdminVehiculoKilometraje(idVehiculo, filters = {}) {
  const params = new URLSearchParams();
  if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
  if (filters.dateTo) params.set("dateTo", filters.dateTo);
  if (filters.type && filters.type !== "TODOS") params.set("type", filters.type);
  const query = params.toString();
  return request(`/admin/vehiculos/${idVehiculo}/kilometraje${query ? `?${query}` : ""}`);
}

export function getAdminVehiculoKilometrajeResumen(idVehiculo) {
  return request(`/admin/vehiculos/${idVehiculo}/kilometraje/resumen`);
}

export function createAdminVehiculoKilometraje(idVehiculo, reading) {
  return request(`/admin/vehiculos/${idVehiculo}/kilometraje${reading.idRegistroCorregido ? "/correccion" : ""}`, {
    method: "POST",
    body: JSON.stringify(reading)
  });
}

export function getAdminDashboardSummary() {
  return request("/admin/viajes/resumen");
}

export function getAdminInspecciones() {
  return request("/admin/inspecciones");
}
export function getAdminInspeccionesPendientesCount() {
  return request("/admin/inspecciones/pendientes/count");
}
export function getAdminInspeccionDetalle(idInspeccion) {
  return request(`/admin/inspecciones/${idInspeccion}`);
}
export function decidirAdminInspeccion(idInspeccion, aprobada, comentario, firma) {
  return request(`/admin/inspecciones/${idInspeccion}/decision`, { method: "PATCH", body: JSON.stringify({ aprobada, comentario, firma }) });
}
export function getAdminInspeccionPdfPreviewUrl(idInspeccion) {
  return `${API_BASE_URL}/api/admin/inspecciones/${idInspeccion}/vista-previa-pdf`;
}
export async function descargarAdminInspeccionPdf(idInspeccion) {
  const response = await fetch(`${API_BASE_URL}/api/admin/inspecciones/${idInspeccion}/pdf`, { credentials: "include" });
  if (!response.ok) throw new Error("No fue posible descargar el reporte PDF.");
  const blob = await response.blob();
  const disposition = response.headers.get("content-disposition") || "";
  const name = disposition.match(/filename="([^"]+)"/)?.[1] || `inspeccion-${idInspeccion}.pdf`;
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a"); link.href = url; link.download = name; link.click();
  URL.revokeObjectURL(url);
}

export function getManejoComentadoResumenExpirados() {
  return request("/manejo-comentado/resumen-expirados");
}

export function getManejoComentadoConductores(params = {}) {
  const query = new URLSearchParams(params).toString();
  return request(`/manejo-comentado/conductores${query ? `?${query}` : ""}`);
}

export function programarCursoManejoComentado(data) {
  return request("/manejo-comentado/cursos", {
    method: "POST",
    body: JSON.stringify(data)
  });
}

export function getCursosManejoComentado() {
  return request("/manejo-comentado/cursos");
}

export function renovarManejoComentadoDirecto(data) {
  return request("/manejo-comentado/renovar", {
    method: "POST",
    body: JSON.stringify(data)
  });
}

export function enviarEvaluacionManejoComentado(data) {
  return request("/manejo-comentado/evaluar", {
    method: "POST",
    body: JSON.stringify(data)
  });
}

export function getAdminAnaliticaCombustible(params = {}) {
  const query = new URLSearchParams();
  if (params.idVehiculo) query.append("idVehiculo", params.idVehiculo);
  if (params.dateFrom) query.append("dateFrom", params.dateFrom);
  if (params.dateTo) query.append("dateTo", params.dateTo);
  const queryString = query.toString();
  return request(`/admin/analitica-combustible${queryString ? `?${queryString}` : ""}`);
}

export function getAdminUsuarios() {
  return request("/admin/usuarios");
}

export function assignUserPin(idUsuario, pin) {
  return request(`/admin/usuarios/${idUsuario}/pin`, {
    method: "POST",
    body: JSON.stringify({ pin })
  });
}


