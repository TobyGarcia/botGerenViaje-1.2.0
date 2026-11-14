import test from 'node:test';import assert from 'node:assert/strict';
import{retryableSupervisorLoginError,pendingSupervisorLogin,saveSupervisorLogin,clearSupervisorLogin}from'../src/services/supervisor-login-recovery.js';
const storage=()=>{const m=new Map();return{getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)};};
test('conserva el acceso al reabrir y lo elimina al confirmar, cancelar o expirar',()=>{
 const s=storage(),now=1000,ticket={ticket:'a'.repeat(48),pollToken:'b'.repeat(64),expiresAt:now+300000};saveSupervisorLogin(ticket,s);assert.deepEqual(pendingSupervisorLogin(s,now),ticket);
 assert.equal(pendingSupervisorLogin(s,ticket.expiresAt),null);saveSupervisorLogin(ticket,s);clearSupervisorLogin(s);assert.equal(pendingSupervisorLogin(s,now),null);
});
test('reintenta fallos transitorios sin tratar credenciales inválidas como problemas de red',()=>{
 for(const code of ['NETWORK_ERROR','NETWORK_TIMEOUT'])assert.equal(retryableSupervisorLoginError({code}),true);
 for(const status of [408,429,500,502,503,504])assert.equal(retryableSupervisorLoginError({status}),true);
 for(const status of [400,401,403,410])assert.equal(retryableSupervisorLoginError({status}),false);
 assert.equal(retryableSupervisorLoginError(new TypeError('fetch failed')),true);
});
