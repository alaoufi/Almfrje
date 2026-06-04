package me.alaoufi.marahi.ui.vaccine

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.navigation.NavController
import kotlinx.coroutines.launch
import me.alaoufi.marahi.ServiceLocator
import me.alaoufi.marahi.data.Animal
import me.alaoufi.marahi.data.DateUtil
import me.alaoufi.marahi.data.VaccineType
import me.alaoufi.marahi.ui.common.BackScaffold
import me.alaoufi.marahi.ui.common.DateField
import me.alaoufi.marahi.ui.common.DropdownField
import me.alaoufi.marahi.ui.common.InfoRow
import me.alaoufi.marahi.ui.common.LabeledField
import me.alaoufi.marahi.ui.common.ListCard
import me.alaoufi.marahi.ui.common.SectionCard

@Composable
fun VaccineTypesScreen(nav: NavController) {
    val repo = ServiceLocator.repository
    val scope = rememberCoroutineScope()
    val types by repo.vaccineTypeDao.all().collectAsState(emptyList())
    var showDialog by remember { mutableStateOf(false) }

    BackScaffold(
        title = "أنواع التطعيمات",
        onBack = { nav.popBackStack() },
        floatingActionButton = {
            ExtendedFloatingActionButton(
                onClick = { showDialog = true },
                icon = { Icon(Icons.Filled.Add, null) },
                text = { Text("نوع تطعيم") }
            )
        }
    ) { pad ->
        LazyColumn(Modifier.fillMaxSize().padding(pad).padding(horizontal = 12.dp)) {
            if (types.isEmpty()) {
                item { Text("عرّف أنواع التطعيمات مرة واحدة لاستخدامها لاحقاً.",
                    color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 12.dp)) }
            }
            items(types) { v ->
                ListCard {
                    Row(Modifier.fillMaxWidth(), verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
                        Column(Modifier.weight(1f)) {
                            Text(v.name, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleMedium)
                            if (v.vaccineName.isNotBlank()) Text("اللقاح: ${v.vaccineName}")
                            Text("مدة التحريم: ${v.withdrawalDays} يوم")
                            if (v.notes.isNotBlank()) Text(v.notes, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                        IconButton(onClick = { scope.launch { repo.deleteVaccineType(v) } }) {
                            Icon(Icons.Filled.Delete, "حذف")
                        }
                    }
                }
            }
        }
    }

    if (showDialog) {
        var name by remember { mutableStateOf("") }
        var vaccineName by remember { mutableStateOf("") }
        var withdrawal by remember { mutableStateOf("") }
        var notes by remember { mutableStateOf("") }
        AlertDialog(
            onDismissRequest = { showDialog = false },
            title = { Text("نوع تطعيم جديد") },
            text = {
                Column {
                    LabeledField("اسم التطعيم", name, { name = it })
                    LabeledField("اسم اللقاح", vaccineName, { vaccineName = it })
                    LabeledField("مدة التحريم (أيام)", withdrawal, { withdrawal = it.filter(Char::isDigit) }, keyboardNumber = true)
                    LabeledField("ملاحظات", notes, { notes = it }, singleLine = false)
                }
            },
            confirmButton = {
                Button(onClick = {
                    if (name.isNotBlank()) {
                        scope.launch {
                            repo.saveVaccineType(VaccineType(
                                name = name, vaccineName = vaccineName,
                                withdrawalDays = withdrawal.toIntOrNull() ?: 0, notes = notes
                            ))
                            showDialog = false
                        }
                    }
                }) { Text("حفظ") }
            },
            dismissButton = { OutlinedButton(onClick = { showDialog = false }) { Text("إلغاء") } }
        )
    }
}

@Composable
fun VaccinateScreen(nav: NavController, animalId: Long) {
    val repo = ServiceLocator.repository
    val scope = rememberCoroutineScope()
    val animals by repo.animalDao.all().collectAsState(emptyList())
    val types by repo.vaccineTypeDao.all().collectAsState(emptyList())
    val preset by repo.animalDao.byId(animalId).collectAsState(initial = null)

    var animal by remember { mutableStateOf<Animal?>(null) }
    if (animalId != 0L && preset != null && animal == null) animal = preset
    var type by remember { mutableStateOf<VaccineType?>(null) }
    var date by remember { mutableStateOf<Long?>(DateUtil.today()) }
    var nextDue by remember { mutableStateOf<Long?>(null) }
    var notes by remember { mutableStateOf("") }

    BackScaffold(title = "إعطاء تطعيم", onBack = { nav.popBackStack() }) { pad ->
        LazyColumn(Modifier.fillMaxSize().padding(pad).padding(horizontal = 12.dp)) {
            item {
                SectionCard("بيانات التطعيم") {
                    if (animalId == 0L) {
                        DropdownField("البهيمة", animals, animal, { it.display }, { animal = it })
                    } else {
                        InfoRow("البهيمة", animal?.display ?: "—")
                    }
                    if (types.isEmpty()) {
                        Text("لا توجد أنواع تطعيمات. عرّفها أولاً من (أنواع التطعيمات).",
                            color = MaterialTheme.colorScheme.error)
                    }
                    DropdownField("التطعيم", types, type, { "${it.name} (${it.withdrawalDays}ي)" }, { type = it })
                    DateField("تاريخ التطعيم", date, { date = it })
                    if (type != null && date != null) {
                        Text("انتهاء التحريم: ${DateUtil.format(date!! + type!!.withdrawalDays * 86_400_000L)}",
                            color = MaterialTheme.colorScheme.primary, modifier = Modifier.padding(vertical = 4.dp))
                    }
                    DateField("موعد الجرعة القادمة (اختياري)", nextDue, { nextDue = it })
                    LabeledField("ملاحظات", notes, { notes = it }, singleLine = false)
                    Button(
                        onClick = {
                            val a = animal ?: return@Button
                            val t = type ?: return@Button
                            val d = date ?: return@Button
                            scope.launch {
                                repo.giveVaccination(a.id, t.id, d, nextDue, notes)
                                nav.popBackStack()
                            }
                        },
                        modifier = Modifier.fillMaxWidth().padding(top = 12.dp)
                    ) { Text("حفظ") }
                }
            }
        }
    }
}
