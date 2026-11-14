import {driverInspectionRejections} from '../services/driver-inspection-rejection.service.js';
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
router.get('/inspection-rejections',requireActiveDriver,async(req,res)=>{
 try{res.set('Cache-Control','no-store').json({success:true,data:await driverInspectionRejections(req.driverUser.id_conductores)});}
 catch{res.status(500).json({success:false,message:'No fue posible consultar los avisos de inspección.'});}
});
router.patch("/perfil", requireActiveDriver, updateDriverProfileController);

export default router;
