package com.aspromex.gerenciamientoviajes;

import android.app.job.JobInfo;
import android.app.job.JobScheduler;
import android.content.Context;
import android.app.Application;
import android.app.Notification;
import android.app.NotificationManager;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.Robolectric;
import org.robolectric.Shadows;
import org.robolectric.annotation.Config;
import static org.junit.Assert.*;

@RunWith(RobolectricTestRunner.class)
@Config(sdk=28)
public class GpsQueueTest {
    private Context context;
    private GpsDatabase db;
    private JobScheduler scheduler;

    @Before public void reset() {
        context=RuntimeEnvironment.getApplication();db=GpsDatabase.get(context);
        for(String table:new String[]{"locations","sessions","completions","settings"})db.getWritableDatabase().delete(table,null,null);
        db.getWritableDatabase().execSQL("DROP TRIGGER IF EXISTS fail_gps_write");
        scheduler=(JobScheduler)context.getSystemService(Context.JOB_SCHEDULER_SERVICE);scheduler.cancelAll();
    }

    private JSONObject point(String id) throws Exception {
        return new JSONObject().put("clientLocationId",id).put("idViaje","11")
            .put("latitud",19.83).put("longitud",-90.52).put("fechaGps","2026-10-27T15:00:00Z");
    }

    @Test public void offlineCapturesSurviveReopenAndOnlyAcknowledgedIdsDisappear() throws Exception {
        db.save(point("a"));db.save(point("b"));db.save(point("a"));db.close();
        assertEquals(2,db.pending("11",100).length());
        assertEquals("2026-10-27T15:00:00Z",db.pending("11",100).getJSONObject(0).getString("fechaGps"));
        db.acknowledge(new JSONArray().put("a"),false);db.acknowledge(new JSONArray().put("b"),true);
        assertEquals(0,db.count("11",false));assertEquals(1,db.count("11",true));
        db.close();assertEquals(1,db.count("11",true));
    }

    @Test public void failedDiskWriteDoesNotPretendCaptureWasSaved() throws Exception {
        db.getWritableDatabase().execSQL("CREATE TRIGGER fail_gps_write BEFORE INSERT ON locations BEGIN SELECT RAISE(ABORT,'storage failure'); END");
        assertThrows(android.database.sqlite.SQLiteException.class,()->db.save(point("lost")));
        assertEquals(0,db.count("11",true));
    }

    @Test public void newCapturesDoNotPostponeExistingNetworkJob() throws Exception {
        db.save(point("a"));GpsSync.schedule(context);
        JobInfo original=scheduler.getPendingJob(7312);assertNotNull(original);
        assertEquals(JobInfo.NETWORK_TYPE_ANY,original.getNetworkType());assertTrue(original.isPersisted());
        db.save(point("b"));GpsSync.schedule(context);
        assertSame(original,scheduler.getPendingJob(7312));assertEquals(1,scheduler.getAllPendingJobs().size());
    }

    @Test public void rejectedCapturesStayForReviewWithoutSchedulingAnEmptyUpload() throws Exception {
        db.save(point("a"));db.acknowledge(new JSONArray().put("a"),true);GpsSync.schedule(context);
        assertNull(scheduler.getPendingJob(7312));assertEquals(1,db.count("11",true));
    }

    @Test public void offlineCompletionStopsCaptureAndRemainsQueuedAfterReopen() throws Exception {
        db.put("active","true");db.put("trip","11");
        db.completion("11",new JSONObject().put("clientId","close-11").put("action","finalizado").put("kilometrajeFinal",170233));
        assertEquals("false",db.read("active","true"));assertFalse(db.saveIfActive(point("late")));
        db.close();assertEquals("close-11",db.completion("11").getString("clientId"));
        GpsSync.schedule(context);assertNotNull(scheduler.getPendingJob(7312));
    }

    @Test public void activeTripNotificationOpensOdometerWithoutClosingTrip() throws Exception {
        Shadows.shadowOf((Application)context).grantPermissions(android.Manifest.permission.ACCESS_FINE_LOCATION);
        db.put("active","true");db.put("trip","11");db.put("folio","VJ-20261027-0002");
        db.put("startedAt",String.valueOf(System.currentTimeMillis()));db.save(point("a"));
        var service=Robolectric.buildService(GpsTrackingService.class).create();
        try {
            service.startCommand(0,1);
            NotificationManager notifications=(NotificationManager)context.getSystemService(Context.NOTIFICATION_SERVICE);
            Notification notification=null;
            for(var entry:notifications.getActiveNotifications())if(entry.getId()==7310)notification=entry.getNotification();
            assertNotNull(notification);
            assertTrue(notification.extras.getCharSequence(Notification.EXTRA_TITLE).toString().contains("VJ-20261027-0002"));
            assertTrue((notification.flags & Notification.FLAG_ONGOING_EVENT)!=0);
            assertEquals("gv.finish",Shadows.shadowOf(notification.actions[1].actionIntent).getSavedIntent().getAction());
            assertEquals("true",db.read("active","false"));assertNull(db.completion("11"));
        } finally { service.destroy(); }
    }
}
