package com.aspromex.gerenciamientoviajes;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Hiding the notice must not stop GPS or silently promote the same trip again. */
public class GpsNotificationDismissedReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context context, Intent intent) {
        GpsDatabase db=GpsDatabase.get(context);
        String trip=intent.getStringExtra("trip");
        if(trip!=null && trip.equals(db.read("trip","")) && "true".equals(db.read("active","false"))) {
            db.put("notificationDismissedTrip",trip);
        }
    }
}
