package com.aspromex.gerenciamientoviajes;

import android.Manifest;
import android.app.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.location.*;
import android.net.*;
import android.os.*;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;
import org.json.JSONObject;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class GpsTrackingService extends Service implements LocationListener {
    static final int NOTIFICATION=7310;
    static final String CHANNEL="gv_active_trip";
    private LocationManager manager;
    private final Handler handler=new Handler(Looper.getMainLooper());
    private final ExecutorService syncExecutor=Executors.newSingleThreadExecutor();
    private final java.util.concurrent.atomic.AtomicBoolean syncQueued=new java.util.concurrent.atomic.AtomicBoolean(false);
    private GpsDatabase db;
    private ConnectivityManager connectivity;
    private final ConnectivityManager.NetworkCallback networkCallback=new ConnectivityManager.NetworkCallback(){
        @Override public void onCapabilitiesChanged(Network network,NetworkCapabilities capabilities){
            if(capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED))requestSync();
        }
    };
    private void requestSync(){
        if(connectivity==null)return;
        NetworkCapabilities capabilities=connectivity.getNetworkCapabilities(connectivity.getActiveNetwork());
        if(capabilities==null || !capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)) {
            db.put("syncStatus","Sin internet · ubicaciones guardadas en el teléfono");return;
        }
        if(!syncExecutor.isShutdown() && syncQueued.compareAndSet(false,true)) {
            try{syncExecutor.execute(()->{try{GpsSync.run(getApplicationContext());GpsSync.schedule(getApplicationContext());}finally{syncQueued.set(false);}});}
            catch(java.util.concurrent.RejectedExecutionException ignored){syncQueued.set(false);}
        }
    }
    private final Runnable tick=new Runnable(){public void run(){
        if(!"true".equals(db.read("active","false"))){stopSelf();return;}
        showNotification(); requestSync();
        handler.postDelayed(this,30000);
    }};
    @Override public void onCreate(){super.onCreate();db=GpsDatabase.get(this);manager=(LocationManager)getSystemService(LOCATION_SERVICE);
        connectivity=(ConnectivityManager)getSystemService(CONNECTIVITY_SERVICE);
        try{connectivity.registerDefaultNetworkCallback(networkCallback);}catch(SecurityException ignored){}
        if(Build.VERSION.SDK_INT>=26){NotificationManager notifications=getSystemService(NotificationManager.class);
            notifications.createNotificationChannel(new NotificationChannel(CHANNEL,"Viaje activo y seguimiento GPS",NotificationManager.IMPORTANCE_LOW));
            notifications.createNotificationChannel(new NotificationChannel("gv_trip_reminder","Recordar finalizar viaje",NotificationManager.IMPORTANCE_DEFAULT));}
    }
    @Override public int onStartCommand(Intent intent,int flags,int startId){
        if(!"true".equals(db.read("active","false"))){stopSelf();return START_NOT_STICKY;}
        try {
            startForeground(NOTIFICATION,notification());
            ((NotificationManager)getSystemService(NOTIFICATION_SERVICE)).cancel(7314);
            if(ContextCompat.checkSelfPermission(this,Manifest.permission.ACCESS_FINE_LOCATION)!=PackageManager.PERMISSION_GRANTED){db.put("gpsStatus","Permiso GPS interrumpido");showNotification();return START_STICKY;}
            manager.removeUpdates(this);
            for(String provider:new String[]{LocationManager.GPS_PROVIDER,LocationManager.NETWORK_PROVIDER}) {
                if(manager.getAllProviders().contains(provider)) manager.requestLocationUpdates(provider,30000,0,this,Looper.getMainLooper());
            }
            db.put("gpsStatus","Esperando ubicación GPS"); handler.removeCallbacks(tick);handler.post(tick);
            return START_STICKY;
        }catch(Exception error){db.put("gpsStatus","No se pudo iniciar GPS; abre el viaje");stopSelf();return START_NOT_STICKY;}
    }
    private PendingIntent open(boolean finish){
        Intent intent=new Intent(this,MainActivity.class).setAction(finish?"gv.finish":"gv.open").addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP|Intent.FLAG_ACTIVITY_CLEAR_TOP);
        return PendingIntent.getActivity(this,finish?7311:7310,intent,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
    }
    private android.app.Notification notification(){
        long start=Long.parseLong(db.read("startedAt","0")); long last=Long.parseLong(db.read("lastCaptureMillis","0"));
        String gps=last>0?"Último GPS: hace "+Math.max(0,(System.currentTimeMillis()-last)/1000)+" s":db.read("gpsStatus","Esperando GPS");
        if(last>0 && System.currentTimeMillis()-last>120000)gps="Sin captura GPS reciente";
        int pending=db.count(db.read("trip",""),false);
        int rejected=db.count(db.read("trip",""),true)-pending;
        return new NotificationCompat.Builder(this,CHANNEL).setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setContentTitle("Viaje en curso · "+db.read("folio","GV Mobility"))
            .setContentText(gps+" · "+pending+" pendientes")
            .setStyle(new NotificationCompat.BigTextStyle().bigText(gps+"\n"+pending+" ubicaciones por enviar"+(rejected>0?" · "+rejected+" para revisión":"")+"\n"+db.read("syncStatus","Guardando en el teléfono")))
            .setCategory(NotificationCompat.CATEGORY_SERVICE).setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
            .setOngoing(true).setOnlyAlertOnce(true).setWhen(start).setUsesChronometer(start>0)
            .setContentIntent(open(false)).addAction(0,"Abrir viaje",open(false)).addAction(0,"Finalizar viaje",open(true)).build();
    }
    private void showNotification(){
        NotificationManager notifications=(NotificationManager)getSystemService(NOTIFICATION_SERVICE);
        notifications.notify(NOTIFICATION,notification());
        long elapsed=System.currentTimeMillis()-Long.parseLong(db.read("startedAt","0"));
        long reminder=Long.parseLong(db.read("reminderMillis","7200000"));
        if(elapsed>=reminder && System.currentTimeMillis()-Long.parseLong(db.read("lastReminder","0"))>=3600000){
            db.put("lastReminder",String.valueOf(System.currentTimeMillis()));
            notifications.notify(7313,new NotificationCompat.Builder(this,"gv_trip_reminder").setSmallIcon(android.R.drawable.ic_dialog_info)
                .setContentTitle("¿Tu viaje terminó?").setContentText("Recuerda finalizar "+db.read("folio","el viaje")+" y registrar el odómetro.")
                .setContentIntent(open(true)).setAutoCancel(true).build());
        }
    }
    @Override public void onLocationChanged(Location location){
        if(!"true".equals(db.read("active","false")))return;
        long age=SystemClock.elapsedRealtimeNanos()-location.getElapsedRealtimeNanos();
        if(age<0 || age>120000000000L || location.getTime()<=0)return;
        try {
            JSONObject last=new JSONObject(db.read("lastLocation","{}"));
            if(GpsTime.iso(location.getTime()).equals(last.optString("fechaGps")) && location.getLatitude()==last.optDouble("latitud") && location.getLongitude()==last.optDouble("longitud"))return;
            JSONObject point=new JSONObject().put("clientLocationId",UUID.randomUUID().toString()).put("idViaje",db.read("trip",""))
                .put("latitud",location.getLatitude()).put("longitud",location.getLongitude()).put("precisionMetros",location.hasAccuracy()?location.getAccuracy():JSONObject.NULL)
                .put("velocidad",location.hasSpeed()?location.getSpeed()*3.6:JSONObject.NULL).put("direccion",location.hasBearing()?location.getBearing():JSONObject.NULL)
                .put("fechaGps",GpsTime.iso(location.getTime())).put("fechaGuardadoLocal",GpsTime.iso(System.currentTimeMillis()))
                .put("origenCaptura","ANDROID_NATIVE").put("isBackground",true);
            // Se escribe ANTES de informar a la pantalla y de cualquier petición HTTP.
            if(!db.saveIfActive(point))return;db.put("lastCaptureMillis",String.valueOf(location.getTime()));db.put("lastLocation",point.toString());
            db.put("gpsStatus","Capturando GPS nativo");GpsSync.schedule(this);requestSync();showNotification();
        }catch(Exception error){db.put("gpsStatus","Error de almacenamiento GPS: revisar teléfono");showNotification();}
    }
    @Override public void onProviderDisabled(String provider){db.put("gpsStatus","GPS desactivado");showNotification();}
    @Override public void onProviderEnabled(String provider){db.put("gpsStatus","Esperando señal GPS");}
    @Override public void onDestroy(){handler.removeCallbacksAndMessages(null);try{if(manager!=null)manager.removeUpdates(this);}catch(SecurityException ignored){}
        try{if(connectivity!=null)connectivity.unregisterNetworkCallback(networkCallback);}catch(IllegalArgumentException ignored){}
        syncExecutor.shutdown();GpsSync.schedule(this);super.onDestroy();}
    @Override public IBinder onBind(Intent intent){return null;}
}
