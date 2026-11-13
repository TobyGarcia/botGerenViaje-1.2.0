package com.aspromex.gvmobility.supervisor.testing;
final class NotificationSoundPolicy {
 static long[] managementVibration(){return new long[]{0,3000};}
 static boolean isManagement(String category,String title){return "management".equals(category)||(category.isEmpty()&&title.startsWith("Gerenciamiento"));}
}
