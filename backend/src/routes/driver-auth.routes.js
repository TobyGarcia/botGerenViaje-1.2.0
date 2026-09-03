import { Router } from "express";
import {
  loginDriverWithPinController,
  getDriverSessionController,
  logoutDriverController
} from "../controllers/driver-auth.controller.js";

const router = Router();

router.post("/login-pin", loginDriverWithPinController);
router.get("/session", getDriverSessionController);
router.post("/logout", logoutDriverController);

export default router;
