# Keep kotlinx-serialization generated serializers
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.**
-keepclassmembers class me.alaoufi.marahi.** {
    *** Companion;
}
-keepclasseswithmembers class me.alaoufi.marahi.** {
    kotlinx.serialization.KSerializer serializer(...);
}
