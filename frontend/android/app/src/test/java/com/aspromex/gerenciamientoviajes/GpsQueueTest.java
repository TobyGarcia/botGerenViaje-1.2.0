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
        for(String table:new String[]{"locations","sessions","completions","settings","movement_jobs"})db.getWritableDatabase().delete(table,null,null);
        db.getWritableDatabase().execSQL("DROP TRIGGER IF EXISTS fail_gps_write");
        scheduler=(JobScheduler)context.getSystemService(Context.JOB_SCHEDULER_SERVICE);scheduler.cancelAll();
    }

    private JSONObject point(String id) throws Exception {
        return new JSONObject().put("clientLocationId",id).put("idViaje","11")
            .put("latitud",19.83).put("longitud",-90.52).put("fechaGps","2026-10-27T15:00:00Z");
    }

    private JSONObject movement(String revision,long driver) throws Exception {
        return new JSONObject().put("tripId","11").put("driverId",driver).put("origin",BuildConfig.GPS_ORIGIN).put("revision",revision)
            .put("token","must-not-be-stored").put("operations",new JSONArray().put(new JSONObject().put("eventKey","first").put("inspection",new JSONObject().put("captureId","new-inspection"))).put(new JSONObject().put("eventKey","second")));
    }
    @Test public void movementsSurviveCloseAndOnlyAcknowledgedOperationsDisappear() throws Exception {
        db.movements(27,new JSONArray().put(movement("v1",27)));db.close();
        assertEquals(1,db.movementCount());assertFalse(db.movement("11").has("token"));
        assertEquals("new-inspection",db.movement("11").getJSONArray("operations").getJSONObject(0).getJSONObject("inspection").getString("captureId"));
        db.acknowledgeMovement("11","first");db.close();
        assertEquals("second",db.movement("11").getJSONArray("operations").getJSONObject(0).getString("eventKey"));
        GpsSync.schedule(context);assertNotNull(scheduler.getPendingJob(7312));
    }
    @Test public void backgroundAckCannotDeleteNewerMovementsOrAnotherDriversJobs() throws Exception {
        db.movements(27,new JSONArray().put(movement("v1",27)));
        db.movements(27,new JSONArray().put(movement("v2",27)));db.movementDone("11","v1");
        assertNotNull(db.movement("11"));
        try{db.movements(28,new JSONArray().put(movement("bad",27)));fail("Other driver accepted");}catch(SecurityException expected){}
        assertEquals("v2",db.movement("11").getString("revision"));
        db.movements(28,new JSONArray());assertNotNull(db.movement("11"));
        db.movementDone("11","v2");assertEquals(0,db.movementCount());
    }
    @Test public void sqliteUpgradePreservesGpsAndSessions() throws Exception {
        db.save(point("before-upgrade"));db.session("11",11,27,BuildConfig.GPS_ORIGIN,"encrypted");
        db.put("active","true");db.put("trip","11");db.put("folio","VJ-UPGRADE");
        db.completion("11",new JSONObject().put("kilometrajeFinal",1500).put("horaLlegada","2026-11-14T12:30:00Z"));
        db.getWritableDatabase().execSQL("DROP TABLE movement_jobs");db.getWritableDatabase().setVersion(1);db.close();
        assertEquals(1,db.pending("11",100).length());assertEquals(1,db.sessions().length());assertEquals(0,db.movementCount());
        assertEquals("before-upgrade",db.pending("11",100).getJSONObject(0).getString("clientLocationId"));
        assertEquals("2026-10-27T15:00:00Z",db.pending("11",100).getJSONObject(0).getString("fechaGps"));
        assertEquals("encrypted",db.sessions().getJSONObject(0).getString("token"));
        assertEquals(BuildConfig.GPS_ORIGIN,db.sessions().getJSONObject(0).getString("origin"));
        // Queuing a closure stops capture before upgrading; preserve that state too.
        assertEquals("false",db.read("active","true"));assertEquals("VJ-UPGRADE",db.read("folio",""));
        assertEquals(1500,db.completion("11").getInt("kilometrajeFinal"));
        assertEquals("2026-11-14T12:30:00Z",db.completion("11").getString("horaLlegada"));
        assertEquals(2,db.getReadableDatabase().getVersion());
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
