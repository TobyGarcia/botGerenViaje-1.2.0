package com.aspromex.gerenciamientoviajes;

import java.io.File;
import java.io.FileOutputStream;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.annotation.Config;
import static org.junit.Assert.*;

@RunWith(RobolectricTestRunner.class)
@Config(sdk=28)
public class NativeApkUpdaterTest {
    @Test public void corruptDownloadIsRejectedBeforeInstallerCanOpen() throws Exception {
        var context=RuntimeEnvironment.getApplication();
        File file=File.createTempFile("corrupt-update-",".apk",context.getCacheDir());
        try {
            try(var output=new FileOutputStream(file)){output.write(new byte[]{1,2,3});}
            SecurityException error=assertThrows(SecurityException.class,()->NativeApkUpdater.verify(context,file,"0".repeat(64),12));
            assertTrue(error.getMessage().contains("verificación"));
        }finally{file.delete();}
    }
    @Test public void missingDownloadedApkCannotBeInstalled() {
        var context=RuntimeEnvironment.getApplication();NativeApkUpdater.apk(context).delete();
        assertThrows(java.io.FileNotFoundException.class,()->NativeApkUpdater.verifyReady(context));
    }
}
