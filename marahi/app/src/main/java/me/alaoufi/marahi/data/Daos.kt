package me.alaoufi.marahi.data

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Update
import kotlinx.coroutines.flow.Flow

@Dao
interface AnimalDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(animal: Animal): Long

    @Update
    suspend fun update(animal: Animal)

    @Delete
    suspend fun delete(animal: Animal)

    @Query("SELECT * FROM animals ORDER BY createdAt DESC")
    fun all(): Flow<List<Animal>>

    @Query("SELECT * FROM animals ORDER BY createdAt DESC")
    suspend fun allOnce(): List<Animal>

    @Query("SELECT * FROM animals WHERE id = :id")
    fun byId(id: Long): Flow<Animal?>

    @Query("SELECT * FROM animals WHERE id = :id")
    suspend fun byIdOnce(id: Long): Animal?

    @Query("SELECT COUNT(*) FROM animals WHERE status = :status")
    fun countByStatus(status: String): Flow<Int>

    @Query(
        "SELECT * FROM animals WHERE " +
            "code LIKE '%' || :q || '%' OR name LIKE '%' || :q || '%' " +
            "OR penNumber LIKE '%' || :q || '%' ORDER BY createdAt DESC"
    )
    fun search(q: String): Flow<List<Animal>>

    /** الأبناء: من كانت أمهم أو أبوهم هذه البهيمة */
    @Query("SELECT * FROM animals WHERE motherId = :id OR fatherId = :id ORDER BY birthDate DESC")
    fun offspring(id: Long): Flow<List<Animal>>

    @Query("SELECT * FROM animals WHERE sex = 'FEMALE' AND status = 'PRESENT' ORDER BY code")
    fun females(): Flow<List<Animal>>
}

@Dao
interface MatingDao {
    @Insert suspend fun insert(m: Mating): Long
    @Delete suspend fun delete(m: Mating)
    @Query("SELECT * FROM matings WHERE animalId = :animalId ORDER BY date DESC")
    fun byAnimal(animalId: Long): Flow<List<Mating>>
    @Query("SELECT * FROM matings ORDER BY date DESC")
    suspend fun allOnce(): List<Mating>
}

@Dao
interface PregnancyDao {
    @Insert suspend fun insert(p: Pregnancy): Long
    @Update suspend fun update(p: Pregnancy)
    @Delete suspend fun delete(p: Pregnancy)
    @Query("SELECT * FROM pregnancies ORDER BY expectedBirthDate ASC")
    fun all(): Flow<List<Pregnancy>>
    @Query("SELECT * FROM pregnancies WHERE animalId = :animalId ORDER BY matingDate DESC")
    fun byAnimal(animalId: Long): Flow<List<Pregnancy>>
    @Query(
        "SELECT * FROM pregnancies WHERE status = 'MONITORING' " +
            "AND expectedBirthDate BETWEEN :from AND :to ORDER BY expectedBirthDate ASC"
    )
    fun upcoming(from: Long, to: Long): Flow<List<Pregnancy>>
    @Query("SELECT * FROM pregnancies ORDER BY expectedBirthDate ASC")
    suspend fun allOnce(): List<Pregnancy>
}

@Dao
interface BirthDao {
    @Insert suspend fun insert(b: Birth): Long
    @Delete suspend fun delete(b: Birth)
    @Query("SELECT * FROM births WHERE motherId = :motherId ORDER BY date DESC")
    fun byMother(motherId: Long): Flow<List<Birth>>
    @Query("SELECT * FROM births ORDER BY date DESC")
    suspend fun allOnce(): List<Birth>
}

@Dao
interface VaccineTypeDao {
    @Insert suspend fun insert(v: VaccineType): Long
    @Update suspend fun update(v: VaccineType)
    @Delete suspend fun delete(v: VaccineType)
    @Query("SELECT * FROM vaccine_types ORDER BY name")
    fun all(): Flow<List<VaccineType>>
    @Query("SELECT * FROM vaccine_types ORDER BY name")
    suspend fun allOnce(): List<VaccineType>
    @Query("SELECT * FROM vaccine_types WHERE id = :id")
    suspend fun byIdOnce(id: Long): VaccineType?
}

@Dao
interface VaccinationDao {
    @Insert suspend fun insert(v: Vaccination): Long
    @Delete suspend fun delete(v: Vaccination)
    @Query("SELECT * FROM vaccinations WHERE animalId = :animalId ORDER BY date DESC")
    fun byAnimal(animalId: Long): Flow<List<Vaccination>>
    @Query("SELECT * FROM vaccinations ORDER BY date DESC")
    fun all(): Flow<List<Vaccination>>
    @Query(
        "SELECT * FROM vaccinations WHERE nextDueDate IS NOT NULL " +
            "AND nextDueDate BETWEEN :from AND :to ORDER BY nextDueDate ASC"
    )
    fun upcoming(from: Long, to: Long): Flow<List<Vaccination>>
    @Query("SELECT * FROM vaccinations ORDER BY date DESC")
    suspend fun allOnce(): List<Vaccination>
}

@Dao
interface TreatmentDao {
    @Insert suspend fun insert(t: Treatment): Long
    @Delete suspend fun delete(t: Treatment)
    @Query("SELECT * FROM treatments WHERE animalId = :animalId ORDER BY date DESC")
    fun byAnimal(animalId: Long): Flow<List<Treatment>>
    @Query("SELECT * FROM treatments WHERE withdrawalEndDate >= :now ORDER BY withdrawalEndDate ASC")
    fun active(now: Long): Flow<List<Treatment>>
    @Query("SELECT * FROM treatments ORDER BY date DESC")
    suspend fun allOnce(): List<Treatment>
}
