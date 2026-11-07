/* global GvMovementSync */
(() => {
  const name = 'gv-background-movements-v1';
  const tag = 'gv-trip-movements';
  function open(name, version, upgrade) {
    return new Promise((resolve,reject)=>{
      const request=indexedDB.open(name,version);
      request.onupgradeneeded=()=>upgrade?.(request.result,request.transaction);
      request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
    });
  }
  async function jobs() { return open(name,1,db=>db.createObjectStore('jobs',{keyPath:'id'})); }
  async function transaction(db, stores, mode, callback) {
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(stores,mode);let value;
      tx.oncomplete=()=>resolve(value);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
      callback(tx,result=>{value=result;});
    });
  }
  async function change(id, callback) {
    const db=await jobs();
    try {return await transaction(db,['jobs'],'readwrite',(tx,set)=>{
      const store=tx.objectStore('jobs'),request=store.get(id);
      request.onsuccess=()=>{const current=request.result;if(current){callback(current,store);set(current);}};
    });}finally{db.close();}
  }
  async function gps(job, accepted, rejected) {
    const db=await open('gerenciamiento_viajes_offline',2,(db,tx)=>{
      const pending=db.objectStoreNames.contains('ubicaciones_pendientes')?tx.objectStore('ubicaciones_pendientes'):db.createObjectStore('ubicaciones_pendientes',{keyPath:'clientLocationId'});
      if(!pending.indexNames.contains('idViaje'))pending.createIndex('idViaje','idViaje');
      if(!pending.indexNames.contains('fechaGps'))pending.createIndex('fechaGps','fechaGps');
      if(!db.objectStoreNames.contains('ubicaciones_rechazadas'))db.createObjectStore('ubicaciones_rechazadas',{keyPath:'clientLocationId'});
    });
    try {return await transaction(db,['ubicaciones_pendientes','ubicaciones_rechazadas'],accepted?'readwrite':'readonly',(tx,set)=>{
      const pending=tx.objectStore('ubicaciones_pendientes'),invalid=tx.objectStore('ubicaciones_rechazadas');
      if(accepted){
        for(const id of accepted)pending.delete(id);
        for(const id of rejected){const request=pending.get(id);request.onsuccess=()=>{if(request.result){invalid.put(request.result);pending.delete(id);}};}
      }else{
        const result={points:[],rejected:0};set(result);
        const request=pending.index('idViaje').getAll(Number(job.tripId));
        request.onsuccess=()=>{result.points=request.result.sort((a,b)=>Date.parse(a.fechaGps)-Date.parse(b.fechaGps)).slice(0,100);};
        const errors=invalid.getAll();errors.onsuccess=()=>{result.rejected=errors.result.filter(point=>String(point.idViaje)===String(job.tripId)).length;};
      }
    });}finally{db.close();}
  }
  let running;
  function drain() {
    if(running)return running;
    running=(async()=>{
      const db=await jobs();let all;
      try{all=await transaction(db,['jobs'],'readonly',(tx,set)=>{const request=tx.objectStore('jobs').getAll();request.onsuccess=()=>set(request.result);});}finally{db.close();}
      let failed=false;
      for(const job of all){
        try{
          if(job.origin!==self.location.origin)throw new Error('Servidor no autorizado.');
          await GvMovementSync.run(job,{
            post:async(path,body)=>{
              const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),25000);
              try{const response=await fetch(job.origin+path,{method:'POST',credentials:'include',redirect:'error',signal:controller.signal,
                headers:{'Content-Type':'application/json',...(job.token?{Authorization:`Bearer ${job.token}`}:{})},body:JSON.stringify(body)});
                if(!response.ok)throw new Error(`Sin confirmación (${response.status}).`);
                const result=await response.json();if(!result.success)throw new Error('Sin confirmación.');return result;
              }finally{clearTimeout(timer);}
            },
            mapped:server=>change(job.id,current=>{current.serverId=server;}),
            ackMovement:key=>change(job.id,current=>{current.operations=current.operations.filter(operation=>operation.eventKey!==key);}),
            pendingMovements:async()=>{const current=await change(job.id,()=>{});return current?.operations.length || 0;},
            gps:()=>gps(job),ackGps:(accepted,rejected)=>gps(job,accepted,rejected)
          });
          await change(job.id,(current,store)=>{if(current.revision===job.revision)store.delete(job.id);});
        }catch{failed=true;}
      }
      const pendingDb=await jobs();let pending;
      try{pending=await transaction(pendingDb,['jobs'],'readonly',(tx,set)=>{const request=tx.objectStore('jobs').count();request.onsuccess=()=>set(request.result);});}finally{pendingDb.close();}
      if(failed || pending)throw new Error('Hay movimientos guardados pendientes de sincronizar.');
    })().finally(()=>{running=null;});
    return running;
  }
  self.addEventListener('sync',event=>{if(event.tag===tag)event.waitUntil(drain());});
  self.addEventListener('message',event=>{if(event.data?.type==='GV_SYNC_MOVEMENTS')event.waitUntil(drain());});
})();
