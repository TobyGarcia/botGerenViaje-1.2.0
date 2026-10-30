package com.aspromex.gerenciamientoviajes;

/** JSON bridge integers may arrive as Integer, Long or Double. */
final class BridgeNumbers {
    private BridgeNumbers() {}

    static long integer(Object value, long fallback) {
        if (!(value instanceof Number)) return fallback;
        Number number = (Number) value;
        double numeric = number.doubleValue();
        if (Double.isNaN(numeric) || Double.isInfinite(numeric) || Math.abs(numeric) > 9007199254740991d || numeric != Math.rint(numeric)) return fallback;
        return number.longValue();
    }
}
