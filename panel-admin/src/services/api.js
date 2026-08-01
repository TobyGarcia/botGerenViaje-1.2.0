const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "/api";

async function request(path, options = {}) {
  const response = await fetch(
    `${API_BASE_URL}${path}`,
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
        marca:
          vehiculo.marca,

        modelo:
          vehiculo.modelo,

        numeroEconomico:
          vehiculo.numeroEconomico,

        placas:
          vehiculo.placas
      })
    }
  );
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
