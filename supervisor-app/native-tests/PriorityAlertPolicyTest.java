package com.aspromex.gvmobility.supervisor.testing;
import org.junit.Test;import static org.junit.Assert.*;
public class PriorityAlertPolicyTest {
 @Test public void requestArrivalAlertsEvenWhenPendingCountIsUnchanged(){assertTrue(PriorityAlertPolicy.shouldAlert(true,1));assertTrue(PriorityAlertPolicy.shouldAlert(true,5));}
 @Test public void decisionsRefreshesAndClearStayQuiet(){assertFalse(PriorityAlertPolicy.shouldAlert(false,2));assertFalse(PriorityAlertPolicy.shouldAlert(false,1));assertFalse(PriorityAlertPolicy.shouldAlert(true,0));}
 @Test public void delayedSnapshotCannotReplayRequestsAfterApproval(){assertFalse(PriorityAlertPolicy.isCurrentSnapshot(100,200));assertTrue(PriorityAlertPolicy.isCurrentSnapshot(200,200));assertTrue(PriorityAlertPolicy.isCurrentSnapshot(300,200));}
}
