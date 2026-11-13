package com.aspromex.gvmobility.supervisor.testing;
final class PriorityAlertPolicy {
 static boolean shouldAlert(boolean newPendingRequest,int count){return newPendingRequest&&count>0;}
 static boolean isCurrentSnapshot(long incoming,long previous){return incoming>=previous;}
}
