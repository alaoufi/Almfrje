package me.alaoufi.marahi.data

import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale

object DateUtil {
    private val fmt = SimpleDateFormat("yyyy/MM/dd", Locale.US)

    fun format(millis: Long?): String =
        if (millis == null) "—" else fmt.format(Date(millis))

    fun today(): Long {
        val c = Calendar.getInstance()
        c.set(Calendar.HOUR_OF_DAY, 0)
        c.set(Calendar.MINUTE, 0)
        c.set(Calendar.SECOND, 0)
        c.set(Calendar.MILLISECOND, 0)
        return c.timeInMillis
    }

    fun fromYmd(year: Int, month0: Int, day: Int): Long {
        val c = Calendar.getInstance()
        c.set(year, month0, day, 0, 0, 0)
        c.set(Calendar.MILLISECOND, 0)
        return c.timeInMillis
    }

    /** عدد الأيام المتبقية حتى تاريخ (سالب إن مضى) */
    fun daysUntil(target: Long): Long =
        Math.floorDiv(target - today(), DAY_MS)
}
