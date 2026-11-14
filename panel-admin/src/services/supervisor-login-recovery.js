const KEY='gv_supervisor_login_pending_v1';
export function retryableSupervisorLoginError(error){
 return ['NETWORK_ERROR','NETWORK_TIMEOUT'].includes(error?.code)||error instanceof TypeError||[408,429,500,502,503,504].includes(error?.status);
}
export function pendingSupervisorLogin(storage=globalThis.localStorage,now=Date.now()){
 try{const value=JSON.parse(storage.getItem(KEY)||'null');
  if(value&&/^[a-f0-9]{48}$/.test(value.ticket)&&/^[a-f0-9]{64}$/.test(value.pollToken)&&Number.isFinite(value.expiresAt)&&value.expiresAt>now&&value.expiresAt<=now+5*60*1000)return value;
 }catch{}
 storage.removeItem(KEY);return null;
}
export function saveSupervisorLogin(value,storage=globalThis.localStorage){storage.setItem(KEY,JSON.stringify({ticket:value.ticket,pollToken:value.pollToken,expiresAt:value.expiresAt}));}
export function clearSupervisorLogin(storage=globalThis.localStorage){storage.removeItem(KEY);}
