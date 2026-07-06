package me.alaoufi.marahi.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val Green = Color(0xFF2E7D32)
private val GreenDark = Color(0xFF1B5E20)
private val Sand = Color(0xFFFFF8E1)
private val Amber = Color(0xFFF9A825)

private val LightColors = lightColorScheme(
    primary = Green,
    onPrimary = Color.White,
    primaryContainer = Color(0xFFA5D6A7),
    onPrimaryContainer = GreenDark,
    secondary = Amber,
    onSecondary = Color.Black,
    background = Sand,
    surface = Color.White,
    tertiary = Color(0xFF6D4C41)
)

private val DarkColors = darkColorScheme(
    primary = Color(0xFF81C784),
    onPrimary = Color.Black,
    secondary = Amber,
    background = Color(0xFF121212),
    surface = Color(0xFF1E1E1E)
)

@Composable
fun MarahiTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit
) {
    MaterialTheme(
        colorScheme = if (darkTheme) DarkColors else LightColors,
        content = content
    )
}
