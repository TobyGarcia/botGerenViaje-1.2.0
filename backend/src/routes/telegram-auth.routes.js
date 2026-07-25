import {
  Router
} from "express";

import {
  authenticateTelegramController,
  registerTelegramDriverController
} from "../controllers/telegram-auth.controller.js";

const router = Router();

router.post(
  "/autenticar",
  authenticateTelegramController
);

router.post(
  "/registro-conductor",
  registerTelegramDriverController
);

export default router;
