package com.aspromex.gvmobility.supervisor.testing;
import org.junit.Test;import static org.junit.Assert.*;
public class NotificationSoundPolicyTest {
 @Test public void managementRequestsAndDecisionsUseTheirChannel(){assertTrue(NotificationSoundPolicy.isManagement("management","Gerenciamiento por aprobar"));assertTrue(NotificationSoundPolicy.isManagement("management","Gerenciamiento aprobado"));assertTrue(NotificationSoundPolicy.isManagement("","Gerenciamiento rechazado"));}
 @Test public void otherCategoriesKeepTheirSound(){assertFalse(NotificationSoundPolicy.isManagement("inspection","Inspección por aprobar"));assertFalse(NotificationSoundPolicy.isManagement("trip","Viaje iniciado"));assertFalse(NotificationSoundPolicy.isManagement("stop","Parada técnica"));}
}
