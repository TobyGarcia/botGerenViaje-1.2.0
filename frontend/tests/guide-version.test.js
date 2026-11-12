import test from 'node:test';
import assert from 'node:assert/strict';
import { installedGuideVersion } from '../src/utils/guide-version.js';

test('las guías se identifican por la APK instalada, no por la versión disponible',async()=>{
 const getNativeInfo=async()=>({versionCode:46,channel:'testing'});
 assert.equal(await installedGuideVersion({native:true,platform:'android',getNativeInfo,webVersion:'unrelated-build'}),'android:testing:46');
 assert.notEqual(await installedGuideVersion({native:true,platform:'android',getNativeInfo:async()=>({versionCode:47,channel:'testing'})}),'android:testing:46');
});
test('separa canales y usa el build para la PWA',async()=>{
 assert.equal(await installedGuideVersion({native:true,platform:'android',getNativeInfo:async()=>({versionCode:46,channel:'stable'})}),'android:stable:46');
 assert.equal(await installedGuideVersion({native:false,platform:'web',webVersion:'build-2',getNativeInfo:()=>{throw Error('No debe llamar al plugin')}}),'web:build-2');
});
test('no marca una versión inventada cuando falla la lectura nativa',async()=>{
 await assert.rejects(installedGuideVersion({native:true,platform:'android',getNativeInfo:async()=>({versionCode:0})}));
 await assert.rejects(installedGuideVersion({native:true,platform:'android',getNativeInfo:async()=>{throw Error('Plugin no disponible')}}));
});
