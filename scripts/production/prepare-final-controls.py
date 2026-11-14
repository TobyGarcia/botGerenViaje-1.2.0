"""Prepare activation and image-only rollback files; never run Compose up/down."""
import argparse,copy,hashlib,json,os,pathlib,subprocess
p=argparse.ArgumentParser();p.add_argument('--directory',required=True);a=p.parse_args()
out=pathlib.Path(a.directory).resolve();assert str(out).startswith('/home/mblanquet/.gv-production-ready/')
os.umask(0o077)
for filename in ['compose.activate.json','compose.rollback.json']:assert not (out/filename).exists(),'Do not overwrite reviewed controls'
base=json.loads((out/'compose.candidate.json').read_text())
current=json.loads(subprocess.check_output(['docker','inspect','viajes-backend','viajes-frontend','viajes-panel-admin','viajes-postgres']))
def fingerprint(rows):return [{'name':r['Name'],'image':r['Image'],'started':r['State']['StartedAt'],'mounts':sorted(r['Mounts'],key=lambda m:m['Destination']),'environmentHash':hashlib.sha256(json.dumps(r['Config']['Env'],sort_keys=True).encode()).hexdigest()} for r in rows]
previous=json.loads((out/'production-before.json').read_text())
for row in previous:row['mounts']=sorted(row['mounts'],key=lambda m:m['Destination'])
assert fingerprint(current)==previous,'Live metadata changed: stop and re-review'
activation={'services':{'backend':{'environment':{'BACKGROUND_TASKS_ENABLED':'true','TELEGRAM_POLLING_ENABLED':'true','APPROVER_PUSH_ENABLED':'true'}}}}
(out/'compose.activate.json').write_text(json.dumps(activation,indent=2))
rollback=copy.deepcopy(base)
for svc in ['backend','frontend','panel-admin']:
 r=next(r for r in current if r['Name']=='/viajes-'+svc);rollback['services'][svc]['image']=r['Image']
 if svc=='backend':
  rollback['services'][svc]['environment']={k:v.replace('$','$$') for k,v in (s.split('=',1) for s in r['Config']['Env']) if k not in {'PATH','NODE_VERSION','YARN_VERSION'}}
  rollback['services'][svc]['command']=r['Config']['Cmd']
  rollback['services'][svc]['volumes']=[v for v in rollback['services'][svc]['volumes'] if v['target']=='/app/uploads']
(out/'compose.rollback.json').write_text(json.dumps(rollback,indent=2))
def render(*files):
 command=['docker','compose','--env-file',str(out/'empty.env'),'-p','botgerenviaje-120']
 for f in files:command+=['-f',str(out/f)]
 return json.loads(subprocess.check_output(command+['config','--format','json']))
guarded=render('compose.candidate.json');activated=render('compose.candidate.json','compose.activate.json');old=render('compose.rollback.json')
assert guarded['services']['backend']['environment']['DATABASE_URL']==activated['services']['backend']['environment']['DATABASE_URL']==old['services']['backend']['environment']['DATABASE_URL']
for cfg in [guarded,activated,old]:
 assert 'postgres' not in cfg['services']
 assert cfg['volumes']['uploads']['external'] is True
 assert cfg['volumes']['uploads']['name']=='viajes_backend_uploads_prod'
for k,v in guarded['services']['backend']['environment'].items():
 if k not in activation['services']['backend']['environment']:assert activated['services']['backend']['environment'][k]==v
assert activated['services']['backend']['environment']['AUTO_MIGRATIONS_ENABLED']=='false'
assert activated['services']['backend']['environment']['AUDIT_RETENTION_ENABLED']=='false'
report=json.loads((out/'configuration-review.json').read_text());report.update({'activationOverlayPrepared':True,'rollbackPrepared':True,'rollbackDatabaseRestore':False,'activationApplied':False,'productionUnchanged':True})
(out/'configuration-review.json').write_text(json.dumps(report,indent=2))
files=['compose.candidate.json','compose.activate.json','compose.rollback.json','configuration-review.json']
(out/'CONFIG_SHA256SUMS').write_text(''.join(hashlib.sha256((out/f).read_bytes()).hexdigest()+'  '+f+'\n' for f in files))
print(json.dumps({'configuration':'validated','activation':'prepared_not_applied','rollback':'images_only_no_database_restore','servicesStarted':False,'productionUnchanged':True}))
