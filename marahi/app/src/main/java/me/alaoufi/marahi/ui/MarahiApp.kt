package me.alaoufi.marahi.ui

import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.List
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.MoreHoriz
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import me.alaoufi.marahi.ui.animals.AnimalDetailScreen
import me.alaoufi.marahi.ui.animals.AnimalEditScreen
import me.alaoufi.marahi.ui.animals.AnimalListScreen
import me.alaoufi.marahi.ui.backup.BackupScreen
import me.alaoufi.marahi.ui.breeding.MatingScreen
import me.alaoufi.marahi.ui.breeding.PregnancyScreen
import me.alaoufi.marahi.ui.home.AlertsScreen
import me.alaoufi.marahi.ui.home.HomeScreen
import me.alaoufi.marahi.ui.home.MoreScreen
import me.alaoufi.marahi.ui.treatment.TreatmentScreen
import me.alaoufi.marahi.ui.vaccine.VaccinateScreen
import me.alaoufi.marahi.ui.vaccine.VaccineTypesScreen

object Routes {
    const val HOME = "home"
    const val ANIMALS = "animals"
    const val ALERTS = "alerts"
    const val MORE = "more"
    const val ANIMAL_EDIT = "animalEdit"      // /{id}
    const val ANIMAL_DETAIL = "animalDetail"  // /{id}
    const val MATING = "mating"               // /{animalId}
    const val VACCINATE = "vaccinate"         // /{animalId}
    const val TREAT = "treat"                 // /{animalId}
    const val PREGNANCIES = "pregnancies"
    const val VACCINE_TYPES = "vaccineTypes"
    const val BACKUP = "backup"
}

private data class Tab(val route: String, val label: String, val icon: ImageVector)

@Composable
fun MarahiApp() {
    val nav = rememberNavController()
    val tabs = listOf(
        Tab(Routes.HOME, "الرئيسية", Icons.Filled.Home),
        Tab(Routes.ANIMALS, "الحلال", Icons.AutoMirrored.Filled.List),
        Tab(Routes.ALERTS, "التنبيهات", Icons.Filled.Notifications),
        Tab(Routes.MORE, "المزيد", Icons.Filled.MoreHoriz)
    )

    Scaffold(
        bottomBar = {
            val backStack by nav.currentBackStackEntryAsState()
            val current = backStack?.destination?.route
            NavigationBar {
                tabs.forEach { tab ->
                    NavigationBarItem(
                        selected = current == tab.route,
                        onClick = {
                            nav.navigate(tab.route) {
                                popUpTo(nav.graph.findStartDestination().id) { saveState = true }
                                launchSingleTop = true
                                restoreState = true
                            }
                        },
                        icon = { Icon(tab.icon, contentDescription = tab.label) },
                        label = { Text(tab.label) }
                    )
                }
            }
        }
    ) { inner ->
        NavHost(
            navController = nav,
            startDestination = Routes.HOME,
            modifier = Modifier.padding(inner)
        ) {
            composable(Routes.HOME) { HomeScreen(nav) }
            composable(Routes.ANIMALS) { AnimalListScreen(nav) }
            composable(Routes.ALERTS) { AlertsScreen(nav) }
            composable(Routes.MORE) { MoreScreen(nav) }

            composable("${Routes.ANIMAL_EDIT}/{id}") { e ->
                AnimalEditScreen(nav, e.arguments?.getString("id")?.toLongOrNull() ?: 0L)
            }
            composable("${Routes.ANIMAL_DETAIL}/{id}") { e ->
                AnimalDetailScreen(nav, e.arguments?.getString("id")?.toLongOrNull() ?: 0L)
            }
            composable("${Routes.MATING}/{animalId}") { e ->
                MatingScreen(nav, e.arguments?.getString("animalId")?.toLongOrNull() ?: 0L)
            }
            composable("${Routes.VACCINATE}/{animalId}") { e ->
                VaccinateScreen(nav, e.arguments?.getString("animalId")?.toLongOrNull() ?: 0L)
            }
            composable("${Routes.TREAT}/{animalId}") { e ->
                TreatmentScreen(nav, e.arguments?.getString("animalId")?.toLongOrNull() ?: 0L)
            }
            composable(Routes.PREGNANCIES) { PregnancyScreen(nav) }
            composable(Routes.VACCINE_TYPES) { VaccineTypesScreen(nav) }
            composable(Routes.BACKUP) { BackupScreen(nav) }
        }
    }
}
