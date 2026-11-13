package com.aspromex.gvmobility.supervisor.testing;
final class NotificationSoundPolicy {
 static boolean isManagement(String category,String title){return "management".equals(category)||(category.isEmpty()&&title.startsWith("Gerenciamiento"));}
}
