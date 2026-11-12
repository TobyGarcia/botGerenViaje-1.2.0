import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { ROLES_SUPERVISOR_Y_SUPERIOR } from '../middlewares/admin-auth.middleware.js';
const hash = value => createHash('sha256').update(String(value)).digest();
export function createSupervisorLoginBroker({ now = Date.now, ttl = 5 * 60 * 1000, capacity = 200 } = {}) {
 const tickets = new Map();
 const prune=()=>{for(const[id,t]of tickets)if(t.expiresAt<=now())tickets.delete(id);};
 function requireTicket(state){prune();const id=String(state).replace(/^supervisor_app_/, '');const t=tickets.get(id);if(!t){const error=new Error('El acceso expiró. Inicia sesión de nuevo desde la app.');error.statusCode=410;throw error;}return {id,t};}
 return {
  start(redirectUri){prune();if(tickets.size>=capacity){const e=new Error('Intenta iniciar sesión en unos minutos.');e.statusCode=429;throw e;}
   const id=randomBytes(24).toString('hex'),pollToken=randomBytes(32).toString('hex'),expiresAt=now()+ttl;
   tickets.set(id,{secret:hash(pollToken),redirectUri,expiresAt,result:null});return {ticket:id,pollToken,state:`supervisor_app_${id}`,expiresAt};},
  redirect(state){return requireTicket(state).t.redirectUri;},
  complete(state,{token,user}){const {t}=requireTicket(state);if(t.result)throw new Error('Este acceso ya fue utilizado.');
   if(!ROLES_SUPERVISOR_Y_SUPERIOR.includes(user.rol)){t.result={error:'Tu cuenta no tiene permisos de supervisión.'};const e=new Error(t.result.error);e.statusCode=403;throw e;}
   t.result={token,user};},
  poll(ticket,pollToken){const {id,t}=requireTicket(`supervisor_app_${ticket}`);if(typeof pollToken!=='string'||!timingSafeEqual(t.secret,hash(pollToken))){const e=new Error('Acceso no válido.');e.statusCode=401;throw e;}
   if(!t.result)return {pending:true};const result=t.result;tickets.delete(id);
   if(result.error){const e=new Error(result.error);e.statusCode=403;throw e;}
   return {pending:false,...result};}
 };
}
export const supervisorLoginBroker=createSupervisorLoginBroker();
