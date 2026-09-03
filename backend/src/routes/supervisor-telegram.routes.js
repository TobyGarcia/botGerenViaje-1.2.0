import { Router } from "express";
import { requireOptionalAdminSession } from "../middlewares/admin-auth.middleware.js";
import { confirmSupervisorEmailController, linkExistingSupervisorController, linkSupervisorByEmailController, registerSupervisorController, supervisorAccessController } from "../controllers/supervisor-telegram.controller.js";

const router = Router();
router.use(requireOptionalAdminSession);

router.get("/acceso", supervisorAccessController);
router.post("/registro", registerSupervisorController);
router.post("/vincular-cuenta", linkExistingSupervisorController);
router.post("/ingresar-correo", linkSupervisorByEmailController);
router.get("/confirmar-correo", confirmSupervisorEmailController);
export default router;

