package com.aspromex.gvmobility.supervisor.testing;
import org.junit.Test;import static org.junit.Assert.*;
public class PriorityAlertPolicyTest {
 @Test public void requestArrivalAlertsEvenWhenPendingCountIsUnchanged(){assertTrue(PriorityAlertPolicy.shouldAlert(true,1));assertTrue(PriorityAlertPolicy.shouldAlert(true,5));}
 @Test public void decisionsRefreshesAndClearStayQuiet(){assertFalse(PriorityAlertPolicy.shouldAlert(false,2));assertFalse(PriorityAlertPolicy.shouldAlert(false,1));assertFalse(PriorityAlertPolicy.shouldAlert(true,0));}
 @Test public void delayedSnapshotCannotReplayRequestsAfterApproval(){assertFalse(PriorityAlertPolicy.isCurrentSnapshot(100,200));assertTrue(PriorityAlertPolicy.isCurrentSnapshot(200,200));assertTrue(PriorityAlertPolicy.isCurrentSnapshot(300,200));}
 @Test public void mixedTripRegistrationBatchPublishesGvBeforeNormalNotices(){
  java.util.List<String> delivered=new java.util.ArrayList<>();
  java.util.List<Runnable> ordinary=java.util.Arrays.asList(()->delivered.add("viaje registrado"),()->delivered.add("otro aviso"));
  PriorityAlertPolicy.publish(()->delivered.add("GV prioritario"),ordinary);
  assertEquals(java.util.Arrays.asList("GV prioritario","viaje registrado","otro aviso"),delivered);
 }
 @Test public void unchangedSnapshotDoesNotReplaceAndInterruptThePlayingNotice(){
  assertFalse(PriorityAlertPolicy.shouldRefresh(false,true,"1|VJ-1","1|VJ-1"));
  assertTrue(PriorityAlertPolicy.shouldRefresh(true,true,"1|VJ-1","1|VJ-1"));
  assertTrue(PriorityAlertPolicy.shouldRefresh(false,true,"2|VJ-1|VJ-2","1|VJ-1"));
  assertTrue(PriorityAlertPolicy.shouldRefresh(false,false,"1|VJ-1","1|VJ-1"));
 }
}
