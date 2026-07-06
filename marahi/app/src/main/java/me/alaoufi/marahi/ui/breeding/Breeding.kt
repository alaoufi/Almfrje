package me.alaoufi.marahi.ui.breeding

import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.Checkbox
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
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.navigation.NavController
import kotlinx.coroutines.launch
import me.alaoufi.marahi.ServiceLocator
import me.alaoufi.marahi.data.Animal
import me.alaoufi.marahi.data.DateUtil
import me.alaoufi.marahi.data.Mating
import me.alaoufi.marahi.data.Pregnancy
import me.alaoufi.marahi.data.PregnancyStatus
import me.alaoufi.marahi.data.Sex
import me.alaoufi.marahi.ui.common.BackScaffold
import me.alaoufi.marahi.ui.common.DateField
import me.alaoufi.marahi.ui.common.DropdownField
import me.alaoufi.marahi.ui.common.InfoRow
import me.alaoufi.marahi.ui.common.LabeledField
import me.alaoufi.marahi.ui.common.SectionCard

@Composable
fun MatingScreen(nav: NavController, animalId: Long) {
    val repo = ServiceLocator.repository
    val scope = rememberCoroutineScope()
    val females by repo.animalDao.females().collectAsState(emptyList())
    val preset by repo.animalDao.byId(animalId).collectAsState(initial = null)

    var selected by remember { mutableStateOf<Animal?>(null) }
    if (animalId != 0L && preset != null && selected == null) selected = preset

    var date by remember { mutableStateOf<Long?>(DateUtil.today()) }
    var sireCode by remember { mutableStateOf("") }
    var sireName by remember { mutableStateOf("") }
    var notes by remember { mutableStateOf("") }
    var startPregnancy by remember { mutableStateOf(true) }

    BackScaffold(title = "تلقيح / حمل", onBack = { nav.popBackStack() }) { pad ->
        LazyColumn(Modifier.fillMaxSize().padding(pad).padding(horizontal = 12.dp)) {
            item {
                SectionCard("سجل التلقيح") {
                    if (animalId == 0L) {
                        DropdownField("البهيمة (الأم)", females, selected, { it.display }, { selected = it })
                    } else {
                        InfoRow("البهيمة", selected?.display ?: "—")
                    }
                    DateField("تاريخ التلقيح", date, { date = it })
                    LabeledField("رقم الفحل", sireCode, { sireCode = it })
                    LabeledField("اسم الفحل", sireName, { sireName = it })
                    LabeledField("ملاحظات", notes, { notes = it }, singleLine = false)
                    Row(Modifier.fillMaxWidth().padding(top = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                        Checkbox(checked = startPregnancy, onCheckedChange = { startPregnancy = it })
                        Text("بدء متابعة الحمل (يحسب تاريخ الولادة المتوقع تلقائياً)")
                    }
                    val target = selected
                    if (target != null && date != null) {
                        val days = me.alaoufi.marahi.data.AnimalType.fromName(target.type).gestationDays
                        Text(
                            "مدة الحمل المتوقعة: $days يوم → الولادة ${DateUtil.format(date!! + days * 86_400_000L)}",
                            color = MaterialTheme.colorScheme.primary,
                            modifier = Modifier.padding(top = 6.dp)
                        )
                    }
                    Button(
                        onClick = {
                            val a = selected ?: return@Button
                            val d = date ?: return@Button
                            scope.launch {
                                repo.addMating(Mating(animalId = a.id, date = d, sireCode = sireCode, sireName = sireName, notes = notes))
                                if (startPregnancy) repo.startPregnancyFor(a.id, d, notes)
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

@Composable
fun PregnancyScreen(nav: NavController) {
    val repo = ServiceLocator.repository
    val scope = rememberCoroutineScope()
    val pregnancies by repo.pregnancyDao.all().collectAsState(emptyList())
    val animals by repo.animalDao.all().collectAsState(emptyList())
    val byId = remember(animals) { animals.associateBy { it.id } }

    var birthFor by remember { mutableStateOf<Pregnancy?>(null) }

    BackScaffold(title = "الحمل والمتابعة", onBack = { nav.popBackStack() }) { pad ->
        LazyColumn(Modifier.fillMaxSize().padding(pad).padding(horizontal = 12.dp)) {
            if (pregnancies.isEmpty()) {
                item { Text("لا توجد حالات حمل مسجّلة.", color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(top = 12.dp)) }
            }
            items(pregnancies) { p ->
                val mother = byId[p.animalId]
                SectionCard(mother?.display ?: "بهيمة #${p.animalId}") {
                    InfoRow("تاريخ التلقيح", DateUtil.format(p.matingDate))
                    InfoRow("مدة الحمل", "${p.gestationDays} يوم")
                    InfoRow("الولادة المتوقعة", DateUtil.format(p.expectedBirthDate))
                    InfoRow("الحالة", PregnancyStatus.fromName(p.status).ar)
                    if (p.status == PregnancyStatus.MONITORING.name) {
                        Row(Modifier.fillMaxWidth().padding(top = 6.dp),
                            horizontalArrangement = androidx.compose.foundation.layout.Arrangement.spacedBy(8.dp)) {
                            Button(onClick = { birthFor = p }, modifier = Modifier.weight(1f)) { Text("تسجيل ولادة") }
                            OutlinedButton(
                                onClick = { scope.launch { repo.updatePregnancy(p.copy(status = PregnancyStatus.NOT_CONFIRMED.name)) } },
                                modifier = Modifier.weight(1f)
                            ) { Text("لم يثبت") }
                        }
                    }
                }
            }
        }
    }

    val target = birthFor
    if (target != null) {
        BirthDialog(
            motherName = byId[target.animalId]?.display ?: "#${target.animalId}",
            onDismiss = { birthFor = null },
            onConfirm = { code, date, sex, father, notes, createOffspring ->
                scope.launch {
                    repo.recordBirth(target.animalId, code, date, sex, father, notes, createOffspring, target)
                    birthFor = null
                }
            }
        )
    }
}

@Composable
private fun BirthDialog(
    motherName: String,
    onDismiss: () -> Unit,
    onConfirm: (code: String, date: Long, sex: Sex, father: String, notes: String, createOffspring: Boolean) -> Unit
) {
    var code by remember { mutableStateOf("") }
    var date by remember { mutableStateOf<Long?>(DateUtil.today()) }
    var sex by remember { mutableStateOf(Sex.FEMALE) }
    var father by remember { mutableStateOf("") }
    var notes by remember { mutableStateOf("") }
    var createOffspring by remember { mutableStateOf(true) }

    androidx.compose.material3.AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("تسجيل ولادة — $motherName") },
        text = {
            androidx.compose.foundation.layout.Column {
                LabeledField("رقم المولود", code, { code = it })
                DateField("تاريخ الولادة", date, { date = it })
                DropdownField("الجنس", Sex.entries, sex, { it.ar }, { sex = it })
                LabeledField("الأب / الفحل", father, { father = it })
                LabeledField("ملاحظات", notes, { notes = it }, singleLine = false)
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Checkbox(checked = createOffspring, onCheckedChange = { createOffspring = it })
                    Text("إضافة المولود كبهيمة جديدة")
                }
            }
        },
        confirmButton = {
            Button(onClick = { onConfirm(code, date ?: DateUtil.today(), sex, father, notes, createOffspring) }) {
                Text("حفظ")
            }
        },
        dismissButton = { OutlinedButton(onClick = onDismiss) { Text("إلغاء") } }
    )
}
