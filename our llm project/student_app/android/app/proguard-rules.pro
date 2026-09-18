# ProGuard / R8 Rules for tech.synapticstudio.drphysics

# Flutter Keep Rules
-keep class io.flutter.app.** { *; }
-keep class io.flutter.plugin.** { *; }
-keep class io.flutter.util.** { *; }
-keep class io.flutter.view.** { *; }
-keep class io.flutter.embedding.** { *; }
-keep class io.flutter.provider.** { *; }
# Supabase & Http clients (Dio, OKHttp, JSON etc)
-dontwarn okhttp3.**
-dontwarn okio.**
-dontwarn javax.annotation.**
-dontwarn org.conscrypt.**
-keep class okhttp3.** { *; }
-keep interface okhttp3.** { *; }

# Syncfusion PDF Viewer
-keep class com.syncfusion.flutter.pdfviewer.** { *; }
-dontwarn com.syncfusion.flutter.pdfviewer.**

# Android Jetpack / Firebase / Google Play services warnings
-dontwarn com.google.android.gms.**
-dontwarn com.google.firebase.**
-dontwarn androidx.**

# ExoPlayer / Jetpack Media3
-keep class com.google.android.exoplayer2.** { *; }
-dontwarn com.google.android.exoplayer2.**
-keep class androidx.media3.** { *; }
-dontwarn androidx.media3.**

# Flutter Plugins / Platform Channels
-keep class * extends io.flutter.plugin.common.MethodCallHandler
-keep class * extends io.flutter.plugin.common.PluginRegistry
-keep class io.flutter.plugins.imagepicker.** { *; }
-dontwarn io.flutter.plugins.imagepicker.**
-keep class pt.rupeal.flutter_secure_storage.** { *; }
-dontwarn pt.rupeal.flutter_secure_storage.**

# Lottie / SVG
-keep class com.airbnb.lottie.** { *; }
-dontwarn com.airbnb.lottie.**
-keep class com.caverock.androidsvg.** { *; }
-dontwarn com.caverock.androidsvg.**

# Kotlinx Serialization
-keepattributes *Annotation*,Signature
-keepclassmembers class * {
    *** Companion;
    *** $serializer;
}
-keepclasseswithmembers class * {
    @kotlinx.serialization.Serializable <init>(...);
}
-keepclassmembers class * {
    @kotlinx.serialization.Serializable <fields>;
}
-keep class kotlinx.serialization.** { *; }
-dontwarn kotlinx.serialization.**

# Google Play Core / Deferred Components
-dontwarn com.google.android.play.core.**

# BackEvent warning bypass
-dontwarn android.window.BackEvent

# YouTube Player & WebView Keep Rules
-keep class com.pierfrancescosoffritti.androidyoutubeplayer.** { *; }
-keep interface com.pierfrancescosoffritti.androidyoutubeplayer.* { *; }
-dontwarn com.pierfrancescosoffritti.androidyoutubeplayer.**

-keep class com.pichillilorenzo.flutter_inappwebview.** { *; }
-dontwarn com.pichillilorenzo.flutter_inappwebview.**

-keepattributes JavascriptInterface
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
-keep class android.webkit.** { *; }
-dontwarn android.webkit.**
