import cors from "cors";
import express from "express";
import catalogosRoutes from "./routes/catalogos.routes.js";
import viajesRoutes from "./routes/viajes.routes.js";
import ubicacionesRoutes from "./routes/ubicaciones.routes.js";

import healthRoutes from "./routes/health.routes.js";

const app = express();

app.disable("x-powered-by");

app.use(
  cors({
    origin: true,
    credentials: false
  })
);

app.use(express.json());

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



export default app;
