package com.aspromex.gvmobility.supervisor.testing;
import com.google.firebase.messaging.FirebaseMessagingService;import com.google.firebase.messaging.RemoteMessage;import org.json.JSONObject;
public class ApproverFirebaseService extends FirebaseMessagingService {
 @Override public void onNewToken(String token){ApproverNotifications.IO.execute(()->{try{ApproverNotifications.token(getApplicationContext(),token);}catch(Exception ignored){}});}
 @Override public void onMessageReceived(RemoteMessage message){String snapshot=message.getData().get("snapshot");if(snapshot==null)return;try{ApproverNotifications.apply(getApplicationContext(),new JSONObject(snapshot));}catch(Exception ignored){}}
}
