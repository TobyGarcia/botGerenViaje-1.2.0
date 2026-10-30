package com.aspromex.gerenciamientoviajes;

import org.junit.Test;
import static org.junit.Assert.*;

public class ApkUpdateSecurityTest {
    private static final String URL="https://github.com/TobyGarcia/botGerenViaje-1.2.0/releases/download/android-testing-v2-20/gv-mobility.apk";
    @Test public void allowsReleaseDownloadAndHttpsAssetRedirectsOnly() {
        assertEquals("github.com",ApkUpdateSecurity.downloadUri(URL,false).getHost());
        assertEquals("release-assets.githubusercontent.com",ApkUpdateSecurity.downloadUri("https://release-assets.githubusercontent.com/file?signature=abc",true).getHost());
        for(String invalid:new String[]{URL.replace("https:","http:"),URL.replace("TobyGarcia","someone"),URL.replace("github.com","github.com.evil.test"),URL.replace("github.com","user@github.com"),URL.replace("github.com","github.com:444"),"file:///tmp/app.apk","https://evil.test/app.apk"}) {
            assertThrows(SecurityException.class,()->ApkUpdateSecurity.downloadUri(invalid,false));
        }
        assertThrows(SecurityException.class,()->ApkUpdateSecurity.downloadUri("https://release-assets.githubusercontent.com/file",false));
        assertThrows(SecurityException.class,()->ApkUpdateSecurity.downloadUri("http://release-assets.githubusercontent.com/file",true));
    }
    @Test public void requiresSameApplicationNewerExactVersionAndSameSigners() {
        String[] signers={"certificate"};
        ApkUpdateSecurity.verifyIdentity("app",11,signers,"app",12,signers,12);
        assertThrows(SecurityException.class,()->ApkUpdateSecurity.verifyIdentity("app",11,signers,"other",12,signers,12));
        assertThrows(SecurityException.class,()->ApkUpdateSecurity.verifyIdentity("app",11,signers,"app",11,signers,11));
        assertThrows(SecurityException.class,()->ApkUpdateSecurity.verifyIdentity("app",11,signers,"app",12,signers,13));
        assertThrows(SecurityException.class,()->ApkUpdateSecurity.verifyIdentity("app",11,signers,"app",12,new String[]{"other"},12));
        assertThrows(SecurityException.class,()->ApkUpdateSecurity.verifyIdentity("app",11,signers,"app",12,null,12));
    }
}
