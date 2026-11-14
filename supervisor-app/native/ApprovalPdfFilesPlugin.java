package com.aspromex.gvmobility.supervisor.testing;
import android.app.Activity;
import android.content.Intent;
import android.util.Base64;
import android.util.Base64InputStream;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.*;
import com.getcapacitor.annotation.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicBoolean;

@CapacitorPlugin(name="ApprovalPdfFiles")
public class ApprovalPdfFilesPlugin extends Plugin {
 private final AtomicBoolean saving=new AtomicBoolean();
 @PluginMethod public void save(PluginCall call){
  String data=call.getString("data","");
  if(data.length()<8||data.length()>90000000||!data.startsWith("JVBERi0")){call.reject("PDF inválido para guardar.");return;}
  if(!saving.compareAndSet(false,true)){call.reject("Ya hay un documento guardándose.");return;}
  String name=call.getString("name","viaje.pdf").replaceAll("[^A-Za-z0-9._-]","_");
  if(name.length()>100)name=name.substring(0,96)+".pdf";if(!name.endsWith(".pdf"))name+=".pdf";
  Intent intent=new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("application/pdf").putExtra(Intent.EXTRA_TITLE,name);
  try{startActivityForResult(call,intent,"fileSelected");}catch(Exception e){saving.set(false);call.reject("No se pudo abrir el selector para guardar.");}
 }
 @ActivityCallback private void fileSelected(PluginCall call,ActivityResult result){
  if(call==null){saving.set(false);return;}
  if(result.getResultCode()!=Activity.RESULT_OK||result.getData()==null||result.getData().getData()==null){saving.set(false);JSObject answer=new JSObject();answer.put("cancelled",true);call.resolve(answer);return;}
  android.net.Uri uri=result.getData().getData();
  getBridge().execute(()->{
   try(InputStream in=new Base64InputStream(new ByteArrayInputStream(call.getString("data","").getBytes(StandardCharsets.US_ASCII)),Base64.DEFAULT)){
    byte[] magic=new byte[5];int offset=0,n;while(offset<5&&(n=in.read(magic,offset,5-offset))>0)offset+=n;
    if(offset!=5||!new String(magic,StandardCharsets.US_ASCII).equals("%PDF-"))throw new IOException("PDF inválido");
    try(OutputStream out=getContext().getContentResolver().openOutputStream(uri,"w")){if(out==null)throw new IOException("Archivo no disponible");out.write(magic);byte[] buffer=new byte[32768];while((n=in.read(buffer))!=-1)out.write(buffer,0,n);}
    JSObject answer=new JSObject();answer.put("saved",true);call.resolve(answer);
   }catch(Exception e){call.reject("No se pudo guardar el PDF. Reintenta.");}finally{saving.set(false);}
  });
 }
}
