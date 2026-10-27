package com.aspromex.gerenciamientoviajes;

import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;
import org.json.JSONArray;
import org.json.JSONObject;

/** SQLite es la única cola GPS en la APK; una confirmación de red precede al borrado. */
public final class GpsDatabase extends SQLiteOpenHelper {
    private static GpsDatabase instance;
    public static synchronized GpsDatabase get(Context context) {
        if (instance == null) instance = new GpsDatabase(context.getApplicationContext());
        return instance;
    }
    private GpsDatabase(Context context) { super(context, "gv-native-gps.db", null, 1); }
    @Override public void onCreate(SQLiteDatabase db) {
        db.execSQL("CREATE TABLE locations(id TEXT PRIMARY KEY, trip TEXT NOT NULL, gps TEXT NOT NULL, payload TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'pending')");
        db.execSQL("CREATE INDEX locations_trip ON locations(trip,state)");
        db.execSQL("CREATE TABLE settings(name TEXT PRIMARY KEY,value TEXT NOT NULL)");
        db.execSQL("CREATE TABLE sessions(trip TEXT PRIMARY KEY,server INTEGER,driver INTEGER NOT NULL,origin TEXT NOT NULL,token TEXT NOT NULL)");
        db.execSQL("CREATE TABLE completions(trip TEXT PRIMARY KEY,payload TEXT NOT NULL)");
    }
    @Override public void onUpgrade(SQLiteDatabase db, int oldVersion, int newVersion) {
        // Migraciones futuras deben añadirse sin borrar tablas ni capturas.
        throw new IllegalStateException("Migración SQLite no implementada");
    }
    public synchronized void put(String name, String value) {
        ContentValues values = new ContentValues(); values.put("name", name); values.put("value", value);
        if(getWritableDatabase().insertWithOnConflict("settings", null, values, SQLiteDatabase.CONFLICT_REPLACE)==-1) throw new android.database.sqlite.SQLiteException("No se pudo guardar el estado GPS");
    }
    public synchronized String read(String name, String fallback) {
        try (Cursor c = getReadableDatabase().rawQuery("SELECT value FROM settings WHERE name=?", new String[]{name})) {
            return c.moveToFirst() ? c.getString(0) : fallback;
        }
    }
    public synchronized void save(JSONObject point) throws Exception {
        if (!point.has("clientLocationId") || !point.has("idViaje")) throw new IllegalArgumentException("Captura sin identificador");
        double lat = point.getDouble("latitud"), lon = point.getDouble("longitud");
        if (!Double.isFinite(lat) || !Double.isFinite(lon) || Math.abs(lat)>90 || Math.abs(lon)>180 || (lat==0 && lon==0)) throw new IllegalArgumentException("GPS inválido");
        ContentValues values = new ContentValues();
        values.put("id", point.getString("clientLocationId")); values.put("trip", String.valueOf(point.get("idViaje"))); values.put("gps",point.getString("fechaGps")); values.put("payload", point.toString());
        if(getWritableDatabase().insertWithOnConflict("locations", null, values, SQLiteDatabase.CONFLICT_IGNORE)==-1) {
            try(Cursor c=getReadableDatabase().rawQuery("SELECT id FROM locations WHERE id=?",new String[]{point.getString("clientLocationId")})) {
                if(!c.moveToFirst())throw new android.database.sqlite.SQLiteException("No se pudo guardar la ubicación GPS");
            }
        }
    }
    public synchronized boolean saveIfActive(JSONObject point) throws Exception {
        if(!"true".equals(read("active","false")) || !read("trip","").equals(String.valueOf(point.get("idViaje")))) return false;
        save(point);return true;
    }
    public synchronized JSONArray pending(String trip, int limit) throws Exception {
        JSONArray result = new JSONArray();
        try (Cursor c = getReadableDatabase().rawQuery("SELECT payload FROM locations WHERE trip=? AND state='pending' ORDER BY gps,rowid LIMIT ?", new String[]{trip, String.valueOf(limit)})) {
            while (c.moveToNext()) result.put(new JSONObject(c.getString(0)));
        }
        return result;
    }
    public synchronized int count(String trip, boolean includeRejected) {
        String sql = "SELECT COUNT(*) FROM locations WHERE " + (includeRejected ? "1=1" : "state='pending'") + (trip == null ? "" : " AND trip=?");
        try (Cursor c = getReadableDatabase().rawQuery(sql, trip == null ? null : new String[]{trip})) { c.moveToFirst(); return c.getInt(0); }
    }
    public synchronized void acknowledge(JSONArray ids, boolean rejected) throws Exception {
        SQLiteDatabase db=getWritableDatabase(); db.beginTransaction();
        try { for(int i=0;i<ids.length();i++) {
            if (rejected) db.execSQL("UPDATE locations SET state='rejected' WHERE id=?", new Object[]{ids.getString(i)});
            else db.delete("locations", "id=?", new String[]{ids.getString(i)});
        } db.setTransactionSuccessful(); } finally { db.endTransaction(); }
    }
    public synchronized void session(String trip, long server, long driver, String origin, String token) {
        ContentValues values = new ContentValues(); values.put("trip",trip); values.put("server",server); values.put("driver",driver); values.put("origin",origin); values.put("token",token);
        if(getWritableDatabase().insertWithOnConflict("sessions",null,values,SQLiteDatabase.CONFLICT_REPLACE)==-1) throw new android.database.sqlite.SQLiteException("No se pudo guardar la sesión GPS");
    }
    public synchronized JSONArray sessions() throws Exception {
        JSONArray result = new JSONArray();
        try(Cursor c=getReadableDatabase().rawQuery("SELECT trip,server,driver,origin,token FROM sessions",null)) {
            while(c.moveToNext()) result.put(new JSONObject().put("trip",c.getString(0)).put("server",c.getLong(1)).put("driver",c.getLong(2)).put("origin",c.getString(3)).put("token",c.getString(4)));
        } return result;
    }
    public synchronized void completion(String trip, JSONObject value) throws Exception {
        ContentValues values=new ContentValues(); values.put("trip",trip); values.put("payload",value.toString());
        if(getWritableDatabase().insertWithOnConflict("completions",null,values,SQLiteDatabase.CONFLICT_IGNORE)==-1 && completion(trip)==null) throw new android.database.sqlite.SQLiteException("No se pudo guardar el cierre del viaje");
        if(trip.equals(read("trip","")))put("active","false");
    }
    public synchronized JSONObject completion(String trip) throws Exception {
        try(Cursor c=getReadableDatabase().rawQuery("SELECT payload FROM completions WHERE trip=?",new String[]{trip})) {
            return c.moveToFirst()?new JSONObject(c.getString(0)):null;
        }
    }
    public synchronized void completed(String trip) { getWritableDatabase().delete("completions","trip=?",new String[]{trip}); }
    public synchronized int completionCount() { try(Cursor c=getReadableDatabase().rawQuery("SELECT COUNT(*) FROM completions",null)){c.moveToFirst();return c.getInt(0);} }
}
