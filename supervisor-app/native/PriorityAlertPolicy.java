package com.aspromex.gvmobility.supervisor.testing;
final class PriorityAlertPolicy {
 static boolean shouldRefresh(boolean newRequest,boolean present,String previous,String incoming){return newRequest||!present||!incoming.equals(previous);}
 static void publish(Runnable priority,Iterable<Runnable> ordinary){priority.run();for(Runnable notice:ordinary)notice.run();}
 static boolean shouldAlert(boolean newPendingRequest,int count){return newPendingRequest&&count>0;}
 static boolean isCurrentSnapshot(long incoming,long previous){return incoming>=previous;}
}
