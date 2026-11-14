import {apiFetch} from './http-transport.js';
export function approvalPdfPath(kind,id){
 if(!['inspection','management'].includes(kind)||!/^\d{1,16}$/.test(String(id))||Number(id)<1||!Number.isSafeInteger(Number(id)))throw Error('Documento inválido.');
 return kind==='inspection'?`/admin/inspecciones/${id}/vista-previa-pdf`:`/gerenciamiento-viajes/${id}/vista-previa-pdf`;
}
export async function loadApprovalPdf({kind,id,signal},fetcher=apiFetch){
 const base=String(import.meta.env?.VITE_API_BASE_URL||'').replace(/\/+$/,'').replace(/\/api$/,'');
 const token=globalThis.localStorage?.getItem('gv_supervisor_token')||globalThis.localStorage?.getItem('adminToken');
 const response=await fetcher(base+'/api'+approvalPdfPath(kind,id),{signal,cache:'no-store',credentials:'include',responseType:'arraybuffer',headers:{Accept:'application/pdf',...(token?{Authorization:`Bearer ${token}`}:{})}});
 if(!response.ok)throw Error(response.status===401?'La sesión expiró. Vuelve a iniciar sesión.':'No se pudo cargar el PDF. Reintenta con conexión.');
 const bytes=new Uint8Array(await response.arrayBuffer());
 if(bytes.length>64*1024*1024)throw Error('El documento es demasiado grande para abrirlo en el visor.');
 if(bytes.length<5||String.fromCharCode(...bytes.slice(0,5))!=='%PDF-')throw Error('El servidor no devolvió un PDF válido.');
 return bytes;
}
