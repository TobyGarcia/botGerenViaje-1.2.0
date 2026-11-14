"""Read active Docker metadata; write an INACTIVE candidate config, never deploy it.
No database connection, shell interpolation of secrets, or production file edits.
Run with Docker read access. Generated environment/Compose files are PRIVATE.
"""
import argparse, hashlib, json, os, pathlib, subprocess

p=argparse.ArgumentParser();p.add_argument('--directory',required=True);args=p.parse_args()
out=pathlib.Path(args.directory).resolve()
assert str(out).startswith('/home/mblanquet/.gv-production-ready/'), 'Unexpected output directory'
assert not (out/'compose.candidate.json').exists(), 'Candidate already exists; do not overwrite reviewed configuration'
os.umask(0o077);out.mkdir(parents=True,exist_ok=True);os.chmod(out,0o700)
def docker(*argv):return json.loads(subprocess.check_output(['docker',*argv]))
names=['viajes-backend','viajes-frontend','viajes-panel-admin','viajes-postgres']
active=docker('inspect',*names);byname={v['Name'].lstrip('/'):v for v in active}
for v in active:assert v['Config']['Labels'].get('com.docker.compose.project')=='botgerenviaje-120'
def fingerprint(rows):
 return [{'name':r['Name'],'image':r['Image'],'started':r['State']['StartedAt'],'mounts':sorted(r['Mounts'],key=lambda m:m['Destination']),
  'environmentHash':hashlib.sha256(json.dumps(r['Config']['Env'],sort_keys=True).encode()).hexdigest()} for r in rows]
(out/'production-before.json').write_text(json.dumps(fingerprint(active),indent=2))
images=json.loads((out/'images.json').read_text());source=(out/'source.txt').read_text().strip()
assert len(source)==40 and all(c in '0123456789abcdef' for c in source)
image_map={}
for svc in ['backend','frontend','panel-admin']:
 tag=f'gv-production-{svc}:candidate-{source}'
 image=next(i for i in images if tag in i['RepoTags'])
 assert image['Config']['Labels']['org.opencontainers.image.revision']==source
 image_map[svc]=image['Id']
secret=out/'secrets/firebase-service-account.json'
account=json.loads(secret.read_text());assert account['type']=='service_account' and account['project_id']=='gvmobilityproduccion'
os.chmod(secret,0o600)
system={'PATH','NODE_VERSION','YARN_VERSION'}
env={k:v for k,v in (e.split('=',1) for e in byname['viajes-backend']['Config']['Env']) if k not in system}
from urllib.parse import urlparse
assert urlparse(env['DATABASE_URL']).path=='/gerenciamiento_viajes_prod'
assert env.get('NODE_ENV')=='production'
oldenv=env.copy()
updates={'APPROVER_ENVIRONMENT':'stable','APPROVER_FIREBASE_PROJECT_ID':'gvmobilityproduccion','APPROVER_PUSH_ENABLED':'false',
 'GOOGLE_APPLICATION_CREDENTIALS':'/run/secrets/approver-production-firebase.json','ANDROID_UPDATE_DISCOVERY':'stable',
 'AUTO_MIGRATIONS_ENABLED':'false','BACKGROUND_TASKS_ENABLED':'false','AUDIT_RETENTION_ENABLED':'false','TELEGRAM_POLLING_ENABLED':'false'}
env.update(updates)
config={'name':'botgerenviaje-120','services':{},'networks':{},'volumes':{}}
for svc in ['backend','frontend','panel-admin']:
 r=byname['viajes-'+svc]
 service={'image':image_map[svc],'container_name':'viajes-'+svc,'restart':r['HostConfig']['RestartPolicy']['Name'] or 'unless-stopped','networks':{}}
 for network,data in r['NetworkSettings']['Networks'].items():
  key=network
  config['networks'][key]={'external':True,'name':network}
  service['networks'][key]={'aliases':[svc]}
 ports=[]
 for target,bindings in (r['HostConfig']['PortBindings'] or {}).items():
  number,protocol=target.split('/')
  for bind in bindings or []:
   assert bind['HostIp']=='127.0.0.1','Unexpected public binding requires review'
   ports.append({'target':int(number),'published':bind['HostPort'],'host_ip':bind['HostIp'],'protocol':protocol})
 if ports:service['ports']=ports
 check=r['Config'].get('Healthcheck')
 if check:
  service['healthcheck']={'test':check['Test']}
  for name,key in [('Interval','interval'),('Timeout','timeout'),('StartPeriod','start_period')]:
   if check.get(name):service['healthcheck'][key]=str(check[name])+'ns'
  if check.get('Retries'):service['healthcheck']['retries']=check['Retries']
 if svc=='backend':
  service['environment']=env
  service['command']=['npm','start']
  service['volumes']=[]
  for mount in r['Mounts']:
   assert mount['Type']=='volume' and mount['Name']=='viajes_backend_uploads_prod' and mount['Destination']=='/app/uploads','Unexpected backend mount requires review'
   config['volumes']['uploads']={'external':True,'name':mount['Name']}
   service['volumes'].append({'type':'volume','source':'uploads','target':'/app/uploads','read_only':not mount['RW']})
  service['volumes'].append({'type':'bind','source':str(secret),'target':'/run/secrets/approver-production-firebase.json','read_only':True})
 config['services'][svc]=service
# Escape literal dollar signs so Compose cannot silently change existing secrets.
def escape(x):
 if isinstance(x,str):return x.replace('$','$$')
 if isinstance(x,dict):return {k:escape(v) for k,v in x.items()}
 if isinstance(x,list):return [escape(v) for v in x]
 return x
(out/'compose.candidate.json').write_text(json.dumps(escape(config),indent=2))
(out/'empty.env').write_text('')
rendered=json.loads(subprocess.check_output(['docker','compose','--env-file',str(out/'empty.env'),'-p','botgerenviaje-120','-f',str(out/'compose.candidate.json'),'config','--format','json']))
actual=rendered['services']['backend']['environment']
assert actual==env,'Compose altered environment values'
assert 'postgres' not in rendered['services'] and all('postgres_data' not in k for k in rendered.get('volumes',{}))
for key,value in oldenv.items():
 if key not in updates:assert actual[key]==value
assert fingerprint(docker('inspect',*names))==fingerprint(active),'Production changed while preparing; re-review'
report={'status':'PREPARED_NOT_AUTHORIZED','source':source,'images':image_map,'productionEnvironmentPreserved':True,
 'changedEnvironmentKeys':sorted(updates),'postgresServiceDefined':False,'productionDatabaseMounted':False,
 'databaseUrlPreserved':True,'credentialsReadOnly':True,'servicesStarted':False,'mergePerformed':False,
 'apkPublished':False,'readiness':{'microsoftSecretPresent':bool(env.get('AZURE_CLIENT_SECRET')),'sharepointSitePresent':bool(env.get('SHAREPOINT_SITE_ID')),
 'sharepointUrlPresent':bool(env.get('SHAREPOINT_URL')),'telegramConfigured':bool(env.get('TELEGRAM_BOT_TOKEN'))}}
(out/'configuration-review.json').write_text(json.dumps(report,indent=2))
os.chmod(out/'compose.candidate.json',0o600)
print(json.dumps(report))
