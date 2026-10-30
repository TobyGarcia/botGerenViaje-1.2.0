package com.aspromex.gerenciamientoviajes;
final class GpsTime {
    static String iso(long millis) {
        java.text.SimpleDateFormat format=new java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",java.util.Locale.US);
        format.setTimeZone(java.util.TimeZone.getTimeZone("UTC"));return format.format(new java.util.Date(millis));
    }
}
