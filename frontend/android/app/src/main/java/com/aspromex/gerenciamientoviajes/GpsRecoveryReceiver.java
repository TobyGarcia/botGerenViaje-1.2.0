package com.aspromex.gerenciamientoviajes;
import android.content.*;
import android.app.*;
import android.os.Build;
import androidx.core.app.NotificationCompat;
/** Tras reiniciar no se inicia GPS a escondidas: se recupera al abrir el viaje. */
public class GpsRecoveryReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context context,Intent intent){
        GpsDatabase db=GpsDatabase.get(context);
        GpsSync.schedule(context);
        if(!"true".equals(db.read("active","false")))return;
        db.put("gpsStatus","Teléfono reiniciado; abre el viaje para reanudar GPS");
        NotificationManager notifications=(NotificationManager)context.getSystemService(Context.NOTIFICATION_SERVICE);
        if(Build.VERSION.SDK_INT>=26)notifications.createNotificationChannel(new NotificationChannel("gv_trip_reminder","Recordar finalizar viaje",NotificationManager.IMPORTANCE_DEFAULT));
        PendingIntent open=PendingIntent.getActivity(context,7314,new Intent(context,MainActivity.class).setAction("gv.open"),PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
        try{notifications.notify(7314,new NotificationCompat.Builder(context,"gv_trip_reminder").setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle("Tienes un viaje pendiente").setContentText("Abre "+db.read("folio","el viaje")+" para reanudar GPS o finalizarlo.")
            .setContentIntent(open).setAutoCancel(true).build());}catch(SecurityException ignored){}
    }
}
