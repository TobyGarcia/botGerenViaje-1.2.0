package com.aspromex.gvmobility.supervisor.testing;
import android.app.*;import android.content.*;import android.os.Build;
import androidx.core.app.NotificationCompat;import androidx.core.app.NotificationManagerCompat;
import org.json.*;import java.util.*;import java.net.*;import java.io.*;import java.nio.charset.StandardCharsets;
final class ApproverNotifications {
 static final String PRIORITY_CHANNEL="approver_priority_v2";
 static final String MANAGEMENT_CHANNEL="approver_management_v2",MANAGEMENT_PRIORITY_CHANNEL="approver_management_pending_v2";
 static final String BASE="https://gvmobility.aspromex.mx/api/approver-notifications";
 static final java.util.concurrent.ExecutorService IO=java.util.concurrent.Executors.newSingleThreadExecutor();
 static android.content.SharedPreferences prefs(Context c){return c.getSharedPreferences("approver-notifications",Context.MODE_PRIVATE);}
 static boolean bound(Context c){return !prefs(c).getString("device","").isEmpty();}
 static android.net.Uri prioritySound(Context c){return android.net.Uri.parse("android.resource://"+c.getPackageName()+"/raw/priority_trip");}
 static android.net.Uri managementSound(Context c){return android.net.Uri.parse("android.resource://"+c.getPackageName()+"/raw/gv_management");}
 static void channels(Context c){if(Build.VERSION.SDK_INT>=26){
  NotificationManager m=c.getSystemService(NotificationManager.class);
  m.createNotificationChannel(new NotificationChannel("approver_events","Avisos de viajes y aprobaciones",NotificationManager.IMPORTANCE_DEFAULT));
  NotificationChannel priority=new NotificationChannel(PRIORITY_CHANNEL,"Viajes prioritarios por aprobar",NotificationManager.IMPORTANCE_HIGH);
  priority.setDescription("Avisos destacados para viajes fuera de horario o del estado pendientes de aprobación");
  priority.enableVibration(true);priority.setVibrationPattern(new long[]{0,350,150,350,150,600});
  priority.enableLights(true);priority.setLightColor(android.graphics.Color.CYAN);
  priority.setSound(prioritySound(c),new android.media.AudioAttributes.Builder().setUsage(android.media.AudioAttributes.USAGE_NOTIFICATION_EVENT).setContentType(android.media.AudioAttributes.CONTENT_TYPE_SONIFICATION).build());
  m.createNotificationChannel(priority);
  for(String id:new String[]{MANAGEMENT_CHANNEL,MANAGEMENT_PRIORITY_CHANNEL}){
   NotificationChannel management=new NotificationChannel(id,id.equals(MANAGEMENT_CHANNEL)?"Gerenciamiento de viajes":"Gerenciamientos prioritarios pendientes",NotificationManager.IMPORTANCE_HIGH);
   management.setDescription("Sonido GV para las solicitudes y decisiones de gerenciamiento");management.enableVibration(true);management.setVibrationPattern(NotificationSoundPolicy.managementVibration());
   management.setSound(managementSound(c),new android.media.AudioAttributes.Builder().setUsage(android.media.AudioAttributes.USAGE_NOTIFICATION_EVENT).setContentType(android.media.AudioAttributes.CONTENT_TYPE_SONIFICATION).build());m.createNotificationChannel(management);
  }
  if(!prefs(c).getBoolean("priority_v2_migrated",false)){m.cancel(7301);prefs(c).edit().putBoolean("priority_v2_migrated",true).apply();}
 }}
 static JSONObject request(Context c,String method,String path,JSONObject body)throws Exception{
  return request(method,path,body,prefs(c).getString("device",""),ApproverSecrets.decrypt(prefs(c).getString("secret","")));
 }
 static JSONObject request(String method,String path,JSONObject body,String device,String secret)throws Exception{
  HttpURLConnection con=(HttpURLConnection)new URL(BASE+path).openConnection();
  try{con.setRequestMethod(method);con.setInstanceFollowRedirects(false);con.setConnectTimeout(10000);con.setReadTimeout(15000);con.setRequestProperty("X-Notification-Device",device);con.setRequestProperty("X-Notification-Key",secret);con.setRequestProperty("Content-Type","application/json");
   if(body!=null){con.setDoOutput(true);try(OutputStream out=con.getOutputStream()){out.write(body.toString().getBytes(StandardCharsets.UTF_8));}}
   int code=con.getResponseCode();if(code==401)throw new SecurityException("Dispositivo no autorizado");if(code<200||code>=300)throw new IOException("Avisos temporalmente no disponibles");
   try(InputStream in=con.getInputStream();ByteArrayOutputStream out=new ByteArrayOutputStream()){byte[] b=new byte[4096];int n;while((n=in.read(b))!=-1){out.write(b,0,n);if(out.size()>1048576)throw new IOException("Respuesta excesiva");}return new JSONObject(out.toString("UTF-8"));}
  }finally{con.disconnect();}
 }
 static synchronized void bind(Context c,String device,String secret,String user,String cursor)throws Exception{
  clear(c);prefs(c).edit().putString("device",device).putString("secret",ApproverSecrets.encrypt(secret)).putString("user",user).putString("cursor",cursor.matches("[0-9]+")?cursor:"0").apply();channels(c);
 }
 static synchronized void clear(Context c){prefs(c).edit().clear().apply();NotificationManagerCompat.from(c).cancelAll();}
 static void token(Context c,String token)throws Exception{if(!bound(c))return;request(c,"PUT","/token",new JSONObject().put("token",token));}
 static void sync(Context c)throws Exception{
  for(int page=0;page<5;page++){
   if(!bound(c))return;String device=prefs(c).getString("device","");
   JSONObject response=request(c,"GET","/feed?after="+prefs(c).getString("cursor","0"),null);JSONObject snapshot=response.getJSONObject("data");
   apply(c,snapshot);
   synchronized(ApproverNotifications.class){if(!device.equals(prefs(c).getString("device","")))return;prefs(c).edit().putString("cursor",snapshot.getString("cursor")).apply();}
   if(!snapshot.optBoolean("hasMore"))return;
  }
 }
 static JSONObject critical(JSONArray rows)throws Exception{JSONArray folios=new JSONArray();for(int i=0;i<Math.min(rows.length(),3);i++)folios.put(rows.getJSONObject(i).getString("folio"));return new JSONObject().put("count",rows.length()).put("folios",folios);}
 static PendingIntent intent(Context c,String tab){Intent i=new Intent(c,MainActivity.class).putExtra("notification_tab",tab).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP|Intent.FLAG_ACTIVITY_CLEAR_TOP);return PendingIntent.getActivity(c,tab.equals("pending")?7301:7302,i,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);}
 static NotificationCompat.Builder builder(Context c,String channel,String title,String body,String tab){
  Notification publicView=new NotificationCompat.Builder(c,channel).setSmallIcon(R.drawable.ic_stat_approver).setContentTitle((channel.equals(PRIORITY_CHANNEL)||channel.equals(MANAGEMENT_PRIORITY_CHANNEL))?"GV Mobility · Aprobación prioritaria":"GV Mobility").setContentText((channel.equals(PRIORITY_CHANNEL)||channel.equals(MANAGEMENT_PRIORITY_CHANNEL))?"Abre la app para revisar los viajes pendientes":"Tienes novedades de tus viajes").build();
  return new NotificationCompat.Builder(c,channel).setSmallIcon(R.drawable.ic_stat_approver).setContentTitle(title).setContentText(body).setStyle(new NotificationCompat.BigTextStyle().bigText(body)).setContentIntent(intent(c,tab)).setVisibility(NotificationCompat.VISIBILITY_PRIVATE).setPublicVersion(publicView).setOnlyAlertOnce(true);
 }
 static synchronized void apply(Context c,JSONObject payload)throws Exception{
  if(!bound(c)||!prefs(c).getString("device","").equals(payload.optString("deviceId")))return;
  channels(c);if(!NotificationManagerCompat.from(c).areNotificationsEnabled())return;
  NotificationManagerCompat manager=NotificationManagerCompat.from(c);
  boolean managementPlayed=false;
  Set<String> seen=new HashSet<>(prefs(c).getStringSet("seen",new HashSet<>()));
  JSONArray events=payload.optJSONArray("events");if(events==null)events=new JSONArray();
  for(int i=0;i<events.length();i++){JSONObject event=events.getJSONObject(i);String id=event.getString("id");if(seen.contains(id))continue;
   boolean management=NotificationSoundPolicy.isManagement(event.optString("category"),event.optString("title"));
   NotificationCompat.Builder eventNotice=builder(c,management?MANAGEMENT_CHANNEL:"approver_events",event.optString("title","Novedad del viaje"),event.optString("body"),"trips").setAutoCancel(true);
   if(management){eventNotice.setPriority(NotificationCompat.PRIORITY_HIGH);if(managementPlayed)eventNotice.setSilent(true);else if(Build.VERSION.SDK_INT<26)eventNotice.setSound(managementSound(c)).setVibrate(NotificationSoundPolicy.managementVibration());managementPlayed=true;}
   manager.notify("event:"+id,7302,eventNotice.build());seen.add(id);
  }
  if(seen.size()>500){List<String> ordered=new ArrayList<>(seen);ordered.sort((a,b)->Long.compare(Long.parseLong(a),Long.parseLong(b)));seen=new HashSet<>(ordered.subList(ordered.size()-500,ordered.size()));}
  prefs(c).edit().putStringSet("seen",seen).apply();
  java.text.SimpleDateFormat date=new java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",Locale.US);date.setTimeZone(TimeZone.getTimeZone("UTC"));long updated=date.parse(payload.getString("updatedAt")).getTime();
  if(updated<prefs(c).getLong("critical_revision",0))return;
  JSONObject critical=payload.getJSONObject("critical");int count=critical.optInt("count");
  if(count==0){manager.cancel(7301);prefs(c).edit().putInt("critical_count",0).putString("critical_signature","").putInt("management_count",0).putString("management_signature","").apply();}else{JSONArray folios=critical.optJSONArray("folios");List<String> names=new ArrayList<>();if(folios!=null)for(int i=0;i<folios.length();i++)names.add(folios.optString(i));
   String signature=android.text.TextUtils.join("|",names);
   boolean alert=PriorityAlertPolicy.shouldAlert(prefs(c).getInt("critical_count",0),prefs(c).getString("critical_signature",""),count,signature);
   int managementCount=critical.optInt("managementCount");String managementSignature=critical.optJSONArray("managementFolios")!=null?critical.optJSONArray("managementFolios").toString():"";
   alert=alert||PriorityAlertPolicy.shouldAlert(prefs(c).getInt("management_count",0),prefs(c).getString("management_signature",""),managementCount,managementSignature);
   if(managementCount>0&&managementPlayed)alert=false;
   String channel=managementCount>0?MANAGEMENT_PRIORITY_CHANNEL:PRIORITY_CHANNEL;
   String oldChannel=prefs(c).getString("critical_channel",PRIORITY_CHANNEL);if(!channel.equals(oldChannel))manager.cancel(7301);
   NotificationCompat.Builder notice=builder(c,channel,count==1?"ATENCIÓN: viaje prioritario por aprobar":"ATENCIÓN: "+count+" viajes prioritarios",android.text.TextUtils.join(", ",names)+" · Fuera de horario o del estado. Revisa las aprobaciones.","pending")
    .setPriority(NotificationCompat.PRIORITY_HIGH).setColor(0xFFDC6803).setOngoing(true).setAutoCancel(false).setCategory(NotificationCompat.CATEGORY_REMINDER).setOnlyAlertOnce(!alert);
   if(!alert)notice.setSilent(true);
   if(Build.VERSION.SDK_INT<26&&alert)notice.setSound(managementCount>0?managementSound(c):prioritySound(c)).setVibrate(managementCount>0?NotificationSoundPolicy.managementVibration():new long[]{0,350,150,350,150,600});
   manager.notify(7301,notice.build());
   prefs(c).edit().putInt("critical_count",count).putString("critical_signature",signature).putInt("management_count",managementCount).putString("management_signature",managementSignature).putString("critical_channel",channel).apply();}
  prefs(c).edit().putLong("critical_revision",updated).apply();
 }
}
