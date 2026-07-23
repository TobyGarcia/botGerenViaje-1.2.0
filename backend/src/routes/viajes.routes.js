import { Router } from "express";

import {
  createTripController
} from "../controllers/viajes.controller.js";

const router = Router();

router.post("/", createTripController);

export default router;