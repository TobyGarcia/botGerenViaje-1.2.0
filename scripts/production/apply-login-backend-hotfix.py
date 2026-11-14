"""Replace only an existing backend, preserving runtime environment and mounts."""
import argparse,json,os,pathlib,subprocess,time,urllib.parse
p=argparse.ArgumentParser();p.add_argument('--container',choices=['gvmobility-backend','viajes-backend'],required=True);p.add_argument('--image',required=True);a=p.parse_args()
source='52bbf5b6aa41a65e08200e5f9f09b167c12b4331';os.umask(0o077)
old=json.loads(subprocess.check_output(['docker','inspect',a.container]))[0]
image=json.loads(subprocess.check_output(['docker','image','inspect',a.image]))[0]
assert image['Config']['Labels']['org.opencontainers.image.revision']==source
expected_project='gvmobility' if a.container=='gvmobility-backend' else 'botgerenviaje-120'
assert old['Config']['Labels']['com.docker.compose.project']==expected_project
out=pathlib.Path('/home/mblanquet/.gv-login-fix-52bbf5b')/a.container;out.mkdir(parents=True,mode=0o700,exist_ok=False)
(out/'before.json').write_text(json.dumps(old,indent=2))
env=dict(v.split('=',1) for v in old['Config']['Env'] if v.split('=',1)[0] not in ['PATH','NODE_VERSION','YARN_VERSION'])
assert urllib.parse.unquote(urllib.parse.urlsplit(env['DATABASE_URL']).path.lstrip('/'))==('gerenciamiento_viajes_stg' if a.container=='gvmobility-backend' else 'gerenciamiento_viajes_prod')
service={'image':image['Id'],'pull_policy':'never','container_name':a.container,'environment':env,'restart':old['HostConfig']['RestartPolicy']['Name'],'command':old['Config']['Cmd'],'ports':[],'volumes':[],'networks':[]}
config={'services':{'backend':service},'networks':{}};volumes={}
for n,network in enumerate(old['NetworkSettings']['Networks']):
 alias='network'+str(n);config['networks'][alias]={'external':True,'name':network};service['networks'].append(alias)
for port,bindings in (old['HostConfig']['PortBindings'] or {}).items():
 for b in bindings or []:
  assert b['HostIp']=='127.0.0.1';target,protocol=port.split('/');service['ports'].append({'target':int(target),'published':b['HostPort'],'host_ip':b['HostIp'],'protocol':protocol})
for i,m in enumerate(old['Mounts']):
 mount={'type':m['Type'],'target':m['Destination'],'read_only':not m['RW']}
 if m['Type']=='volume':
  alias='volume'+str(i);volumes[alias]={'external':True,'name':m['Name']};mount['source']=alias
 else:assert m['Type']=='bind';mount['source']=m['Source']
 service['volumes'].append(mount)
if volumes:config['volumes']=volumes
health=old['Config'].get('Healthcheck')
if health:
 service['healthcheck']={k:(str(v)+'ns' if k in ['interval','timeout','start_period','start_interval'] else v) for k,v in { {'Test':'test','Interval':'interval','Timeout':'timeout','Retries':'retries','StartPeriod':'start_period','StartInterval':'start_interval'}[k]:v for k,v in health.items() if k in ['Test','Interval','Timeout','Retries','StartPeriod','StartInterval']}.items()}
def escape(v):
 if isinstance(v,str):return v.replace('$','$$')
 if isinstance(v,dict):return{k:escape(x) for k,x in v.items()}
 if isinstance(v,list):return[escape(x) for x in v]
 return v
config=escape(config);(out/'candidate.json').write_text(json.dumps(config,indent=2));config['services']['backend']['image']=old['Image'];(out/'rollback.json').write_text(json.dumps(config,indent=2));(out/'empty.env').write_text('')
def command(filename,*args):return['docker','compose','--env-file',str(out/'empty.env'),'-p',expected_project,'-f',str(out/filename),*args]
rendered=json.loads(subprocess.check_output(command('candidate.json','config','--format','json')))
assert list(rendered['services'])==['backend'];assert rendered['services']['backend']['environment']==env
uploads=None
if not any(m['Destination']=='/app/uploads' for m in old['Mounts']) and subprocess.run(['docker','exec',a.container,'test','-d','/app/uploads'],capture_output=True).returncode==0:
 uploads=out/'uploads';uploads.mkdir(mode=0o700);subprocess.run(['docker','cp',a.container+':/app/uploads/.',str(uploads)],check=True)
try:
 with (out/'deploy.log').open('w') as log:subprocess.run(command('candidate.json','up','-d','--no-build','--no-deps','backend'),stdout=log,stderr=log,check=True)
 if uploads:subprocess.run(['docker','cp',str(uploads)+'/.',a.container+':/app/uploads'],check=True)
 for _ in range(40):
  current=json.loads(subprocess.check_output(['docker','inspect',a.container]))[0]
  if current['State'].get('Health',{}).get('Status')=='healthy':break
  time.sleep(1)
 assert current['State'].get('Health',{}).get('Status')=='healthy'
 assert current['Image']==image['Id']
 actual=dict(v.split('=',1) for v in current['Config']['Env']);assert all(actual[k]==v for k,v in env.items())
 assert sorted(old['Mounts'],key=lambda m:m['Destination'])==sorted(current['Mounts'],key=lambda m:m['Destination'])
 (out/'after.json').write_text(json.dumps(current,indent=2));print(json.dumps({'container':a.container,'healthy':True,'environmentPreserved':True,'mountsPreserved':True,'databaseMigrations':False,'source':source,'image':image['Id']}))
except:
 subprocess.run(command('rollback.json','up','-d','--no-build','--no-deps','backend'),check=True)
 if uploads:subprocess.run(['docker','cp',str(uploads)+'/.',a.container+':/app/uploads'],check=True)
 raise
