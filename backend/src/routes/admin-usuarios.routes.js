import { Router } from "express";
import { requireAdminRoles, requireAdminSession, ROLES_SUPERVISOR_Y_SUPERIOR } from "../middlewares/admin-auth.middleware.js";
import { createAdminUserController, deleteAdminUserController, listAdminUsersController, updateAdminUserController, updateOwnProfileController } from "../controllers/admin-usuarios.controller.js";

const router = Router();
router.use(requireAdminSession);
router.get("/perfil", (req, res) => res.json({ success: true, data: req.adminUser }));
router.patch("/perfil", updateOwnProfileController);

router.get("/", requireAdminRoles(ROLES_SUPERVISOR_Y_SUPERIOR), listAdminUsersController);
router.post("/", requireAdminRoles("ADMINISTRADOR"), createAdminUserController);
router.patch("/:idUsuario", requireAdminRoles("ADMINISTRADOR"), updateAdminUserController);
router.delete("/:idUsuario", requireAdminRoles("ADMINISTRADOR"), deleteAdminUserController);

export default router;
