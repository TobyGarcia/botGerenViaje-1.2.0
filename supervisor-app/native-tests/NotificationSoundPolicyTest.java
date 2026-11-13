package com.aspromex.gvmobility.supervisor.testing;
import org.junit.Test;import static org.junit.Assert.*;
public class NotificationSoundPolicyTest {
 @Test public void managementRequestsAndDecisionsUseTheirChannel(){assertTrue(NotificationSoundPolicy.isManagement("management","Gerenciamiento por aprobar"));assertTrue(NotificationSoundPolicy.isManagement("management","Gerenciamiento aprobado"));assertTrue(NotificationSoundPolicy.isManagement("","Gerenciamiento rechazado"));}
 @Test public void onlyPendingRequestsUseRequestSound(){assertTrue(NotificationSoundPolicy.isPendingRequest("management","PENDIENTE"));assertTrue(NotificationSoundPolicy.isPendingRequest("inspection","PENDIENTE_APROBACION"));assertFalse(NotificationSoundPolicy.isPendingRequest("management","APROBADO"));assertFalse(NotificationSoundPolicy.isPendingRequest("management","RECHAZADO"));assertTrue(NotificationSoundPolicy.isDecision("management","APROBADO"));assertTrue(NotificationSoundPolicy.isDecision("inspection","APROBADA"));assertFalse(NotificationSoundPolicy.isDecision("trip","FINALIZADO"));}
 @Test public void otherCategoriesKeepTheirSound(){assertFalse(NotificationSoundPolicy.isManagement("inspection","Inspección por aprobar"));assertFalse(NotificationSoundPolicy.isManagement("trip","Viaje iniciado"));assertFalse(NotificationSoundPolicy.isManagement("stop","Parada técnica"));}
}
