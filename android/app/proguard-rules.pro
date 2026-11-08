# Project specific ProGuard rules for EduMind
# Applied via proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'

# Preserve line numbers and essential reflection annotations
-keepattributes SourceFile,LineNumberTable
-keepattributes *Annotation*
-keepattributes JavascriptInterface
-keepattributes Signature
-keepattributes InnerClasses
-keepattributes EnclosingMethod

# Capacitor Core and Plugin Bridge
-keep public class * extends com.getcapacitor.Plugin {
    public *;
}
-keep public class * extends com.getcapacitor.Bridge {
    public *;
}
-keep public class * extends com.getcapacitor.BridgeActivity {
    public *;
}
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
-keep @interface com.getcapacitor.** { *; }
-keep @interface com.getcapacitor.annotation.** { *; }

# Suppress harmless warnings for optional third-party classes not present at runtime
-dontwarn com.facebook.**
-dontwarn com.twitter.**
-dontwarn com.google.android.gms.games.**
-dontwarn com.google.android.play.core.**
-dontwarn com.google.firebase.**
-dontwarn com.google.android.gms.**
-dontwarn com.android.billingclient.**
-dontwarn androidx.webkit.**
