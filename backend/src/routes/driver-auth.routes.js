import { Router } from "express";
import { loginDriverWithPinController } from "../controllers/driver-auth.controller.js";

const router = Router();

router.post("/login-pin", loginDriverWithPinController);

export default router;
