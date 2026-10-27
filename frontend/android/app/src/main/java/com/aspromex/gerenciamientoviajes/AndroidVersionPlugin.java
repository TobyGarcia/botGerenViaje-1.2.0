package com.aspromex.gerenciamientoviajes;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import android.content.pm.PackageInfo;
import androidx.core.content.pm.PackageInfoCompat;
import java.util.concurrent.Executors;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.atomic.AtomicBoolean;

@CapacitorPlugin(name = "AndroidVersion")
public class AndroidVersionPlugin extends Plugin {
    private static final ExecutorService IO=Executors.newSingleThreadExecutor();
    private static final AtomicBoolean BUSY=new AtomicBoolean(false);
    @PluginMethod public void getDownloadStatus(PluginCall call) {
        JSObject result=new JSObject();result.put("downloading",BUSY.get());
        result.put("progress",NativeApkUpdater.total>0?Math.min(100,(int)(NativeApkUpdater.downloaded*100/NativeApkUpdater.total)):-1);call.resolve(result);
    }
    @PluginMethod public void downloadUpdate(PluginCall call) {
        if(!BUSY.compareAndSet(false,true)){call.reject("Ya hay una descarga en curso.");return;}
        IO.execute(()->{try {
            NativeApkUpdater.download(getContext(),call.getString("url",""),call.getString("sha256","").toLowerCase(java.util.Locale.ROOT),
                BridgeNumbers.integer(call.getData().opt("versionCode"),0));call.resolve();
        }catch(Exception error){call.reject(error.getMessage()==null?"No se pudo descargar la actualización.":error.getMessage());}
        finally{BUSY.set(false);}});
    }
    @PluginMethod public void installUpdate(PluginCall call) {
        IO.execute(()->{try {
            NativeApkUpdater.verifyReady(getContext());
            getActivity().runOnUiThread(()->{try {
                boolean permission=NativeApkUpdater.needsPermission(getContext());
                getActivity().startActivity(NativeApkUpdater.installIntent(getContext()));
                JSObject result=new JSObject();result.put("permissionRequired",permission);call.resolve(result);
            }catch(Exception error){call.reject("No se pudo abrir el instalador de Android.");}});
        }catch(Exception error){call.reject("Descarga nuevamente la actualización antes de instalar.");}});
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
