package com.aspromex.gerenciamientoviajes;

import java.net.URI;
import java.util.Arrays;
import java.util.HashSet;

final class ApkUpdateSecurity {
    private ApkUpdateSecurity() {}
    static URI downloadUri(String value, boolean redirect) {
        URI uri=URI.create(value);
        String host=uri.getHost();
        boolean github="github.com".equals(host) && uri.getPath()!=null &&
            uri.getPath().startsWith("/TobyGarcia/botGerenViaje-1.2.0/releases/download/") && uri.getPath().endsWith("/gv-mobility.apk");
        boolean asset=redirect && ("release-assets.githubusercontent.com".equals(host) || "objects.githubusercontent.com".equals(host));
        if(!"https".equals(uri.getScheme()) || uri.getUserInfo()!=null || (uri.getPort()!=-1 && uri.getPort()!=443) || (!github && !asset)) {
            throw new SecurityException("Enlace de actualización inválido.");
        }
        return uri;
    }
    static void verifyIdentity(String installedPackage, long installedVersion, String[] installedSigners,
            String archivePackage, long archiveVersion, String[] archiveSigners, long expectedVersion) {
        if(!installedPackage.equals(archivePackage) || archiveVersion!=expectedVersion || archiveVersion<=installedVersion) {
            throw new SecurityException("La APK no corresponde a una actualización de esta aplicación.");
        }
        if(installedSigners==null || archiveSigners==null || installedSigners.length==0 || archiveSigners.length==0 ||
                !new HashSet<>(Arrays.asList(installedSigners)).equals(new HashSet<>(Arrays.asList(archiveSigners)))) {
            throw new SecurityException("La firma de la actualización no coincide con la aplicación instalada.");
        }
    }
}
