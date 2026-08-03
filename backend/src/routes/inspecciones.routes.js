import { Router } from "express";
import { getInspectionRequirementController, saveInspectionController } from "../controllers/inspecciones.controller.js";

const router = Router({ mergeParams: true });
router.get("/", getInspectionRequirementController);
router.post("/", saveInspectionController);
export default router;
