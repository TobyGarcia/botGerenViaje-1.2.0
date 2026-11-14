"""Publish the two immutable, previously validated production APK candidates."""
import hashlib,json,pathlib,subprocess,urllib.request,urllib.error,urllib.parse
root=pathlib.Path(__file__).resolve().parents[2]
repository='TobyGarcia/botGerenViaje-1.2.0'
credential=subprocess.run(['git','credential','fill'],input='protocol=https\nhost=github.com\n\n',text=True,capture_output=True,check=True)
values=dict(x.split('=',1) for x in credential.stdout.splitlines() if '=' in x)
token=values['password'];base='https://api.github.com/repos/'+repository
def api(path,method='GET',body=None,binary=None,content_type=None):
 data=binary if binary is not None else json.dumps(body).encode() if body is not None else None
 request=urllib.request.Request(path if path.startswith('https://') else base+path,data=data,method=method,headers={'Authorization':'Bearer '+token,'Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','Content-Type':content_type or 'application/json'})
 with urllib.request.urlopen(request,timeout=180) as response:return json.load(response)
candidates=[
 ('driver','7c65995744c234079b747cf308894d26bfdbf800','driver','gv-mobility.apk','f71d333a65e21e9226d77ff60a1525ee1187ce9bcf873a8f1703620565e4fc32','GV Mobility Conductor 1.3.0','Actualización productiva del conductor. Incluye gestión de acompañantes y remolques, sincronización de pendientes y corrección del aviso repetido de inspección rechazada. Actualizar sobre la instalación existente, sin desinstalar ni borrar datos.'),
 ('supervisor','94a3471f68e8352285972913c78040aa84b70932','approvers','gv-supervisor.apk','767bc793999e8a6d393b90cc2a84c3d6201cdd8c2c0ecfbddc673265ccbd68c7','GV Mobility Aprobadores 1.0.0','Primera versión productiva para aprobadores. Incluye inicio con Microsoft, pendientes por rol, detalle e inspección, aprobación conjunta y notificaciones de solicitudes. Utiliza el paquete y Firebase productivos; es una aplicación distinta de la de pruebas.')
]
prepared=[]
for app,sha,folder,filename,expected,title,notes in candidates:
 directory=root/'output'/'releases'/sha/folder
 manifest=json.loads((directory/'update.json').read_text());validation=json.loads((directory/'validation.json').read_text());apk=(directory/filename).read_bytes()
 assert hashlib.sha256(apk).hexdigest()==expected==manifest['sha256']
 assert validation['signerSha256']=='bb7eed6e260e018468ed300945312734c0bf05270415c6c7ac984c1e4e5849e4'
 assert manifest['channel']=='stable' and validation['apiBase']=='https://gv.aspromex.mx'
 tag=manifest['downloadUrl'].split('/')[-2]
 try:release=api('/releases/tags/'+tag)
 except urllib.error.HTTPError as error:
  if error.code!=404:raise
  release=api('/releases','POST',{'tag_name':tag,'target_commitish':sha,'name':title,'body':notes,'draft':True,'prerelease':False,'make_latest':'false'})
 assert release['tag_name']==tag and not release['prerelease']
 for asset_name,data,content_type in [(filename,apk,'application/vnd.android.package-archive'),('update.json',(directory/'update.json').read_bytes(),'application/json')]:
  expected_digest='sha256:'+hashlib.sha256(data).hexdigest()
  asset=next((a for a in release['assets'] if a['name']==asset_name),None)
  if asset is None:
   assert release['draft'],'Never modify an incomplete published release automatically'
   asset=api(release['upload_url'].split('{')[0]+'?name='+urllib.parse.quote(asset_name),method='POST',binary=data,content_type=content_type)
  assert asset['size']==len(data) and asset.get('digest')==expected_digest,'Uploaded asset digest mismatch'
 print('ASSETS_VERIFIED',tag,flush=True);prepared.append((release,manifest,expected))
for release,manifest,expected in prepared:
 if release['draft']:release=api('/releases/'+str(release['id']),'PATCH',{'draft':False,'prerelease':False,'make_latest':'false'})
 assert not release['draft']
 # Public download is verified without sending GitHub credentials to asset hosts.
 with urllib.request.urlopen(manifest['downloadUrl'],timeout=180) as response:download=response.read()
 assert hashlib.sha256(download).hexdigest()==expected
 print('PUBLISHED_AND_DOWNLOAD_VERIFIED',release['html_url'],flush=True)
