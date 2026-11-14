import {driverInspectionRejections,rejectionMessage} from './driver-inspection-rejection.service.js';
import {findTelegramUserByConductorId} from './telegram-user.service.js';
import {sendDriverRejectionMessage} from '../bot/bot.js';
export async function notifyDriverRejection(inspection){
 try{
 const [notice]=await driverInspectionRejections(inspection.id_conductores,inspection.id_inspeccion);
 if(!notice)return;
 const user=await findTelegramUserByConductorId(inspection.id_conductores);
 await sendDriverRejectionMessage(user?.telegram_user_id,rejectionMessage(notice));
 }catch(error){console.error('No fue posible preparar el aviso de rechazo:',error.message);}
}
