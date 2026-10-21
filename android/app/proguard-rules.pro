# SecureMobileMCP ProGuard Rules

# Keep WireGuard tunnel classes
-keep class com.wireguard.** { *; }
-keep class com.wireguard.android.** { *; }

# Keep kotlinx.serialization
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.AnnotationsKt
-keepclassmembers class kotlinx.serialization.json.** { *** Companion; }
-keepclasseswithmembers class kotlinx.serialization.json.** {
    kotlinx.serialization.KSerializer serializer(...);
}

# Keep data classes for serialization
-keep class com.securemcp.data.model.** { *; }

# Keep service classes
-keep class com.securemcp.service.** { *; }
