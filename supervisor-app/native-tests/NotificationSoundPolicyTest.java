package com.aspromex.gvmobility.supervisor.testing;
import org.junit.Test;import static org.junit.Assert.*;
public class NotificationSoundPolicyTest {
 @Test public void priorityRequestsUseOnlyThePersistentGvNotice(){
  assertEquals(NotificationSoundPolicy.PRIORITY,NotificationSoundPolicy.delivery("management","PENDIENTE",true,true));
  assertEquals(NotificationSoundPolicy.PRIORITY,NotificationSoundPolicy.delivery("inspection","PENDIENTE_APROBACION",true,true));
 }
 @Test public void decisionsNeverCreateANotificationEvenWithPriorityMetadata(){
  for(String state:new String[]{"APROBADO","RECHAZADO"})assertEquals(NotificationSoundPolicy.SKIP,NotificationSoundPolicy.delivery("management",state,false,true));
  for(String state:new String[]{"APROBADA","RECHAZADA"})assertEquals(NotificationSoundPolicy.SKIP,NotificationSoundPolicy.delivery("inspection",state,false,true));
 }
 @Test public void onlyOrdinaryPendingRequestsKeepNormalPhoneSound(){
  assertEquals(NotificationSoundPolicy.NORMAL,NotificationSoundPolicy.delivery("inspection","PENDIENTE_APROBACION",true,false));
  assertEquals(NotificationSoundPolicy.NORMAL,NotificationSoundPolicy.delivery("management","PENDIENTE",true,false));
  for(String state:new String[]{"PENDIENTE","EN_CURSO","FINALIZADO","CANCELADO"})assertEquals(NotificationSoundPolicy.SKIP,NotificationSoundPolicy.delivery("trip",state,false,false));
  assertEquals(NotificationSoundPolicy.SKIP,NotificationSoundPolicy.delivery("stop","PARADA_TECNICA",false,false));
 }
 @Test public void manejoUsesNormalSoundAndNeverNotifiesDecisions(){
  assertEquals(NotificationSoundPolicy.NORMAL,NotificationSoundPolicy.delivery("manejo","PENDIENTE",true,false));
  assertEquals(NotificationSoundPolicy.SKIP,NotificationSoundPolicy.delivery("manejo","PENDIENTE",false,false));
  for(String state:new String[]{"APROBADA","RECHAZADA"})assertEquals(NotificationSoundPolicy.SKIP,NotificationSoundPolicy.delivery("manejo",state,false,false));
 }
 @Test public void resolvedOrObsoleteRequestsNeverReplayThePendingNotice(){
  assertEquals(NotificationSoundPolicy.SKIP,NotificationSoundPolicy.delivery("management","PENDIENTE",false,true));
  assertEquals(NotificationSoundPolicy.SKIP,NotificationSoundPolicy.delivery("inspection","PENDIENTE_APROBACION",false,true));
 }
}
