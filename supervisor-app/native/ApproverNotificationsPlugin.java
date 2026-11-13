package com.aspromex.gvmobility.supervisor.testing;
import android.Manifest;import android.os.Build;import android.content.Intent;import android.net.Uri;import android.provider.Settings;
import androidx.core.app.NotificationManagerCompat;import com.getcapacitor.*;import com.getcapacitor.annotation.*;import com.google.firebase.messaging.FirebaseMessaging;import org.json.JSONObject;
@CapacitorPlugin(name="ApproverNotifications",permissions={@Permission(alias="notifications",strings={Manifest.permission.POST_NOTIFICATIONS})})
public class ApproverNotificationsPlugin extends Plugin {
 private static final java.util.concurrent.atomic.AtomicLong EPOCH=new java.util.concurrent.atomic.AtomicLong();
 @Override protected void handleOnNewIntent(Intent intent){String tab=intent.getStringExtra("notification_tab");if(tab!=null){JSObject data=new JSObject();data.put("tab",tab);notifyListeners("notificationTap",data,true);}}
 @Override public void load(){ApproverNotifications.channels(getContext());}
 @PluginMethod public void status(PluginCall call){JSObject r=new JSObject();r.put("granted",NotificationManagerCompat.from(getContext()).areNotificationsEnabled());r.put("bound",ApproverNotifications.bound(getContext()));r.put("user",ApproverNotifications.prefs(getContext()).getString("user",""));call.resolve(r);}
 @PluginMethod public void ensurePermissions(PluginCall call){if(Build.VERSION.SDK_INT>=33&&getPermissionState("notifications")!=PermissionState.GRANTED){requestPermissionForAlias("notifications",call,"permissionReady");}else permissionReady(call);}
 @PermissionCallback private void permissionReady(PluginCall call){JSObject r=new JSObject();r.put("granted",NotificationManagerCompat.from(getContext()).areNotificationsEnabled());call.resolve(r);}
 @PluginMethod public void configure(PluginCall call){String device=call.getString("deviceId",""),secret=call.getString("deviceSecret",""),user=call.getString("user","");if(!device.matches("[a-fA-F0-9-]{36}")||!secret.matches("[a-f0-9]{64}")||!user.matches("[0-9]+")){call.reject("Registro inválido");return;}
  final long epoch=EPOCH.incrementAndGet();ApproverNotifications.IO.execute(()->{try{synchronized(ApproverNotifications.class){if(EPOCH.get()!=epoch){call.reject("Registro cancelado");return;}ApproverNotifications.bind(getContext(),device,secret,user,call.getString("cursor","0"));}refresh(call);}catch(Exception e){call.reject("No se pudieron activar los avisos");}});
 }
 @PluginMethod public void refresh(PluginCall call){if(!ApproverNotifications.bound(getContext())){call.reject("Registra este dispositivo nuevamente");return;}
  FirebaseMessaging.getInstance().setAutoInitEnabled(true);FirebaseMessaging.getInstance().getToken().addOnCompleteListener(task->{if(!task.isSuccessful()){call.reject("No se pudo registrar el teléfono en Firebase");return;}
   ApproverNotifications.IO.execute(()->{try{ApproverNotifications.token(getContext(),task.getResult());ApproverNotifications.sync(getContext());call.resolve();}catch(SecurityException e){ApproverNotifications.clear(getContext());call.reject("Registra este dispositivo nuevamente");}catch(Exception e){call.reject("Revisa la conexión para activar los avisos");}});
  });
 }
 @PluginMethod public void stop(PluginCall call){String device=ApproverNotifications.prefs(getContext()).getString("device",""),encrypted=ApproverNotifications.prefs(getContext()).getString("secret","");synchronized(ApproverNotifications.class){EPOCH.incrementAndGet();ApproverNotifications.clear(getContext());}call.resolve();
  ApproverNotifications.IO.execute(()->{try{ApproverNotifications.request("DELETE","/devices/current",null,device,ApproverSecrets.decrypt(encrypted));}catch(Exception ignored){}});
 }
 @PluginMethod public void openSettings(PluginCall call){getActivity().startActivity(new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE,getContext().getPackageName()));call.resolve();}
 @PluginMethod public void pendingAction(PluginCall call){Intent i=getActivity().getIntent();JSObject r=new JSObject();r.put("tab",i.getStringExtra("notification_tab"));i.removeExtra("notification_tab");call.resolve(r);}
}
