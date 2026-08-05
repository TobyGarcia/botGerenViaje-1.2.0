import { Router } from "express";
import { confirmSupervisorEmailController, registerSupervisorController, supervisorAccessController } from "../controllers/supervisor-telegram.controller.js";
const router = Router();
router.get("/acceso", supervisorAccessController);
router.post("/registro", registerSupervisorController);
router.get("/confirmar-correo", confirmSupervisorEmailController);
export default router;
