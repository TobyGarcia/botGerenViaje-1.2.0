import { test } from "node:test";
import assert from "node:assert/strict";
import { androidUpdateController } from "../controllers/android-update.controller.js";

test("no ofrece versiones sin configurar y rechaza enlaces de otros repositorios", async () => {
  const previous = process.env.ANDROID_UPDATE_TESTING;
  const response = () => ({ code: 200, set() {}, status(code) { this.code = code; return this; }, json(data) { this.data = data; return this; } });
  try {
    delete process.env.ANDROID_UPDATE_TESTING;
    const empty = response();
    await androidUpdateController({ query: {} }, empty);
    assert.equal(empty.data.available, false);
    process.env.ANDROID_UPDATE_TESTING = JSON.stringify({ versionCode: 2, versionName: "1.1.0", channel: "testing", sha256: "a".repeat(64), downloadUrl: "https://github.com/other/repository/releases/download/v1/app.apk" });
    const invalid = response();
    await androidUpdateController({ query: {} }, invalid);
    assert.equal(invalid.code, 503);
    const validManifest = JSON.parse(process.env.ANDROID_UPDATE_TESTING);
    validManifest.downloadUrl = "https://github.com/TobyGarcia/botGerenViaje-1.2.0/releases/download/test/gv-mobility.apk";
    process.env.ANDROID_UPDATE_TESTING = JSON.stringify(validManifest);
    const valid = response();
    await androidUpdateController({ query: {} }, valid);
    assert.equal(valid.data.versionCode, 2);
    assert.equal(valid.data.available, true);
  } finally {
    if (previous === undefined) delete process.env.ANDROID_UPDATE_TESTING;
    else process.env.ANDROID_UPDATE_TESTING = previous;
  }
});

test("descubre solo releases publicados del canal testing y selecciona mayor código", async () => {
  const originalFetch = globalThis.fetch;
  const previous = process.env.ANDROID_UPDATE_DISCOVERY;
  const previousRaw = process.env.ANDROID_UPDATE_TESTING;
  const base = "https://github.com/TobyGarcia/botGerenViaje-1.2.0/releases/download/";
  const release = (code, draft = false) => ({ tag_name: `android-testing-v1.1.0-${code}`, draft, prerelease: true,
    assets: ["update.json", "gv-mobility.apk"].map((name) => ({ name, browser_download_url: `${base}android-testing-v1.1.0-${code}/${name}` })) });
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(url);
    return { ok: true, json: async () => url.startsWith("https://api.github.com/")
      ? [release(99, true), release(2), release(3)]
      : { versionCode: 3, versionName: "1.1.0", channel: "testing", sha256: "a".repeat(64), downloadUrl: `${base}android-testing-v1.1.0-3/gv-mobility.apk` } };
  };
  try {
    process.env.ANDROID_UPDATE_DISCOVERY = "testing";
    delete process.env.ANDROID_UPDATE_TESTING;
    const response = { set() {}, status() { return this; }, json(value) { this.value = value; } };
    await androidUpdateController({ query: { channel: "testing" } }, response);
    assert.equal(response.value.versionCode, 3);
    assert.equal(response.value.available, true);
    await androidUpdateController({ query: { channel: "testing" } }, response);
    assert.equal(calls.length, 2);
    await androidUpdateController({ query: { channel: "stable" } }, response);
    assert.equal(response.value.available, false);
  } finally {
    globalThis.fetch = originalFetch;
    if (previous === undefined) delete process.env.ANDROID_UPDATE_DISCOVERY;
    else process.env.ANDROID_UPDATE_DISCOVERY = previous;
    if (previousRaw === undefined) delete process.env.ANDROID_UPDATE_TESTING;
    else process.env.ANDROID_UPDATE_TESTING = previousRaw;
  }
});

test("aprobadores descubre su propio canal, ignora conductor y borradores", async()=>{
 const originalFetch=globalThis.fetch,previous=process.env.ANDROID_UPDATE_DISCOVERY;
 const base='https://github.com/TobyGarcia/botGerenViaje-1.2.0/releases/download/';
 const release=(code,draft=false)=>({tag_name:`android-supervisor-testing-v0.1.4-${code}`,draft,prerelease:true,assets:['update.json','gv-supervisor.apk'].map(name=>({name,browser_download_url:`${base}android-supervisor-testing-v0.1.4-${code}/${name}`}))});
 globalThis.fetch=async url=>({ok:true,json:async()=>url.startsWith('https://api.github.com/')?[release(99,true),release(4),release(5),{tag_name:'android-testing-v1.2.40-46',draft:false,prerelease:true}]:{appId:'com.aspromex.gvmobility.supervisor.testing',channel:'testing',versionCode:5,versionName:'0.1.4',sha256:'a'.repeat(64),downloadUrl:`${base}android-supervisor-testing-v0.1.4-5/gv-supervisor.apk`}});
 const response=()=>({code:200,set(){},status(code){this.code=code;return this;},json(data){this.data=data;return this;}});
 try{process.env.ANDROID_UPDATE_DISCOVERY='testing';const res=response();await androidUpdateController({query:{application:'supervisor',channel:'testing'}},res);assert.equal(res.code,200);assert.equal(res.data.versionCode,5);assert.equal(res.data.appId,'com.aspromex.gvmobility.supervisor.testing');
 const invalid=response();await androidUpdateController({query:{application:'supervisor',channel:'stable'}},invalid);assert.equal(invalid.code,400);
 }finally{globalThis.fetch=originalFetch;if(previous===undefined)delete process.env.ANDROID_UPDATE_DISCOVERY;else process.env.ANDROID_UPDATE_DISCOVERY=previous;}
});

test('actualizador productivo de aprobadores no ofrece APK ni canal de pruebas',async()=>{
 const keys=['APPROVER_ENVIRONMENT','ANDROID_SUPERVISOR_UPDATE_STABLE'];const before=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
 const response=()=>({code:200,set(){},status(c){this.code=c;return this},json(d){this.data=d;return this}});
 try{
 process.env.APPROVER_ENVIRONMENT='stable';
 const manifest={appId:'com.aspromex.gvmobility.supervisor',versionName:'1.0.0',versionCode:1,channel:'stable',sha256:'a'.repeat(64),downloadUrl:'https://github.com/TobyGarcia/botGerenViaje-1.2.0/releases/download/android-supervisor-stable-v1.0.0-1/gv-supervisor.apk'};
 process.env.ANDROID_SUPERVISOR_UPDATE_STABLE=JSON.stringify(manifest);
 const valid=response();await androidUpdateController({query:{application:'supervisor',channel:'stable'}},valid);assert.equal(valid.data.appId,manifest.appId);assert.equal(valid.data.available,true);
 const wrongChannel=response();await androidUpdateController({query:{application:'supervisor',channel:'testing'}},wrongChannel);assert.equal(wrongChannel.code,400);
 process.env.ANDROID_SUPERVISOR_UPDATE_STABLE=JSON.stringify({...manifest,appId:'com.aspromex.gvmobility.supervisor.testing'});
 const wrongPackage=response();await androidUpdateController({query:{application:'supervisor',channel:'stable'}},wrongPackage);assert.equal(wrongPackage.code,503);
 }finally{for(const k of keys)if(before[k]===undefined)delete process.env[k];else process.env[k]=before[k];}
});
