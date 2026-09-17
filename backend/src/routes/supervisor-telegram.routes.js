import { Router } from "express";
import { requireOptionalAdminSession } from "../middlewares/admin-auth.middleware.js";
import {
  linkSupervisorByEmailController,
  supervisorAccessController
} from "../controllers/supervisor-telegram.controller.js";

const router = Router();
router.use(requireOptionalAdminSession);

router.get("/acceso", supervisorAccessController);
router.post("/ingresar-correo", linkSupervisorByEmailController);

export default router;
