package com.aspromex.gvmobility.supervisor.testing;
final class NotificationSoundPolicy {
 static boolean isPendingRequest(String category,String state){return ("management".equals(category)&&"PENDIENTE".equals(state))||("inspection".equals(category)&&"PENDIENTE_APROBACION".equals(state));}
 static boolean isDecision(String category,String state){return ("management".equals(category)||"inspection".equals(category))&&!isPendingRequest(category,state);}
 static long[] managementVibration(){return new long[]{0,3000};}
 static boolean isManagement(String category,String title){return "management".equals(category)||(category.isEmpty()&&title.startsWith("Gerenciamiento"));}
}
