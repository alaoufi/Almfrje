package me.alaoufi.marahi

import android.app.Application
import me.alaoufi.marahi.data.BackupManager
import me.alaoufi.marahi.data.Repository

/** موضع الخدمات العام للتطبيق */
object ServiceLocator {
    lateinit var repository: Repository
        private set
    lateinit var backup: BackupManager
        private set

    fun init(app: Application) {
        repository = Repository.from(app)
        backup = BackupManager(app, repository)
    }
}

class MarahiApp : Application() {
    override fun onCreate() {
        super.onCreate()
        ServiceLocator.init(this)
    }
}
