import { Router } from "express";
import { requireAdminRoles, requireAdminSession, ROLES_SUPERVISOR_Y_SUPERIOR } from "../middlewares/admin-auth.middleware.js";
import { assignAdminUserPinController, createAdminUserController, deleteAdminUserController, listAdminUsersController, registerPublicUserController, updateAdminUserController, updateOwnProfileController } from "../controllers/admin-usuarios.controller.js";

const router = Router();

// Endpoint público para registro inicial de nuevos usuarios
router.post("/registro-publico", registerPublicUserController);

router.use(requireAdminSession);
router.get("/perfil", (req, res) => res.json({ success: true, data: req.adminUser }));
router.patch("/perfil", updateOwnProfileController);

router.get("/", requireAdminRoles(ROLES_SUPERVISOR_Y_SUPERIOR), listAdminUsersController);
router.post("/", requireAdminRoles("ADMINISTRADOR"), createAdminUserController);
router.patch("/:idUsuario", requireAdminRoles("ADMINISTRADOR"), updateAdminUserController);
router.post("/:idUsuario/pin", requireAdminRoles("ADMINISTRADOR"), assignAdminUserPinController);
router.delete("/:idUsuario", requireAdminRoles("ADMINISTRADOR"), deleteAdminUserController);

export default router;
