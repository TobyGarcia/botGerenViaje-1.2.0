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