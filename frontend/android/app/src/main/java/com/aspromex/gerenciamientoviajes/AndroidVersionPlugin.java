package com.aspromex.gerenciamientoviajes;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import android.content.pm.PackageInfo;
import androidx.core.content.pm.PackageInfoCompat;
import android.content.Intent;
import android.net.Uri;

@CapacitorPlugin(name = "AndroidVersion")
public class AndroidVersionPlugin extends Plugin {
    @PluginMethod
    public void openDownload(PluginCall call) {
        try {
            Uri uri = Uri.parse(call.getString("url", ""));
            if (!"https".equals(uri.getScheme()) || !"github.com".equals(uri.getHost()) ||
                !uri.getPath().startsWith("/TobyGarcia/botGerenViaje-1.2.0/releases/download/")) {
                call.reject("Enlace de actualización inválido.");
                return;
            }
            getActivity().startActivity(new Intent(Intent.ACTION_VIEW, uri));
            call.resolve();
        } catch (Exception exception) {
            call.reject("No fue posible abrir la descarga.");
        }
    }
    @PluginMethod
    public void getInfo(PluginCall call) {
        try {
            PackageInfo info = getContext().getPackageManager().getPackageInfo(getContext().getPackageName(), 0);
            JSObject result = new JSObject();
            result.put("versionCode", PackageInfoCompat.getLongVersionCode(info));
            result.put("versionName", info.versionName);
            result.put("channel", getContext().getString(R.string.android_update_channel));
            call.resolve(result);
        } catch (Exception exception) {
            call.reject("No fue posible leer la versión instalada.");
        }
    }
}
