import cors from "cors";
import express from "express";
import catalogosRoutes from "./routes/catalogos.routes.js";
import viajesRoutes from "./routes/viajes.routes.js";
import ubicacionesRoutes from "./routes/ubicaciones.routes.js";
import telegramAuthRoutes from "./routes/telegram-auth.routes.js";
import adminConductoresRoutes from "./routes/admin-conductores.routes.js"
import adminVehiculosRoutes from "./routes/admin-vehiculos.routes.js"
import adminDestinosRoutes from "./routes/admin-destinos.routes.js"
import adminUbicacacionesRoutes from "./routes/admin-ubicaciones.routes.js"
import adminViajesRoutes from "./routes/admin-viajes.routes.js"

import healthRoutes from "./routes/health.routes.js";

const app = express();

app.disable("x-powered-by");

function getAllowedOrigins() {
  return String(process.env.CORS_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

const allowedOrigins = getAllowedOrigins();

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.length === 0 ||
          allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(
        new Error("Origen no permitido por CORS.")
      );
    },
    credentials: true
  })
);

app.use(express.json());
app.use(cookieParser());

app.use(express.urlencoded({
  extended: true
}));

app.get("/", (request, response) => {
  return response.status(200).json({
    success: true,
    message:
      "API de Gerenciamiento de Viajes"
  });
});

app.use("/health", healthRoutes);

app.use(
  "/api/catalogos",
  catalogosRoutes
);

app.use(
  "/api/viajes",
  viajesRoutes
);

app.use(
  "/api/viajes/:idViaje/ubicaciones",
  ubicacionesRoutes
);

app.use(
  "/api/telegram",
  telegramAuthRoutes
);

app.use(
  "/api/admin/auth",
  adminAuthRoutes
);

app.use(
  "/api/admin/conductores",
  adminConductoresRoutes
);

app.use(
  "/api/admin/vehiculos",
  adminVehiculosRoutes
);

app.use(
  "/api/admin/destinos",
  adminDestinosRoutes
);

app.use(
  "/api/admin/ubicaciones-viaje",
  adminUbicacacionesRoutes
);

app.use (
  "/api/admin/viajes",
  adminViajesRoutes
);

app.use((request, response) => {
  return response.status(404).json({
    success: false,
    message: "Ruta no encontrada."
  });
});

app.use(
  (error, request, response, next) => {
    console.error(
      "Error no controlado:",
      error
    );

    return response.status(500).json({
      success: false,
      message:
        "Ocurrió un error interno en el servidor."
    });
  }
);

import cookieParser
  from "cookie-parser";

import adminAuthRoutes
  from "./routes/admin-auth.routes.js";

export default app;
