package com.aspromex.gvmobility.supervisor.testing;
final class PriorityAlertPolicy {
 static boolean shouldAlert(int previous,String previousSignature,int count,String signature){
  return count>0&&(previous<=0||count>previous||(count==previous&&!signature.equals(previousSignature)));
 }
}
