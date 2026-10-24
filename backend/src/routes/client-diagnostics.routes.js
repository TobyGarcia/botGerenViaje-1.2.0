import { Router } from "express";
import { requireActiveDriver } from "../middlewares/driver-auth.middleware.js";
import { requireAdminSession } from "../middlewares/admin-auth.middleware.js";
import { receiveDiagnostics } from "../services/client-diagnostics.service.js";
const router = Router();
router.post("/driver", requireActiveDriver, receiveDiagnostics);
router.post("/admin", requireAdminSession, receiveDiagnostics);
export default router;
