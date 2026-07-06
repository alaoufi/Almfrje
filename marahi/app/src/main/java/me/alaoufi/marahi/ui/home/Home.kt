package me.alaoufi.marahi.ui.home

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Backup
import androidx.compose.material.icons.filled.Healing
import androidx.compose.material.icons.filled.PregnantWoman
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Vaccines
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.navigation.NavController
import me.alaoufi.marahi.ServiceLocator
import me.alaoufi.marahi.data.AnimalType
import me.alaoufi.marahi.data.DateUtil
import me.alaoufi.marahi.ui.Routes
import me.alaoufi.marahi.ui.common.InfoRow
import me.alaoufi.marahi.ui.common.ListCard
import me.alaoufi.marahi.ui.common.SectionCard

@Composable
fun HomeScreen(nav: NavController) {
    val repo = ServiceLocator.repository
    val present by repo.animalDao.countByStatus("PRESENT").collectAsState(initial = 0)
    val today = DateUtil.today()
    val births by repo.pregnancyDao.upcoming(today, today + 7 * 86_400_000L).collectAsState(emptyList())
    val vaccs by repo.vaccinationDao.upcoming(today, today + 30 * 86_400_000L).collectAsState(emptyList())
    val treatments by repo.treatmentDao.active(today).collectAsState(emptyList())
    val animals by repo.animalDao.all().collectAsState(emptyList())
    val byId = remember(animals) { animals.associateBy { it.id } }

    var query by remember { mutableStateOf("") }

    LazyColumn(
        Modifier.fillMaxSize().padding(horizontal = 12.dp),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(vertical = 12.dp)
    ) {
        item {
            Text(
                "مراحي",
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.primary
            )
            Text("متابعة الحلال من الولادة حتى البيع", color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        item {
            Row(Modifier.fillMaxWidth().padding(top = 12.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                StatCard("عدد الحلال", present.toString(), Modifier.weight(1f), MaterialTheme.colorScheme.primaryContainer)
                StatCard("ولادات قادمة", births.size.toString(), Modifier.weight(1f), Color(0xFFFFE0B2))
            }
            Row(Modifier.fillMaxWidth().padding(top = 10.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                StatCard("تطعيمات قادمة", vaccs.size.toString(), Modifier.weight(1f), Color(0xFFB3E5FC))
                StatCard("علاجات حالية", treatments.size.toString(), Modifier.weight(1f), Color(0xFFFFCDD2))
            }
        }

        // البحث
        item {
            OutlinedTextField(
                value = query,
                onValueChange = { query = it },
                label = { Text("ابحث برقم/وسم/اسم البهيمة") },
                leadingIcon = { Icon(Icons.Filled.Search, null) },
                singleLine = true,
                modifier = Modifier.fillMaxWidth().padding(top = 12.dp)
            )
        }
        if (query.isNotBlank()) {
            val results = animals.filter {
                it.code.contains(query, true) || it.name.contains(query, true) ||
                    it.penNumber.contains(query, true)
            }.take(8)
            items(results) { a ->
                ListCard(onClick = { nav.navigate("${Routes.ANIMAL_DETAIL}/${a.id}") }) {
                    Text(a.display, fontWeight = FontWeight.Bold)
                    Text(AnimalType.fromName(a.type).ar, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }

        // الولادات القادمة
        item {
            SectionCard(title = "الولادات القادمة (٧ أيام)") {
                if (births.isEmpty()) Text("لا يوجد", color = MaterialTheme.colorScheme.onSurfaceVariant)
                births.forEach { p ->
                    val a = byId[p.animalId]
                    InfoRow(
                        a?.display ?: "بهيمة #${p.animalId}",
                        "${DateUtil.format(p.expectedBirthDate)} (بعد ${DateUtil.daysUntil(p.expectedBirthDate)} يوم)"
                    )
                }
            }
        }
        // العلاجات الحالية
        item {
            SectionCard(title = "العلاجات الحالية (تحت التحريم)") {
                if (treatments.isEmpty()) Text("لا يوجد", color = MaterialTheme.colorScheme.onSurfaceVariant)
                treatments.forEach { t ->
                    val a = byId[t.animalId]
                    InfoRow(
                        a?.display ?: "بهيمة #${t.animalId}",
                        "${t.medName} • ينتهي ${DateUtil.format(t.withdrawalEndDate)}"
                    )
                }
            }
        }
    }
}

@Composable
private fun StatCard(label: String, value: String, modifier: Modifier, bg: Color) {
    Card(modifier = modifier, colors = CardDefaults.cardColors(containerColor = bg)) {
        Column(Modifier.padding(16.dp)) {
            Text(value, style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
            Text(label)
        }
    }
}

@Composable
fun AlertsScreen(nav: NavController) {
    val repo = ServiceLocator.repository
    val today = DateUtil.today()
    val animals by repo.animalDao.all().collectAsState(emptyList())
    val byId = remember(animals) { animals.associateBy { it.id } }
    val births by repo.pregnancyDao.upcoming(today, today + 7 * 86_400_000L).collectAsState(emptyList())
    val vaccs by repo.vaccinationDao.upcoming(today, today + 30 * 86_400_000L).collectAsState(emptyList())
    val treatments by repo.treatmentDao.active(today).collectAsState(emptyList())

    LazyColumn(Modifier.fillMaxSize().padding(12.dp)) {
        item {
            Text("التنبيهات", style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
        }
        item {
            SectionCard("ولادة متوقعة خلال ٧ أيام") {
                if (births.isEmpty()) Text("لا يوجد", color = MaterialTheme.colorScheme.onSurfaceVariant)
                births.forEach { p ->
                    InfoRow(byId[p.animalId]?.display ?: "#${p.animalId}",
                        "${DateUtil.format(p.expectedBirthDate)} • ${DateUtil.daysUntil(p.expectedBirthDate)} يوم")
                }
            }
        }
        item {
            SectionCard("انتهاء مدة التحريم (علاجات جارية)") {
                if (treatments.isEmpty()) Text("لا يوجد", color = MaterialTheme.colorScheme.onSurfaceVariant)
                treatments.forEach { t ->
                    InfoRow(byId[t.animalId]?.display ?: "#${t.animalId}",
                        "${t.medName} • ينتهي ${DateUtil.format(t.withdrawalEndDate)}")
                }
            }
        }
        item {
            SectionCard("مواعيد تطعيم قادمة") {
                if (vaccs.isEmpty()) Text("لا يوجد", color = MaterialTheme.colorScheme.onSurfaceVariant)
                vaccs.forEach { v ->
                    InfoRow(byId[v.animalId]?.display ?: "#${v.animalId}",
                        DateUtil.format(v.nextDueDate))
                }
            }
        }
    }
}

private data class MoreItem(val label: String, val route: String, val icon: androidx.compose.ui.graphics.vector.ImageVector)

@Composable
fun MoreScreen(nav: NavController) {
    val items = listOf(
        MoreItem("الحمل والمتابعة", Routes.PREGNANCIES, Icons.Filled.PregnantWoman),
        MoreItem("أنواع التطعيمات", Routes.VACCINE_TYPES, Icons.Filled.Vaccines),
        MoreItem("إعطاء تطعيم", "${Routes.VACCINATE}/0", Icons.Filled.Vaccines),
        MoreItem("إضافة علاج", "${Routes.TREAT}/0", Icons.Filled.Healing),
        MoreItem("النسخ الاحتياطي", Routes.BACKUP, Icons.Filled.Backup),
    )
    LazyColumn(Modifier.fillMaxSize().padding(12.dp)) {
        item {
            Text("المزيد", style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary,
                modifier = Modifier.padding(bottom = 8.dp))
        }
        items(items) { m ->
            Card(Modifier.fillMaxWidth().padding(vertical = 5.dp).clickable { nav.navigate(m.route) }) {
                Row(Modifier.fillMaxWidth().padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                    Icon(m.icon, null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(26.dp))
                    Box(Modifier.size(12.dp))
                    Text(m.label, style = MaterialTheme.typography.titleMedium)
                }
            }
        }
    }
}
