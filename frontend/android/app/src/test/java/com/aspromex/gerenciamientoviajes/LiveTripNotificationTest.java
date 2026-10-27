package com.aspromex.gerenciamientoviajes;

import android.app.Application;
import android.app.Notification;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import org.json.JSONObject;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.Robolectric;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.Shadows;
import org.robolectric.annotation.Config;
import static org.junit.Assert.*;

@RunWith(RobolectricTestRunner.class)
@Config(sdk={24,35,36})
public class LiveTripNotificationTest {
    private Context context;
    private GpsDatabase db;
    private NotificationManager notifications;

    @Before public void prepareTrip() throws Exception {
        context=RuntimeEnvironment.getApplication();db=GpsDatabase.get(context);
        for(String table:new String[]{"settings","locations","sessions","completions"})db.getWritableDatabase().delete(table,null,null);
        notifications=(NotificationManager)context.getSystemService(Context.NOTIFICATION_SERVICE);notifications.cancelAll();
        if(Build.VERSION.SDK_INT>=33)Shadows.shadowOf((Application)context).grantPermissions(android.Manifest.permission.POST_NOTIFICATIONS);
        db.put("active","true");db.put("trip","11");db.put("folio","VJ-TEST-0011");db.put("startedAt",String.valueOf(System.currentTimeMillis()-60000));
        db.save(new JSONObject().put("clientLocationId","queued-photo-free-gps").put("idViaje","11").put("latitud",19.83).put("longitud",-90.52).put("fechaGps","2026-10-27T15:00:00Z"));
    }

    @Test public void requestsLiveUpdatesOn16AndKeepsFullFallbackOnOlderAndroid() {
        var service=Robolectric.buildService(GpsTrackingService.class).create();
        try {
            Notification notification=service.get().buildTripNotification();
            assertEquals(Build.VERSION.SDK_INT>=36,notification.extras.getBoolean(NotificationCompat.EXTRA_REQUEST_PROMOTED_ONGOING));
            assertTrue((notification.flags & Notification.FLAG_ONGOING_EVENT)!=0);
            assertEquals(0,notification.flags & Notification.FLAG_AUTO_CANCEL);
            assertTrue(notification.extras.getBoolean(Notification.EXTRA_SHOW_CHRONOMETER));
            assertEquals(2,notification.actions.length);
            assertEquals("gv.finish",Shadows.shadowOf(notification.actions[1].actionIntent).getSavedIntent().getAction());
            assertTrue(notification.extras.getCharSequence(Notification.EXTRA_TITLE).toString().contains("VJ-TEST-0011"));
            assertNull(notification.contentView);
            if(Build.VERSION.SDK_INT>=36)assertEquals("Sin GPS",notification.extras.getString(NotificationCompat.EXTRA_SHORT_CRITICAL_TEXT));
        }finally{service.destroy();}
    }

    @Test public void dismissingDoesNotStopGpsOrEraseQueueAndIsNotRepostedForSameTrip() {
        var service=Robolectric.buildService(GpsTrackingService.class).create();
        try {
            Notification notice=service.get().buildTripNotification();
            Intent dismissal=Shadows.shadowOf(notice.deleteIntent).getSavedIntent();
            new GpsNotificationDismissedReceiver().onReceive(context,dismissal);
            service.get().showNotification();
            assertEquals(0,notifications.getActiveNotifications().length);
            assertEquals("true",db.read("active","false"));assertEquals(1,db.count("11",false));assertNull(db.completion("11"));
            assertFalse(service.get().buildTripNotification().extras.getBoolean(NotificationCompat.EXTRA_REQUEST_PROMOTED_ONGOING));
            db.put("trip","12");db.put("folio","VJ-TEST-0012");
            new GpsNotificationDismissedReceiver().onReceive(context,dismissal);
            service.get().showNotification();
            assertEquals(1,notifications.getActiveNotifications().length);
            assertEquals(Build.VERSION.SDK_INT>=36,service.get().buildTripNotification().extras.getBoolean(NotificationCompat.EXTRA_REQUEST_PROMOTED_ONGOING));
        }finally{service.destroy();}
    }

    @Test public void lateLocationOrTimerCannotRestoreNoticeAfterTripStops() {
        var service=Robolectric.buildService(GpsTrackingService.class).create();
        try {
            db.put("active","false");service.get().showNotification();
            assertEquals(0,notifications.getActiveNotifications().length);
            assertEquals(1,db.count("11",false));
        }finally{service.destroy();}
    }
}
