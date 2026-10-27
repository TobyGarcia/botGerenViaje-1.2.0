package com.aspromex.gerenciamientoviajes;

import android.content.Context;
import android.content.Intent;
import android.content.pm.*;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.core.content.pm.PackageInfoCompat;
import androidx.core.content.FileProvider;
import java.io.*;
import java.net.*;
import java.security.MessageDigest;

/** Private download, integrity and signer checks precede the Android installer. */
final class NativeApkUpdater {
    static volatile long downloaded,total;
    private static final long MAX_BYTES=200L*1024*1024;
    private NativeApkUpdater() {}
    static File apk(Context context){return new File(context.getCacheDir(),"android-updates/update.apk");}

    static void download(Context context,String url,String sha,long version) throws Exception {
        downloaded=0;total=0;
        URI uri=ApkUpdateSecurity.downloadUri(url,false);
        if(!sha.matches("[a-f0-9]{64}") || version<=0)throw new SecurityException("Faltan datos de verificación de la actualización.");
        File apk=apk(context), directory=apk.getParentFile();
        if(!directory.isDirectory() && !directory.mkdirs())throw new IOException("No se pudo preparar la descarga.");
        if(apk.isFile()) {
            try{verify(context,apk,sha,version);remember(context,sha,version);return;}catch(Exception ignored){}
        }
        File part=new File(directory,"update.part.apk");HttpURLConnection connection=null;
        try {
            for(int redirects=0;redirects<=5;redirects++) {
                connection=(HttpURLConnection)uri.toURL().openConnection();
                connection.setInstanceFollowRedirects(false);connection.setConnectTimeout(15000);connection.setReadTimeout(30000);
                connection.setRequestProperty("Accept","application/octet-stream");
                int status=connection.getResponseCode();
                if(status==301 || status==302 || status==303 || status==307 || status==308) {
                    String location=connection.getHeaderField("Location");
                    if(location==null || redirects==5)throw new IOException("Redirección de descarga inválida.");
                    uri=ApkUpdateSecurity.downloadUri(uri.resolve(location).toString(),true);connection.disconnect();connection=null;continue;
                }
                if(status!=200)throw new IOException("No se pudo descargar la APK ("+status+").");
                total=connection.getContentLengthLong();
                if(total>MAX_BYTES || directory.getUsableSpace()<Math.max(total,20L*1024*1024)+10L*1024*1024)throw new IOException("No hay espacio suficiente para descargar la actualización.");
                long deadline=android.os.SystemClock.elapsedRealtime()+300000;
                try(InputStream input=connection.getInputStream();FileOutputStream output=new FileOutputStream(part)) {
                    byte[] buffer=new byte[32768];int count;
                    while((count=input.read(buffer))!=-1) {
                        if(downloaded+count>MAX_BYTES || android.os.SystemClock.elapsedRealtime()>deadline)throw new IOException("La descarga se interrumpió. Inténtalo nuevamente.");
                        output.write(buffer,0,count);downloaded+=count;
                    }
                    output.getFD().sync();
                }
                if(downloaded==0 || (total>0 && downloaded!=total))throw new IOException("La descarga está incompleta. Inténtalo nuevamente.");
                break;
            }
            verify(context,part,sha,version);
            if(apk.exists() && !apk.delete())throw new IOException("No se pudo reemplazar la descarga anterior.");
            if(!part.renameTo(apk))throw new IOException("No se pudo guardar la actualización.");
            remember(context,sha,version);
        }finally{if(connection!=null)connection.disconnect();if(part.exists())part.delete();}
    }
    private static void remember(Context context,String sha,long version){
        context.getSharedPreferences("android-update",0).edit().putString("sha256",sha).putLong("version",version).apply();
    }
    private static String[] signers(PackageInfo info) {
        Signature[] signatures=Build.VERSION.SDK_INT>=28 && info.signingInfo!=null?info.signingInfo.getApkContentsSigners():info.signatures;
        if(signatures==null)return null;
        String[] result=new String[signatures.length];for(int i=0;i<signatures.length;i++)result[i]=signatures[i].toCharsString();return result;
    }
    static void verify(Context context,File file,String expectedHash,long expectedVersion) throws Exception {
        MessageDigest digest=MessageDigest.getInstance("SHA-256");
        try(InputStream input=new FileInputStream(file)){byte[] buffer=new byte[32768];int count;while((count=input.read(buffer))!=-1)digest.update(buffer,0,count);}
        StringBuilder hash=new StringBuilder();for(byte b:digest.digest())hash.append(String.format(java.util.Locale.ROOT,"%02x",b&255));
        if(!hash.toString().equals(expectedHash))throw new SecurityException("La descarga no pasó la verificación. Inténtalo nuevamente.");
        PackageManager manager=context.getPackageManager();int flags=Build.VERSION.SDK_INT>=28?PackageManager.GET_SIGNING_CERTIFICATES:PackageManager.GET_SIGNATURES;
        PackageInfo installed=manager.getPackageInfo(context.getPackageName(),flags);
        PackageInfo archive=manager.getPackageArchiveInfo(file.getAbsolutePath(),flags);
        if(archive==null)throw new SecurityException("El archivo descargado no es una APK válida.");
        ApkUpdateSecurity.verifyIdentity(installed.packageName,PackageInfoCompat.getLongVersionCode(installed),signers(installed),
            archive.packageName,PackageInfoCompat.getLongVersionCode(archive),signers(archive),expectedVersion);
    }
    static void verifyReady(Context context) throws Exception {
        var preferences=context.getSharedPreferences("android-update",0);
        verify(context,apk(context),preferences.getString("sha256",""),preferences.getLong("version",0));
    }
    static boolean needsPermission(Context context){return Build.VERSION.SDK_INT>=26 && !context.getPackageManager().canRequestPackageInstalls();}
    static Intent installIntent(Context context) {
        if(needsPermission(context))return new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,Uri.parse("package:"+context.getPackageName()));
        Uri uri=FileProvider.getUriForFile(context,context.getPackageName()+".fileprovider",apk(context));
        return new Intent(Intent.ACTION_VIEW).setDataAndType(uri,"application/vnd.android.package-archive").addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
    }
}
