// Serve the production bundle with read-only API fixtures injected before boot.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
const root=resolve('panel-admin/dist');
const scene=await readFile('panel-admin/tools/supervisor/scene.jsx','utf8');
const fixture=scene.slice(scene.indexOf('const fixtureFetch='),scene.indexOf('createRoot(document'))+';';
// Two-page synthetic PDF; no operational or personal data is used in viewer tests.
function qaPdf(){
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>',
 '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 6 0 R >>',
 '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 7 0 R >>',
 '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
 for(let i=1;i<=2;i++){const text=`BT /F1 24 Tf 40 730 Td (PDF DE PRUEBA - PAGINA ${i}) Tj ET`;objects.push(`<< /Length ${text.length} >>\nstream\n${text}\nendstream`);}
 let pdf='%PDF-1.4\n',offsets=[0];for(let i=0;i<objects.length;i++){offsets.push(Buffer.byteLength(pdf));pdf+=`${i+1} 0 obj\n${objects[i]}\nendobj\n`;}
 const xref=Buffer.byteLength(pdf);pdf+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`;for(const offset of offsets.slice(1))pdf+=String(offset).padStart(10,'0')+' 00000 n \n';
 return Buffer.from(pdf+`trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
}
const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.json':'application/json'};
createServer(async(req,res)=>{try{const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(path==='/__qa_pdf'){res.writeHead(200,{'Content-Type':'application/pdf'}).end(qaPdf());return;}const file=resolve(root,'.'+(path==='/'?'/index.html':path));if(!file.startsWith(root+sep)){res.writeHead(403).end();return;}let data=await readFile(file);if(extname(file)==='.html')data=Buffer.from(data.toString().replace('<head>','<head><script>'+fixture+'</script>'));res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream'});res.end(data);}catch{res.writeHead(404).end();}}).listen(Number(process.env.SUPERVISOR_QA_PORT||5179),'127.0.0.1',()=>console.log('Read-only production QA http://127.0.0.1:5179'));
