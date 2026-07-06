package me.alaoufi.marahi.data

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase

@Database(
    entities = [
        Animal::class,
        Mating::class,
        Pregnancy::class,
        Birth::class,
        VaccineType::class,
        Vaccination::class,
        Treatment::class
    ],
    version = 1,
    exportSchema = false
)
abstract class AppDatabase : RoomDatabase() {
    abstract fun animalDao(): AnimalDao
    abstract fun matingDao(): MatingDao
    abstract fun pregnancyDao(): PregnancyDao
    abstract fun birthDao(): BirthDao
    abstract fun vaccineTypeDao(): VaccineTypeDao
    abstract fun vaccinationDao(): VaccinationDao
    abstract fun treatmentDao(): TreatmentDao

    companion object {
        @Volatile private var INSTANCE: AppDatabase? = null

        fun get(context: Context): AppDatabase =
            INSTANCE ?: synchronized(this) {
                INSTANCE ?: Room.databaseBuilder(
                    context.applicationContext,
                    AppDatabase::class.java,
                    "marahi.db"
                ).fallbackToDestructiveMigration().build().also { INSTANCE = it }
            }
    }
}
