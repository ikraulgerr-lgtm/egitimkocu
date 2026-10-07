# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.

# Keep line numbers for error reporting
-keepattributes SourceFile,LineNumberTable
-keepattributes *Annotation*
-keepattributes JavascriptInterface
-keepattributes Signature
-keepattributes InnerClasses
-keepattributes EnclosingMethod

# Capacitor Core and Bridge
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

# Capacitor Plugins and Community Packages
-keep class com.getcapacitor.** { *; }
-keep class com.getcapacitor.community.** { *; }
-keep class io.capawesome.** { *; }

# Firebase & Google Play Services & Auth
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.firebase.**
-dontwarn com.google.android.gms.**

# Unused Optional OAuth Providers in Firebase Auth Plugin (Facebook, Twitter, Play Games)
-dontwarn com.facebook.**
-dontwarn com.twitter.**
-dontwarn com.google.android.gms.games.**
-dontwarn com.google.android.play.core.**

# Google Mobile Ads / AdMob
-keep class com.google.android.gms.ads.** { *; }
-keep class androidx.browser.customtabs.** { *; }

# Google Play Billing Client
-keep class com.android.billingclient.** { *; }
-dontwarn com.android.billingclient.**

# AndroidX Core & WebKit
-keep class androidx.webkit.** { *; }
-dontwarn androidx.webkit.**
