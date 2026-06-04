package me.alaoufi.marahi.data

import androidx.room.Entity
import androidx.room.PrimaryKey
import kotlinx.serialization.Serializable

/** نوع الحلال */
enum class AnimalType(val ar: String, val gestationDays: Int) {
    CAMEL("إبل", 390),
    SHEEP("غنم", 150),
    GOAT("ماعز", 150),
    CATTLE("بقر", 283);

    companion object {
        fun fromName(name: String?): AnimalType =
            entries.firstOrNull { it.name == name } ?: SHEEP
    }
}

enum class Sex(val ar: String) {
    FEMALE("أنثى"),
    MALE("ذكر");

    companion object {
        fun fromName(name: String?): Sex = entries.firstOrNull { it.name == name } ?: FEMALE
    }
}

enum class AnimalStatus(val ar: String) {
    PRESENT("موجودة"),
    SOLD("مباعة"),
    DEAD("نافقة");

    companion object {
        fun fromName(name: String?): AnimalStatus =
            entries.firstOrNull { it.name == name } ?: PRESENT
    }
}

/** نوع معرّف البهيمة (مهم للإبل) */
enum class IdentifierKind(val ar: String) {
    NUMBER("رقم"),
    EAR_TAG("وسم"),
    CHIP("شريحة إلكترونية"),
    NAME("اسم / مسمى");

    companion object {
        fun fromName(name: String?): IdentifierKind =
            entries.firstOrNull { it.name == name } ?: NUMBER
    }
}

enum class PregnancyStatus(val ar: String) {
    MONITORING("تحت المتابعة"),
    BORN("ولدت"),
    NOT_CONFIRMED("لم يثبت الحمل");

    companion object {
        fun fromName(name: String?): PregnancyStatus =
            entries.firstOrNull { it.name == name } ?: MONITORING
    }
}

@Serializable
@Entity(tableName = "animals")
data class Animal(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val type: String = AnimalType.SHEEP.name,
    val penNumber: String = "",        // رقم المراح / الحظيرة
    val code: String = "",             // قيمة المعرّف (رقم/وسم/شريحة/اسم)
    val identifierKind: String = IdentifierKind.NUMBER.name,
    val name: String = "",             // الاسم أو المسمى (اختياري)
    val sex: String = Sex.FEMALE.name,
    val birthDate: Long? = null,
    val color: String = "",
    val status: String = AnimalStatus.PRESENT.name,
    val motherId: Long? = null,        // الأم
    val fatherId: Long? = null,        // الأب إن كان مسجلاً
    val fatherName: String = "",       // اسم/رقم الفحل إن لم يكن مسجلاً
    val notes: String = "",
    val createdAt: Long = System.currentTimeMillis()
) {
    /** اسم العرض: الرقم/الوسم + الاسم إن وجد */
    val display: String
        get() = buildString {
            append(code.ifBlank { "—" })
            if (name.isNotBlank()) append(" • $name")
        }
}

@Serializable
@Entity(tableName = "matings")
data class Mating(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val animalId: Long,                // الأنثى
    val date: Long,                    // تاريخ التلقيح
    val sireCode: String = "",         // رقم الفحل
    val sireName: String = "",         // اسم الفحل
    val notes: String = ""
)

@Serializable
@Entity(tableName = "pregnancies")
data class Pregnancy(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val animalId: Long,
    val matingDate: Long,
    val gestationDays: Int,            // مدة الحمل (تلقائية حسب النوع)
    val expectedBirthDate: Long,       // تاريخ الولادة المتوقع
    val status: String = PregnancyStatus.MONITORING.name,
    val notes: String = ""
)

@Serializable
@Entity(tableName = "births")
data class Birth(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val motherId: Long,
    val offspringAnimalId: Long? = null, // البهيمة المولودة المسجَّلة
    val offspringCode: String = "",      // رقم المولود
    val date: Long,
    val sex: String = Sex.FEMALE.name,
    val fatherName: String = "",
    val notes: String = ""
)

@Serializable
@Entity(tableName = "vaccine_types")
data class VaccineType(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val name: String,                  // اسم التطعيم
    val vaccineName: String = "",      // اسم اللقاح
    val withdrawalDays: Int = 0,       // مدة التحريم
    val notes: String = ""
)

@Serializable
@Entity(tableName = "vaccinations")
data class Vaccination(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val animalId: Long,
    val vaccineTypeId: Long,
    val date: Long,                    // تاريخ التطعيم
    val withdrawalEndDate: Long,       // انتهاء التحريم (تلقائي)
    val nextDueDate: Long? = null,     // موعد الجرعة القادمة (اختياري)
    val notes: String = ""
)

@Serializable
@Entity(tableName = "treatments")
data class Treatment(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val animalId: Long,
    val treatmentType: String = "",    // نوع العلاج (مثال: مضاد حيوي)
    val medName: String = "",          // اسم العلاج (مثال: أوكسي تترا)
    val withdrawalDays: Int = 0,       // مدة التحريم
    val date: Long,                    // تاريخ العلاج
    val withdrawalEndDate: Long,       // انتهاء التحريم (تلقائي)
    val action: String = "",           // الإجراء
    val notes: String = ""
)
