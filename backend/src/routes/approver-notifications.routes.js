import {pushSnapshot} from '../services/approver-push.service.js';
import {Router} from 'express';
import {requireAdminSession,requireAdminRoles,ROLES_SUPERVISOR_Y_SUPERIOR} from '../middlewares/admin-auth.middleware.js';
import {registerApproverDevice,bindApproverToken,approverDevice,revokeApproverDevice,approverFeed} from '../services/approver-notifications.service.js';
const router=Router();
router.post('/devices',requireAdminSession,requireAdminRoles(ROLES_SUPERVISOR_Y_SUPERIOR),async(req,res)=>{
 try{return res.json({success:true,data:await registerApproverDevice(req.adminUser)});}catch{return res.status(500).json({success:false,message:'No se pudieron activar las notificaciones.'});}
});
router.use(async(req,res,next)=>{try{const user=await approverDevice(req.get('X-Notification-Device'),req.get('X-Notification-Key'));if(!user)return res.status(401).json({success:false,message:'Dispositivo no autorizado.'});req.notificationUser=user;next();}catch{return res.status(503).json({success:false,message:'Servicio temporalmente no disponible.'});}});
router.put('/token',async(req,res)=>{try{await bindApproverToken(req.get('X-Notification-Device'),req.get('X-Notification-Key'),req.body?.token);return res.json({success:true});}catch{return res.status(400).json({success:false,message:'No se pudo registrar el teléfono.'});}});
router.get('/feed',async(req,res)=>{res.set('Cache-Control','no-store');try{const feed=await approverFeed(req.notificationUser,req.query.after||'0');const snapshot=pushSnapshot(req.get('X-Notification-Device'),feed);const cursor=snapshot.events.length?snapshot.events.at(-1).id:feed.cursor;return res.json({success:true,data:{...snapshot,cursor,hasMore:cursor!==feed.cursor}});}catch{return res.status(400).json({success:false,message:'No se pudieron consultar los avisos.'});}});
router.delete('/devices/current',async(req,res)=>{await revokeApproverDevice(req.get('X-Notification-Device'),req.get('X-Notification-Key'));return res.json({success:true});});
export default router;
