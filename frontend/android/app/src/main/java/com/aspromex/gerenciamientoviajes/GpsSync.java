package com.aspromex.gerenciamientoviajes;

import android.content.Context;
import android.app.job.JobInfo;
import android.app.job.JobScheduler;
import android.content.ComponentName;
import org.json.JSONArray;
import org.json.JSONObject;
import java.net.HttpURLConnection;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicBoolean;

final class GpsSync {
    private static final AtomicBoolean running = new AtomicBoolean(false);
    static void schedule(Context context) {
        if (GpsDatabase.get(context).count(null,true)==0 && GpsDatabase.get(context).completionCount()==0) return;
        JobScheduler scheduler=(JobScheduler)context.getSystemService(Context.JOB_SCHEDULER_SERVICE);
        scheduler.schedule(new JobInfo.Builder(7312,new ComponentName(context,GpsSyncJob.class))
            .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY).setMinimumLatency(30000)
            .setBackoffCriteria(30000,JobInfo.BACKOFF_POLICY_EXPONENTIAL).setPersisted(true).build());
    }
    static JSONObject post(String origin, String path, String token, JSONObject body) throws Exception {
        URI uri=URI.create(origin);
        if (!"https".equals(uri.getScheme()) || !uri.getHost().equals("gvmobility.aspromex.mx")) throw new SecurityException("Servidor GPS fuera del ambiente de pruebas");
        HttpURLConnection connection=(HttpURLConnection)URI.create(origin+path).toURL().openConnection();
        try {
            connection.setInstanceFollowRedirects(false); connection.setRequestMethod("POST"); connection.setConnectTimeout(15000); connection.setReadTimeout(20000);
            connection.setRequestProperty("Content-Type","application/json"); connection.setRequestProperty("Authorization","Bearer "+token);
            connection.setDoOutput(true);
            try(java.io.OutputStream output=connection.getOutputStream()){output.write(body.toString().getBytes(StandardCharsets.UTF_8));}
            int status=connection.getResponseCode();
            if(status<200||status>=300) throw new java.io.IOException(status==401||status==403?"Sesión pendiente de renovar":"Sincronización pendiente ("+status+")");
            try(java.io.InputStream input=connection.getInputStream()) {
                java.io.ByteArrayOutputStream output=new java.io.ByteArrayOutputStream(); byte[] buffer=new byte[4096]; int count;
                while((count=input.read(buffer))!=-1) {output.write(buffer,0,count);if(output.size()>1048576)throw new java.io.IOException("Respuesta excesiva");}
                JSONObject result=new JSONObject(output.toString("UTF-8"));
                if(!result.optBoolean("success")) throw new java.io.IOException("Respuesta sin confirmación");
                return result;
            }
        } finally { connection.disconnect(); }
    }
    static boolean run(Context context) {
        if(!running.compareAndSet(false,true)) return false;
        GpsDatabase db=GpsDatabase.get(context);
        try {
            JSONArray sessions=db.sessions();
            for(int s=0;s<sessions.length();s++) {
                JSONObject session=sessions.getJSONObject(s); long server=session.getLong("server");
                if(server<=0) continue;
                String trip=session.getString("trip"), token=GpsSecrets.decrypt(session.getString("token"));
                // Acotar una ejecución. El JobScheduler reintenta el resto con conectividad.
                for(int batch=0;batch<10;batch++) {
                    JSONArray points=db.pending(trip,100); if(points.length()==0) break;
                    JSONObject response=post(session.getString("origin"),"/api/viajes/"+server+"/ubicaciones/lote",token,new JSONObject().put("ubicaciones",points)).getJSONObject("data");
                    JSONArray rejected=response.optJSONArray("idsRechazados"); if(rejected==null)rejected=new JSONArray();
                    if(response.optInt("rechazadas",0)!=rejected.length() ||
                        response.optInt("insertadas",-1)+response.optInt("duplicadas",-1)+rejected.length()!=points.length()) throw new java.io.IOException("Lote sin confirmación completa");
                    java.util.Set<String> known=new java.util.HashSet<>();
                    for(int i=0;i<points.length();i++)known.add(points.getJSONObject(i).getString("clientLocationId"));
                    for(int i=0;i<rejected.length();i++)if(!known.contains(rejected.getString(i)))throw new java.io.IOException("Respuesta de otro lote");
                    java.util.Set<String> rejectedSet=new java.util.HashSet<>();for(int i=0;i<rejected.length();i++)rejectedSet.add(rejected.getString(i));
                    JSONArray accepted=new JSONArray();for(String id:known)if(!rejectedSet.contains(id))accepted.put(id);
                    db.acknowledge(rejected,true);db.acknowledge(accepted,false);
                }
                JSONObject completion=db.completion(trip);
                if(completion!=null && db.count(trip,true)==0) {
                    post(session.getString("origin"),"/api/viajes/"+server+"/cierre-nativo",token,completion);
                    db.completed(trip); db.put("closed:"+trip,"confirmed");
                }
            }
            db.put("syncStatus",db.count(null,true)>0?"Hay capturas pendientes o para revisión":"Sincronizado");
            return db.count(null,false)==0 && db.completionCount()==0;
        } catch(Exception error) {
            db.put("syncStatus", error.getMessage()==null?"Pendiente de sincronizar":error.getMessage());
            return false;
        } finally { running.set(false); }
    }
}
