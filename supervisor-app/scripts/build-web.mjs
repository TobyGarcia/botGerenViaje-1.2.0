import {execFileSync} from 'node:child_process';import{cpSync,rmSync,existsSync}from'node:fs';import{resolve}from'node:path';import{fileURLToPath}from'node:url';
const root=resolve(fileURLToPath(new URL('../..',import.meta.url)));
const app=resolve(root,'supervisor-app');
execFileSync(process.platform==='win32'?'npm.cmd':'npm',['run','build'],{cwd:resolve(root,'panel-admin'),stdio:'inherit',shell:process.platform==='win32',env:{...process.env,VITE_SUPERVISOR_APP:'true',VITE_API_BASE_URL:'https://gvmobility.aspromex.mx'}});
const target=resolve(app,'dist');if(existsSync(target))rmSync(target,{recursive:true});cpSync(resolve(root,'panel-admin/dist'),target,{recursive:true});
