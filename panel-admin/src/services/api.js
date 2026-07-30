const API_BASE_URL = "/api";

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
