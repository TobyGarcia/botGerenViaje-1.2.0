import {
  Router
} from "express";

import {
  getAdminSessionController,
  initiateAzureOAuthLoginController,
  azureOAuthCallbackController,
  exchangeAzureOAuthCodeController,
  loginAdminController,
  loginWithTenantEmailController,
  logoutAdminController
} from "../controllers/admin-auth.controller.js";

import {
  requireAdminSession
} from "../middlewares/admin-auth.middleware.js";

const router = Router();

router.post(
  "/login",
  loginAdminController
);

router.post(
  "/tenant-login",
  loginWithTenantEmailController
);

router.get(
  "/azure/login",
  initiateAzureOAuthLoginController
);

router.get(
  "/azure/callback",
  azureOAuthCallbackController
);

router.post(
  "/azure/exchange-code",
  exchangeAzureOAuthCodeController
);

router.get(
  "/session",
  requireAdminSession,
  getAdminSessionController
);

router.post(
  "/logout",
  requireAdminSession,
  logoutAdminController
);

export default router;