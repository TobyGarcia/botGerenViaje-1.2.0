package com.aspromex.gerenciamientoviajes;

import android.Manifest;
import android.content.Intent;
import android.os.Build;
import androidx.core.content.ContextCompat;
import com.getcapacitor.*;
import com.getcapacitor.annotation.*;
import org.json.*;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(name="NativeGps",permissions={
    @Permission(alias="location",strings={Manifest.permission.ACCESS_FINE_LOCATION,Manifest.permission.ACCESS_COARSE_LOCATION}),
    @Permission(alias="notifications",strings={Manifest.permission.POST_NOTIFICATIONS})
})
public class NativeGpsPlugin extends Plugin {
    private static final ExecutorService IO=Executors.newSingleThreadExecutor();
    static volatile boolean finishRequested=false;
    @PluginMethod public void ensurePermissions(PluginCall call) {
        requestPermissionForAliases(Build.VERSION.SDK_INT>=33?new String[]{"location","notifications"}:new String[]{"location"},call,"permissionsReady");
    }
    @PermissionCallback private void permissionsReady(PluginCall call) {
        if(getPermissionState("location")!=PermissionState.GRANTED || (Build.VERSION.SDK_INT>=33 && getPermissionState("notifications")!=PermissionState.GRANTED)) {
            call.reject("Habilita ubicación precisa y notificaciones antes de iniciar el viaje.");
        } else call.resolve();
    }
    @PluginMethod public void start(PluginCall call) {
        if(getPermissionState("location")!=PermissionState.GRANTED || (Build.VERSION.SDK_INT>=33 && getPermissionState("notifications")!=PermissionState.GRANTED)) {
            requestPermissionForAliases(Build.VERSION.SDK_INT>=33?new String[]{"location","notifications"}:new String[]{"location"},call,"startAfterPermissions");return;
        }
        startAfterPermissions(call);
    }
    @PermissionCallback private void startAfterPermissions(PluginCall call) {
        if(getPermissionState("location")!=PermissionState.GRANTED || (Build.VERSION.SDK_INT>=33 && getPermissionState("notifications")!=PermissionState.GRANTED)) {
            call.reject("Se necesitan ubicación precisa y notificaciones para iniciar el rastreo.");return;
        }
        IO.execute(()->{try {
            GpsDatabase db=GpsDatabase.get(getContext());String trip=call.getString("trip","");
            if(trip.isEmpty() || trip.equals("0"))throw new IllegalArgumentException("Viaje inválido");
            if(db.completion(trip)!=null)throw new IllegalStateException("El viaje tiene un cierre guardado pendiente de sincronización");
            if("true".equals(db.read("active","false")) && !trip.equals(db.read("trip","")))throw new IllegalStateException("Ya hay otro viaje nativo activo");
            configureSession(call);
            if(!trip.equals(db.read("trip","")) || !"true".equals(db.read("active","false"))) {
                db.put("startedAt",String.valueOf(call.getLong("startedAt",System.currentTimeMillis())));db.put("lastCaptureMillis","0");
                db.put("lastReminder","0");
            }
            db.put("trip",trip);db.put("folio",call.getString("folio","Viaje "+trip));
            long reminder=call.getLong("reminderMillis",7200000L);db.put("reminderMillis",String.valueOf(Math.max(60000,reminder)));
            db.put("active","true");
            getActivity().runOnUiThread(()->{try {
                ContextCompat.startForegroundService(getContext(),new Intent(getContext(),GpsTrackingService.class));call.resolve();
            }catch(Exception error){db.put("active","false");call.reject("No se pudo iniciar el servicio GPS. Mantén la aplicación abierta y revisa permisos.");}});
        }catch(Exception error){call.reject(error.getMessage());}});
    }
    private void configureSession(PluginCall call) throws Exception {
        String origin=call.getString("origin",""),token=call.getString("token","");long driver=call.getLong("driver",0L);
        if(!"https://gvmobility.aspromex.mx".equals(origin) || driver<=0 || token.isEmpty()) throw new SecurityException("Configura sesión de conductor y servidor de pruebas antes de rastrear");
        GpsDatabase db=GpsDatabase.get(getContext());String encrypted=GpsSecrets.encrypt(token);
        String trip=call.getString("trip","");
        for(int i=0;i<db.sessions().length();i++) {
            JSONObject old=db.sessions().getJSONObject(i);
            if(old.getLong("driver")==driver && old.getString("origin").equals(origin)) db.session(old.getString("trip"),old.getLong("server"),driver,origin,encrypted);
        }
        if(!trip.isEmpty()) db.session(trip,call.getLong("server",0L),driver,origin,encrypted);
    }
    @PluginMethod public void configure(PluginCall call){IO.execute(()->{try{configureSession(call);call.resolve();GpsSync.schedule(getContext());}catch(Exception error){call.reject(error.getMessage());}});}
    @PluginMethod public void stop(PluginCall call){IO.execute(()->{GpsDatabase db=GpsDatabase.get(getContext());db.put("active","false");getContext().stopService(new Intent(getContext(),GpsTrackingService.class));
        android.app.NotificationManager notifications=(android.app.NotificationManager)getContext().getSystemService(android.content.Context.NOTIFICATION_SERVICE);notifications.cancel(7310);notifications.cancel(7313);GpsSync.schedule(getContext());call.resolve();});}
    @PluginMethod public void status(PluginCall call){IO.execute(()->{try{GpsDatabase db=GpsDatabase.get(getContext());JSObject value=new JSObject();
        value.put("active","true".equals(db.read("active","false")));value.put("trip",db.read("trip",""));value.put("pending",db.count(call.getString("trip"),false));
        value.put("stored",db.count(null,true)+db.completionCount());value.put("gpsStatus", "true".equals(db.read("active","false")) && System.currentTimeMillis()-Long.parseLong(db.read("lastCaptureMillis","0"))>120000 ? "Sin captura GPS reciente" : db.read("gpsStatus","Detenido"));value.put("syncStatus",db.read("syncStatus",""));
        value.put("lastLocation",new JSONObject(db.read("lastLocation","{}")));value.put("finishRequested",finishRequested);if(call.getBoolean("consumeAction",false))finishRequested=false;call.resolve(value);
    }catch(Exception error){call.reject(error.getMessage());}});}
    @PluginMethod public void sync(PluginCall call){IO.execute(()->{GpsSync.run(getContext());GpsSync.schedule(getContext());JSObject result=new JSObject();GpsDatabase db=GpsDatabase.get(getContext());result.put("pending",db.count(call.getString("trip"),false));result.put("completions",db.completionCount());call.resolve(result);});}
    @PluginMethod public void storage(PluginCall call){IO.execute(()->{try{
        GpsDatabase db=GpsDatabase.get(getContext());String op=call.getString("operation","");JSObject result=new JSObject();
        switch(op){
            case "save":db.save(call.getObject("point"));GpsSync.schedule(getContext());break;
            case "pending":result.put("points",db.pending(call.getString("trip",""),100000));break;
            case "remove":db.acknowledge(call.getArray("ids",new JSArray()),false);break;
            case "quarantine":db.acknowledge(call.getArray("ids",new JSArray()),true);break;
            case "import": {JSONArray points=call.getArray("points",new JSArray());for(int i=0;i<points.length();i++)db.save(points.getJSONObject(i));break;}
            case "complete": {String trip=call.getString("trip","");db.completion(trip,call.getObject("completion"));db.put("closed:"+trip,call.getObject("completion").toString());break;}
            case "closed":result.put("value",db.read("closed:"+call.getString("trip",""),""));break;
            default:throw new IllegalArgumentException("Operación SQLite inválida");
        }call.resolve(result);
    }catch(Exception error){call.reject(error.getMessage());}});}
}
