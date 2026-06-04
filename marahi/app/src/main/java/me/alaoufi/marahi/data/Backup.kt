package me.alaoufi.marahi.data

import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.core.content.FileProvider
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@Serializable
data class BackupData(
    val version: Int = 1,
    val exportedAt: Long = System.currentTimeMillis(),
    val animals: List<Animal> = emptyList(),
    val matings: List<Mating> = emptyList(),
    val pregnancies: List<Pregnancy> = emptyList(),
    val births: List<Birth> = emptyList(),
    val vaccineTypes: List<VaccineType> = emptyList(),
    val vaccinations: List<Vaccination> = emptyList(),
    val treatments: List<Treatment> = emptyList()
)

class BackupManager(private val context: Context, private val repo: Repository) {

    private val json = Json { prettyPrint = true; ignoreUnknownKeys = true }

    private fun backupsDir(): File =
        File(context.cacheDir, "backups").apply { mkdirs() }

    private fun stamp(): String =
        SimpleDateFormat("yyyyMMdd_HHmm", Locale.US).format(Date())

    /** جمع كل البيانات من قاعدة البيانات */
    suspend fun collect(): BackupData = BackupData(
        animals = repo.animalDao.allOnce(),
        matings = repo.matingDao.allOnce(),
        pregnancies = repo.pregnancyDao.allOnce(),
        births = repo.birthDao.allOnce(),
        vaccineTypes = repo.vaccineTypeDao.allOnce(),
        vaccinations = repo.vaccinationDao.allOnce(),
        treatments = repo.treatmentDao.allOnce()
    )

    /** حفظ نسخة JSON وإرجاع الملف */
    suspend fun exportJson(): File = withContext(Dispatchers.IO) {
        val data = collect()
        val file = File(backupsDir(), "marahi_backup_${stamp()}.json")
        file.writeText(json.encodeToString(BackupData.serializer(), data))
        file
    }

    /** حفظ نسخة CSV (تُفتح في Excel) للبهائم */
    suspend fun exportCsv(): File = withContext(Dispatchers.IO) {
        val animals = repo.animalDao.allOnce()
        val sb = StringBuilder()
        sb.append("﻿") // BOM لعرض العربية في Excel
        sb.append("النوع,المراح,المعرف,نوع المعرف,الاسم,الجنس,تاريخ الميلاد,اللون,الحالة,رقم الأم,اسم الأب,ملاحظات\n")
        val animalsById = animals.associateBy { it.id }
        for (a in animals) {
            val motherCode = a.motherId?.let { animalsById[it]?.code ?: "" } ?: ""
            val row = listOf(
                AnimalType.fromName(a.type).ar,
                a.penNumber,
                a.code,
                IdentifierKind.fromName(a.identifierKind).ar,
                a.name,
                Sex.fromName(a.sex).ar,
                a.birthDate?.let { DateUtil.format(it) } ?: "",
                a.color,
                AnimalStatus.fromName(a.status).ar,
                motherCode,
                a.fatherName,
                a.notes
            ).joinToString(",") { csvCell(it) }
            sb.append(row).append("\n")
        }
        val file = File(backupsDir(), "marahi_animals_${stamp()}.csv")
        file.writeText(sb.toString())
        file
    }

    private fun csvCell(s: String): String =
        if (s.contains(',') || s.contains('"') || s.contains('\n'))
            "\"" + s.replace("\"", "\"\"") + "\"" else s

    /** استعادة من ملف JSON: يمسح القاعدة ثم يعيد الإدخال */
    suspend fun importJson(uri: Uri): Int = withContext(Dispatchers.IO) {
        val text = context.contentResolver.openInputStream(uri)!!.bufferedReader().use { it.readText() }
        val data = json.decodeFromString(BackupData.serializer(), text)
        // مسح الكل
        AppDatabase.get(context).clearAllTables()
        data.vaccineTypes.forEach { repo.vaccineTypeDao.insert(it) }
        data.animals.forEach { repo.animalDao.insert(it) }
        data.matings.forEach { repo.matingDao.insert(it) }
        data.pregnancies.forEach { repo.pregnancyDao.insert(it) }
        data.births.forEach { repo.birthDao.insert(it) }
        data.vaccinations.forEach { repo.vaccinationDao.insert(it) }
        data.treatments.forEach { repo.addTreatmentRaw(it) }
        data.animals.size
    }

    /** مشاركة ملف عبر واتساب/البريد */
    fun share(file: File) {
        val uri: Uri = FileProvider.getUriForFile(
            context, "${context.packageName}.fileprovider", file
        )
        val mime = if (file.extension == "csv") "text/csv" else "application/json"
        val intent = Intent(Intent.ACTION_SEND).apply {
            type = mime
            putExtra(Intent.EXTRA_STREAM, uri)
            putExtra(Intent.EXTRA_SUBJECT, "نسخة احتياطية - مراحي")
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        context.startActivity(
            Intent.createChooser(intent, "مشاركة النسخة الاحتياطية").apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
        )
    }
}
