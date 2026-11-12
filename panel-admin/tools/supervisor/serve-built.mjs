// Serve the production bundle with read-only API fixtures injected before boot.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
const root=resolve('panel-admin/dist');
const scene=await readFile('panel-admin/tools/supervisor/scene.jsx','utf8');
const fixture=scene.slice(scene.indexOf('const role='),scene.indexOf(';createRoot'))+';';
const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.json':'application/json'};
createServer(async(req,res)=>{try{const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);const file=resolve(root,'.'+(path==='/'?'/index.html':path));if(!file.startsWith(root+sep)){res.writeHead(403).end();return;}let data=await readFile(file);if(extname(file)==='.html')data=Buffer.from(data.toString().replace('<head>','<head><script>'+fixture+'</script>'));res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream'});res.end(data);}catch{res.writeHead(404).end();}}).listen(5179,'127.0.0.1',()=>console.log('Read-only production QA http://127.0.0.1:5179'));
