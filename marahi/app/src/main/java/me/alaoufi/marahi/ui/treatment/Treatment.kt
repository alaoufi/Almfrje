package me.alaoufi.marahi.ui.treatment

import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.Button
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
import androidx.compose.ui.unit.dp
import androidx.navigation.NavController
import kotlinx.coroutines.launch
import me.alaoufi.marahi.ServiceLocator
import me.alaoufi.marahi.data.Animal
import me.alaoufi.marahi.data.DateUtil
import me.alaoufi.marahi.data.Treatment
import me.alaoufi.marahi.ui.common.BackScaffold
import me.alaoufi.marahi.ui.common.DateField
import me.alaoufi.marahi.ui.common.DropdownField
import me.alaoufi.marahi.ui.common.InfoRow
import me.alaoufi.marahi.ui.common.LabeledField
import me.alaoufi.marahi.ui.common.SectionCard

@Composable
fun TreatmentScreen(nav: NavController, animalId: Long) {
    val repo = ServiceLocator.repository
    val scope = rememberCoroutineScope()
    val animals by repo.animalDao.all().collectAsState(emptyList())
    val preset by repo.animalDao.byId(animalId).collectAsState(initial = null)

    var animal by remember { mutableStateOf<Animal?>(null) }
    if (animalId != 0L && preset != null && animal == null) animal = preset
    var treatmentType by remember { mutableStateOf("") }
    var medName by remember { mutableStateOf("") }
    var withdrawal by remember { mutableStateOf("") }
    var date by remember { mutableStateOf<Long?>(DateUtil.today()) }
    var action by remember { mutableStateOf("") }
    var notes by remember { mutableStateOf("") }

    BackScaffold(title = "إضافة علاج", onBack = { nav.popBackStack() }) { pad ->
        LazyColumn(Modifier.fillMaxSize().padding(pad).padding(horizontal = 12.dp)) {
            item {
                SectionCard("بيانات العلاج") {
                    if (animalId == 0L) {
                        DropdownField("البهيمة", animals, animal, { it.display }, { animal = it })
                    } else {
                        InfoRow("البهيمة", animal?.display ?: "—")
                    }
                    LabeledField("نوع العلاج (مثال: مضاد حيوي)", treatmentType, { treatmentType = it })
                    LabeledField("اسم العلاج (مثال: أوكسي تترا)", medName, { medName = it })
                    LabeledField("مدة التحريم (أيام)", withdrawal, { withdrawal = it.filter(Char::isDigit) }, keyboardNumber = true)
                    DateField("تاريخ العلاج", date, { date = it })
                    val days = withdrawal.toIntOrNull() ?: 0
                    if (date != null && days > 0) {
                        Text("انتهاء التحريم: ${DateUtil.format(date!! + days * 86_400_000L)}",
                            color = MaterialTheme.colorScheme.primary, modifier = Modifier.padding(vertical = 4.dp))
                    }
                    LabeledField("الإجراء", action, { action = it })
                    LabeledField("ملاحظات", notes, { notes = it }, singleLine = false)
                    Button(
                        onClick = {
                            val a = animal ?: return@Button
                            val d = date ?: return@Button
                            scope.launch {
                                repo.addTreatment(Treatment(
                                    animalId = a.id, treatmentType = treatmentType, medName = medName,
                                    withdrawalDays = days, date = d, withdrawalEndDate = d, action = action, notes = notes
                                ))
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
