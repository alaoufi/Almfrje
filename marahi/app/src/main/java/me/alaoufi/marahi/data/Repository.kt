package me.alaoufi.marahi.data

import android.content.Context

const val DAY_MS: Long = 24L * 60 * 60 * 1000

class Repository(private val db: AppDatabase) {
    val animalDao = db.animalDao()
    val matingDao = db.matingDao()
    val pregnancyDao = db.pregnancyDao()
    val birthDao = db.birthDao()
    val vaccineTypeDao = db.vaccineTypeDao()
    val vaccinationDao = db.vaccinationDao()
    val treatmentDao = db.treatmentDao()

    // ---- Animals ----
    suspend fun saveAnimal(a: Animal): Long =
        if (a.id == 0L) animalDao.insert(a) else { animalDao.update(a); a.id }

    suspend fun deleteAnimal(a: Animal) = animalDao.delete(a)

    // ---- Mating ----
    suspend fun addMating(m: Mating) = matingDao.insert(m)

    /** يحسب الحمل تلقائياً حسب نوع البهيمة */
    suspend fun startPregnancyFor(animalId: Long, matingDate: Long, notes: String = ""): Long {
        val animal = animalDao.byIdOnce(animalId)
        val days = AnimalType.fromName(animal?.type).gestationDays
        val expected = matingDate + days * DAY_MS
        return pregnancyDao.insert(
            Pregnancy(
                animalId = animalId,
                matingDate = matingDate,
                gestationDays = days,
                expectedBirthDate = expected,
                status = PregnancyStatus.MONITORING.name,
                notes = notes
            )
        )
    }

    suspend fun updatePregnancy(p: Pregnancy) = pregnancyDao.update(p)

    /**
     * تسجيل ولادة: ينشئ بهيمة جديدة للمولود ويربطها بالأم،
     * ويحدّث حالة الحمل إلى "ولدت".
     */
    suspend fun recordBirth(
        motherId: Long,
        offspringCode: String,
        date: Long,
        sex: Sex,
        fatherName: String,
        notes: String,
        createOffspring: Boolean,
        pregnancy: Pregnancy?
    ): Long {
        val mother = animalDao.byIdOnce(motherId)
        var offspringId: Long? = null
        if (createOffspring && offspringCode.isNotBlank()) {
            offspringId = animalDao.insert(
                Animal(
                    type = mother?.type ?: AnimalType.SHEEP.name,
                    penNumber = mother?.penNumber ?: "",
                    code = offspringCode,
                    identifierKind = IdentifierKind.NUMBER.name,
                    sex = sex.name,
                    birthDate = date,
                    status = AnimalStatus.PRESENT.name,
                    motherId = motherId,
                    fatherName = fatherName,
                    notes = notes
                )
            )
        }
        if (pregnancy != null) {
            pregnancyDao.update(pregnancy.copy(status = PregnancyStatus.BORN.name))
        }
        return birthDao.insert(
            Birth(
                motherId = motherId,
                offspringAnimalId = offspringId,
                offspringCode = offspringCode,
                date = date,
                sex = sex.name,
                fatherName = fatherName,
                notes = notes
            )
        )
    }

    // ---- Vaccine ----
    suspend fun saveVaccineType(v: VaccineType): Long =
        if (v.id == 0L) vaccineTypeDao.insert(v) else { vaccineTypeDao.update(v); v.id }

    suspend fun deleteVaccineType(v: VaccineType) = vaccineTypeDao.delete(v)

    /** يعطي تطعيماً ويحسب انتهاء التحريم تلقائياً من نوع التطعيم */
    suspend fun giveVaccination(
        animalId: Long,
        vaccineTypeId: Long,
        date: Long,
        nextDueDate: Long?,
        notes: String
    ): Long {
        val type = vaccineTypeDao.byIdOnce(vaccineTypeId)
        val end = date + (type?.withdrawalDays ?: 0) * DAY_MS
        return vaccinationDao.insert(
            Vaccination(
                animalId = animalId,
                vaccineTypeId = vaccineTypeId,
                date = date,
                withdrawalEndDate = end,
                nextDueDate = nextDueDate,
                notes = notes
            )
        )
    }

    // ---- Treatment ----
    suspend fun addTreatment(t: Treatment): Long {
        val end = t.date + t.withdrawalDays * DAY_MS
        return treatmentDao.insert(t.copy(withdrawalEndDate = end))
    }

    /** إدخال علاج كما هو (يُستخدم في الاستعادة) */
    suspend fun addTreatmentRaw(t: Treatment): Long = treatmentDao.insert(t)

    companion object {
        fun from(context: Context) = Repository(AppDatabase.get(context))
    }
}
