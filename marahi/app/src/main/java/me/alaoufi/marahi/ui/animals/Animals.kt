package me.alaoufi.marahi.ui.animals

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material3.AssistChip
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
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
import me.alaoufi.marahi.data.AnimalStatus
import me.alaoufi.marahi.data.AnimalType
import me.alaoufi.marahi.data.DateUtil
import me.alaoufi.marahi.data.IdentifierKind
import me.alaoufi.marahi.data.Sex
import me.alaoufi.marahi.ui.Routes
import me.alaoufi.marahi.ui.common.BackScaffold
import me.alaoufi.marahi.ui.common.DateField
import me.alaoufi.marahi.ui.common.DropdownField
import me.alaoufi.marahi.ui.common.InfoRow
import me.alaoufi.marahi.ui.common.LabeledField
import me.alaoufi.marahi.ui.common.ListCard
import me.alaoufi.marahi.ui.common.SectionCard

@Composable
fun AnimalListScreen(nav: NavController) {
    val repo = ServiceLocator.repository
    val animals by repo.animalDao.all().collectAsState(emptyList())
    var filter by remember { mutableStateOf<AnimalType?>(null) }

    BackScaffold(
        title = "الحلال (${animals.size})",
        onBack = { nav.popBackStack() },
        floatingActionButton = {
            ExtendedFloatingActionButton(
                onClick = { nav.navigate("${Routes.ANIMAL_EDIT}/0") },
                icon = { Icon(Icons.Filled.Add, null) },
                text = { Text("إضافة بهيمة") }
            )
        }
    ) { pad ->
        val shown = if (filter == null) animals else animals.filter { it.type == filter!!.name }
        LazyColumn(Modifier.fillMaxSize().padding(pad).padding(horizontal = 12.dp)) {
            item {
                androidx.compose.foundation.layout.Row(
                    Modifier.fillMaxWidth().padding(vertical = 8.dp),
                    horizontalArrangement = androidx.compose.foundation.layout.Arrangement.spacedBy(6.dp)
                ) {
                    AssistChip(onClick = { filter = null }, label = { Text("الكل") })
                    AnimalType.entries.forEach { t ->
                        AssistChip(onClick = { filter = t }, label = { Text(t.ar) })
                    }
                }
            }
            if (shown.isEmpty()) {
                item { Text("لا توجد بهائم بعد. اضغط (إضافة بهيمة).", color = MaterialTheme.colorScheme.onSurfaceVariant) }
            }
            items(shown) { a ->
                ListCard(onClick = { nav.navigate("${Routes.ANIMAL_DETAIL}/${a.id}") }) {
                    Text(a.display, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleMedium)
                    Text(
                        "${AnimalType.fromName(a.type).ar} • ${Sex.fromName(a.sex).ar} • ${AnimalStatus.fromName(a.status).ar}",
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    if (a.penNumber.isNotBlank()) Text("المراح: ${a.penNumber}")
                }
            }
        }
    }
}

@Composable
fun AnimalEditScreen(nav: NavController, id: Long) {
    val repo = ServiceLocator.repository
    val scope = rememberCoroutineScope()
    val existing by repo.animalDao.byId(id).collectAsState(initial = null)
    val females by repo.animalDao.females().collectAsState(emptyList())

    // الحالة المحلية
    var loaded by remember { mutableStateOf(false) }
    var type by remember { mutableStateOf(AnimalType.SHEEP) }
    var penNumber by remember { mutableStateOf("") }
    var idKind by remember { mutableStateOf(IdentifierKind.NUMBER) }
    var code by remember { mutableStateOf("") }
    var name by remember { mutableStateOf("") }
    var sex by remember { mutableStateOf(Sex.FEMALE) }
    var birthDate by remember { mutableStateOf<Long?>(null) }
    var color by remember { mutableStateOf("") }
    var status by remember { mutableStateOf(AnimalStatus.PRESENT) }
    var motherId by remember { mutableStateOf<Long?>(null) }
    var fatherName by remember { mutableStateOf("") }
    var notes by remember { mutableStateOf("") }

    if (id != 0L && existing != null && !loaded) {
        val a = existing!!
        type = AnimalType.fromName(a.type); penNumber = a.penNumber
        idKind = IdentifierKind.fromName(a.identifierKind); code = a.code
        name = a.name; sex = Sex.fromName(a.sex); birthDate = a.birthDate
        color = a.color; status = AnimalStatus.fromName(a.status)
        motherId = a.motherId; fatherName = a.fatherName; notes = a.notes
        loaded = true
    }

    BackScaffold(
        title = if (id == 0L) "إضافة بهيمة" else "تعديل بهيمة",
        onBack = { nav.popBackStack() }
    ) { pad ->
        LazyColumn(Modifier.fillMaxSize().padding(pad).padding(horizontal = 12.dp)) {
            item {
                SectionCard("البيانات الأساسية") {
                    DropdownField("نوع الحلال", AnimalType.entries, type, { it.ar }, { type = it })
                    LabeledField("رقم المراح (الحظيرة)", penNumber, { penNumber = it })
                    DropdownField("نوع المعرّف", IdentifierKind.entries, idKind, { it.ar }, { idKind = it })
                    LabeledField("المعرّف (${idKind.ar})", code, { code = it })
                    LabeledField("الاسم/المسمى (اختياري)", name, { name = it })
                    DropdownField("الجنس", Sex.entries, sex, { it.ar }, { sex = it })
                    DateField("تاريخ الميلاد", birthDate, { birthDate = it })
                    LabeledField("اللون", color, { color = it })
                    DropdownField("الحالة", AnimalStatus.entries, status, { it.ar }, { status = it })
                }
            }
            item {
                SectionCard("النسب") {
                    DropdownField(
                        "الأم",
                        listOf<Animal?>(null) + females.filter { it.id != id },
                        females.firstOrNull { it.id == motherId },
                        { it?.display ?: "— بدون —" },
                        { motherId = it?.id }
                    )
                    LabeledField("الأب / الفحل (اسم أو رقم)", fatherName, { fatherName = it })
                }
            }
            item {
                SectionCard("ملاحظات") {
                    LabeledField("ملاحظات", notes, { notes = it }, singleLine = false)
                }
            }
            item {
                androidx.compose.material3.Button(
                    onClick = {
                        if (code.isBlank() && name.isBlank()) return@Button
                        val a = (existing ?: Animal()).copy(
                            id = id,
                            type = type.name, penNumber = penNumber,
                            code = code.ifBlank { name }, identifierKind = idKind.name,
                            name = name, sex = sex.name, birthDate = birthDate,
                            color = color, status = status.name,
                            motherId = motherId, fatherName = fatherName, notes = notes
                        )
                        scope.launch {
                            repo.saveAnimal(a)
                            nav.popBackStack()
                        }
                    },
                    modifier = Modifier.fillMaxWidth().padding(vertical = 16.dp)
                ) { Text("حفظ") }
            }
        }
    }
}

@Composable
fun AnimalDetailScreen(nav: NavController, id: Long) {
    val repo = ServiceLocator.repository
    val animal by repo.animalDao.byId(id).collectAsState(initial = null)
    val offspring by repo.animalDao.offspring(id).collectAsState(emptyList())
    val matings by repo.matingDao.byAnimal(id).collectAsState(emptyList())
    val pregnancies by repo.pregnancyDao.byAnimal(id).collectAsState(emptyList())
    val vaccinations by repo.vaccinationDao.byAnimal(id).collectAsState(emptyList())
    val treatments by repo.treatmentDao.byAnimal(id).collectAsState(emptyList())
    val mother by repo.animalDao.byId(animal?.motherId ?: -1L).collectAsState(initial = null)

    val a = animal
    BackScaffold(
        title = a?.display ?: "سجل البهيمة",
        onBack = { nav.popBackStack() },
        floatingActionButton = {
            ExtendedFloatingActionButton(
                onClick = { nav.navigate("${Routes.ANIMAL_EDIT}/$id") },
                icon = { Icon(Icons.Filled.Add, null) },
                text = { Text("تعديل") }
            )
        }
    ) { pad ->
        if (a == null) {
            androidx.compose.foundation.layout.Box(Modifier.fillMaxSize().padding(pad)) {}
            return@BackScaffold
        }
        LazyColumn(Modifier.fillMaxSize().padding(pad).padding(horizontal = 12.dp)) {
            item {
                SectionCard("البيانات الأساسية") {
                    InfoRow("النوع", AnimalType.fromName(a.type).ar)
                    InfoRow("المعرّف", "${a.code} (${IdentifierKind.fromName(a.identifierKind).ar})")
                    if (a.name.isNotBlank()) InfoRow("الاسم", a.name)
                    InfoRow("الجنس", Sex.fromName(a.sex).ar)
                    InfoRow("المراح", a.penNumber.ifBlank { "—" })
                    InfoRow("تاريخ الميلاد", DateUtil.format(a.birthDate))
                    InfoRow("اللون", a.color.ifBlank { "—" })
                    InfoRow("الحالة", AnimalStatus.fromName(a.status).ar)
                }
            }
            item {
                SectionCard("النسب") {
                    InfoRow("الأم", mother?.display ?: "—")
                    InfoRow("الأب / الفحل", a.fatherName.ifBlank { "—" })
                    if (a.notes.isNotBlank()) InfoRow("ملاحظات", a.notes)
                }
            }
            item {
                SectionCard("أنتجت (${offspring.size})") {
                    if (offspring.isEmpty()) Text("لا يوجد", color = MaterialTheme.colorScheme.onSurfaceVariant)
                    offspring.forEach { o ->
                        ListCard(onClick = { nav.navigate("${Routes.ANIMAL_DETAIL}/${o.id}") }) {
                            Text(o.display, fontWeight = FontWeight.Bold)
                            Text("${Sex.fromName(o.sex).ar} • ${DateUtil.format(o.birthDate)}",
                                color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }
                }
            }
            item {
                SectionCard("التلقيح والحمل") {
                    androidx.compose.material3.OutlinedButton(
                        onClick = { nav.navigate("${Routes.MATING}/$id") },
                        modifier = Modifier.fillMaxWidth()
                    ) { Text("إضافة تلقيح / متابعة حمل") }
                    matings.forEach { m ->
                        InfoRow("تلقيح ${DateUtil.format(m.date)}", "الفحل: ${m.sireName.ifBlank { m.sireCode.ifBlank { "—" } }}")
                    }
                    pregnancies.forEach { p ->
                        InfoRow(
                            "حمل (${me.alaoufi.marahi.data.PregnancyStatus.fromName(p.status).ar})",
                            "متوقع ${DateUtil.format(p.expectedBirthDate)}"
                        )
                    }
                }
            }
            item {
                SectionCard("التطعيمات (${vaccinations.size})") {
                    androidx.compose.material3.OutlinedButton(
                        onClick = { nav.navigate("${Routes.VACCINATE}/$id") },
                        modifier = Modifier.fillMaxWidth()
                    ) { Text("إعطاء تطعيم") }
                    vaccinations.forEach { v ->
                        InfoRow(DateUtil.format(v.date), "تحريم حتى ${DateUtil.format(v.withdrawalEndDate)}")
                    }
                }
            }
            item {
                SectionCard("العلاجات (${treatments.size})") {
                    androidx.compose.material3.OutlinedButton(
                        onClick = { nav.navigate("${Routes.TREAT}/$id") },
                        modifier = Modifier.fillMaxWidth()
                    ) { Text("إضافة علاج") }
                    treatments.forEach { t ->
                        InfoRow("${t.medName} (${DateUtil.format(t.date)})", "تحريم حتى ${DateUtil.format(t.withdrawalEndDate)}")
                    }
                }
            }
            item { androidx.compose.foundation.layout.Spacer(Modifier.padding(40.dp)) }
        }
    }
}
