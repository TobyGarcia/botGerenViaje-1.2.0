package com.aspromex.gvmobility.supervisor.testing;
import org.junit.Test;import static org.junit.Assert.*;
public class PriorityAlertPolicyTest {
 @Test public void newPrioritySoundsOnceAndUnchangedRefreshStaysQuiet(){assertTrue(PriorityAlertPolicy.shouldAlert(0,"",1,"VJ-1"));assertFalse(PriorityAlertPolicy.shouldAlert(1,"VJ-1",1,"VJ-1"));}
 @Test public void newTripsAlertButApprovalsAndClearDoNot(){assertTrue(PriorityAlertPolicy.shouldAlert(1,"VJ-1",2,"VJ-2|VJ-1"));assertTrue(PriorityAlertPolicy.shouldAlert(1,"VJ-1",1,"VJ-2"));assertFalse(PriorityAlertPolicy.shouldAlert(2,"VJ-2|VJ-1",1,"VJ-1"));assertFalse(PriorityAlertPolicy.shouldAlert(1,"VJ-1",0,""));}
}
