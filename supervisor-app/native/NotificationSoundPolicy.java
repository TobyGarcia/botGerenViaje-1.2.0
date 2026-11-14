package com.aspromex.gvmobility.supervisor.testing;
final class NotificationSoundPolicy {
 static final int SKIP=0,PRIORITY=1,NORMAL=2;
 static int delivery(String category,String state,boolean currentRequest,boolean priority){
  boolean pending=isPendingRequest(category,state);
  if(!pending||!currentRequest)return SKIP;
  return pending&&currentRequest&&priority?PRIORITY:NORMAL;
 }
 static boolean isPendingRequest(String category,String state){return ("manejo".equals(category)&&"PENDIENTE".equals(state))||("management".equals(category)&&"PENDIENTE".equals(state))||("inspection".equals(category)&&"PENDIENTE_APROBACION".equals(state));}
 static boolean isDecision(String category,String state){return ("manejo".equals(category)&&"PENDIENTE".equals(state))||("management".equals(category)||"inspection".equals(category)||"manejo".equals(category))&&!isPendingRequest(category,state);}
 static long[] managementVibration(){return new long[]{0,3000};}
}
