import { Router } from "express";
import {
  loginDriverWithPinController,
  getDriverSessionController,
  logoutDriverController,
  updateDriverProfileController
} from "../controllers/driver-auth.controller.js";
import { requireActiveDriver } from "../middlewares/driver-auth.middleware.js";

const router = Router();

router.post("/login-pin", loginDriverWithPinController);
router.get("/session", getDriverSessionController);
router.post("/logout", logoutDriverController);
router.patch("/perfil", requireActiveDriver, updateDriverProfileController);

export default router;
