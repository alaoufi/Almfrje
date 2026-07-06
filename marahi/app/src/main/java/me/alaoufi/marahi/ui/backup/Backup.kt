package me.alaoufi.marahi.ui.backup

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Share
import androidx.compose.material.icons.filled.Upload
import androidx.compose.material3.Button
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.navigation.NavController
import kotlinx.coroutines.launch
import me.alaoufi.marahi.ServiceLocator
import me.alaoufi.marahi.ui.common.BackScaffold
import me.alaoufi.marahi.ui.common.SectionCard

@Composable
fun BackupScreen(nav: NavController) {
    val backup = ServiceLocator.backup
    val scope = rememberCoroutineScope()
    val context = LocalContext.current
    var status by remember { mutableStateOf("") }

    val importLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.GetContent()
    ) { uri ->
        if (uri != null) {
            scope.launch {
                status = try {
                    val n = backup.importJson(uri)
                    "تمت الاستعادة بنجاح ($n بهيمة)."
                } catch (e: Exception) {
                    "فشلت الاستعادة: ${e.message}"
                }
            }
        }
    }

    BackScaffold(title = "النسخ الاحتياطي", onBack = { nav.popBackStack() }) { pad ->
        Column(
            Modifier.fillMaxSize().padding(pad).padding(horizontal = 12.dp).verticalScroll(rememberScrollState())
        ) {
            SectionCard("حفظ ومشاركة") {
                Text("احفظ نسخة من كل بياناتك وشاركها عبر واتساب أو البريد.",
                    color = MaterialTheme.colorScheme.onSurfaceVariant)
                Button(
                    onClick = {
                        scope.launch {
                            val f = backup.exportJson()
                            status = "تم إنشاء النسخة: ${f.name}"
                            backup.share(f)
                        }
                    },
                    modifier = Modifier.fillMaxWidth().padding(top = 10.dp)
                ) {
                    Icon(Icons.Filled.Share, null); Text("  نسخة JSON ومشاركة")
                }
                OutlinedButton(
                    onClick = {
                        scope.launch {
                            val f = backup.exportCsv()
                            status = "تم إنشاء ملف Excel: ${f.name}"
                            backup.share(f)
                        }
                    },
                    modifier = Modifier.fillMaxWidth().padding(top = 8.dp)
                ) {
                    Icon(Icons.Filled.Share, null); Text("  تصدير Excel (CSV) ومشاركة")
                }
            }

            SectionCard("استعادة") {
                Text("استعادة البيانات من ملف نسخة JSON سابق. سيستبدل البيانات الحالية.",
                    color = MaterialTheme.colorScheme.onSurfaceVariant)
                OutlinedButton(
                    onClick = { importLauncher.launch("application/json") },
                    modifier = Modifier.fillMaxWidth().padding(top = 10.dp)
                ) {
                    Icon(Icons.Filled.Upload, null); Text("  استعادة من ملف")
                }
            }

            if (status.isNotBlank()) {
                Text(status, color = MaterialTheme.colorScheme.primary, modifier = Modifier.padding(top = 12.dp))
            }
        }
    }
}
