package com.aspromex.gerenciamientoviajes;

import org.junit.Test;
import static org.junit.Assert.assertEquals;

public class BridgeNumbersTest {
    @Test public void preservesDriverTripAndTimeAcrossJsonNumberTypes() {
        assertEquals(27L, BridgeNumbers.integer(Integer.valueOf(27), 0L));
        assertEquals(1234L, BridgeNumbers.integer(Long.valueOf(1234), 0L));
        assertEquals(1234L, BridgeNumbers.integer(Double.valueOf(1234), 0L));
        assertEquals(1793111204000L, BridgeNumbers.integer(Long.valueOf(1793111204000L), 0L));
        assertEquals(7200000L, BridgeNumbers.integer(Integer.valueOf(7200000), 0L));
        assertEquals(-1234L, BridgeNumbers.integer(Integer.valueOf(-1234), 0L));
    }

    @Test public void rejectsMissingFractionalAndUnsafeIdentifiers() {
        for (Object invalid : new Object[]{null, "27", true, 27.5d, Double.NaN, Double.POSITIVE_INFINITY, 9007199254740992d}) {
            assertEquals(0L, BridgeNumbers.integer(invalid, 0L));
        }
    }
}
