# ProGuard / R8 rules for Fisch Values.
#
# This file was EMPTY until 2026-09-16, while build.gradle used the aggressive
# `proguard-android-optimize.txt`. The first release build ever made therefore
# crashed on launch, every time, before a line of JS ran:
#
#   java.lang.RuntimeException: Unable to get provider
#     androidx.startup.InitializationProvider:
#     Failed to create an instance of class
#     androidx.work.impl.WorkDatabase.canonicalName
#
# Cause: Room builds its database by calling getCanonicalName() on the abstract
# class and reflectively loading "<that name>_Impl". R8 renamed WorkDatabase and
# dropped the attributes canonical-name resolution depends on, so the generated
# WorkDatabase_Impl could not be found. WorkManager is initialised by an
# androidx.startup ContentProvider, so the failure lands in
# handleBindApplication — i.e. the app dies immediately after the splash screen,
# with a stack trace that names nothing in our code.
#
# androidx.work arrives via @notifee/react-native (work-runtime 2.8.0). Every
# sibling app has the same dependency; they survive for different reasons —
# mm2values uses the non-optimize default, Blox_Fruit and adoptme-jan7 use
# -optimize but carry the -keepattributes block below. This fork inherited
# Steal an Egg's config, which had -optimize and no rules, and Steal an Egg was
# never built for release so nobody found out.
#
# Rule of thumb when adding a library: if it resolves classes by name at
# runtime (Room, reflection, JNI, annotation processors), it needs a keep rule.

# ---- Attributes ------------------------------------------------------------
# InnerClasses + EnclosingMethod are what make getCanonicalName() correct.
# Dropping them is what broke Room above. SourceFile/LineNumberTable keep
# Crashlytics stack traces readable; renamesourcefileattribute hides the
# original filenames while preserving line numbers.
-keepattributes *Annotation*
-keepattributes JavascriptInterface
-keepattributes Signature
-keepattributes InnerClasses
-keepattributes EnclosingMethod
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# ---- Room / WorkManager / App Startup --------------------------------------
# The direct cause of the launch crash. Keep the generated _Impl classes and
# everything that finds them by name.
-keep class * extends androidx.room.RoomDatabase { *; }
-keep class androidx.room.** { *; }
-dontwarn androidx.room.**
-keep class androidx.work.** { *; }
-dontwarn androidx.work.**
-keep class androidx.startup.** { *; }
-keep class * implements androidx.startup.Initializer { *; }
-keep class androidx.sqlite.** { *; }
-dontwarn androidx.sqlite.**

# ---- This app --------------------------------------------------------------
-keep class com.fischvaluescalc.** { *; }

# ---- React Native core -----------------------------------------------------
-keep class com.facebook.react.** { *; }
-keep class com.facebook.react.bridge.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }
-keep class com.facebook.hermes.unicode.** { *; }
-keep class com.facebook.jni.** { *; }
-dontwarn com.facebook.react.**
-dontwarn com.facebook.hermes.**
-dontwarn com.facebook.jni.**
-keepclassmembers class * {
    native <methods>;
}

# ---- Reanimated / worklets / gestures / screens ----------------------------
-keep class com.swmansion.reanimated.** { *; }
-dontwarn com.swmansion.reanimated.**
-keep class com.swmansion.worklets.** { *; }
-dontwarn com.swmansion.worklets.**
-keep class com.swmansion.gesturehandler.** { *; }
-dontwarn com.swmansion.gesturehandler.**
-keep class com.swmansion.rnscreens.** { *; }
-dontwarn com.swmansion.rnscreens.**

# ---- Nitro / MMKV ----------------------------------------------------------
-keep class com.margelo.** { *; }
-dontwarn com.margelo.**
-keep class com.mrousavy.** { *; }
-dontwarn com.mrousavy.**

# ---- Firebase / Google Play services ---------------------------------------
-keep class com.google.firebase.** { *; }
-dontwarn com.google.firebase.**
-keep class io.invertase.firebase.** { *; }
-dontwarn io.invertase.firebase.**
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.android.gms.**
-keep class com.google.android.gms.ads.** { *; }
-dontwarn com.google.android.gms.ads.**
-keep class com.google.android.gms.auth.** { *; }
-dontwarn com.google.android.gms.auth.**
-keep class io.invertase.googlemobileads.** { *; }
-dontwarn io.invertase.googlemobileads.**
-keep class com.google.android.ump.** { *; }
-dontwarn com.google.android.ump.**
-keep class com.google.android.play.** { *; }
-dontwarn com.google.android.play.**
-keep class com.reactnativegooglesignin.** { *; }
-dontwarn com.reactnativegooglesignin.**

# ---- Purchases / notifications ---------------------------------------------
-keep class com.revenuecat.** { *; }
-dontwarn com.revenuecat.**
-keep class io.invertase.notifee.** { *; }
-dontwarn io.invertase.notifee.**

# ---- UI libraries ----------------------------------------------------------
-keep class com.airbnb.lottie.** { *; }
-dontwarn com.airbnb.lottie.**
-keep class com.horcrux.svg.** { *; }
-dontwarn com.horcrux.svg.**
-keep class com.oblador.vectoricons.** { *; }
-dontwarn com.oblador.vectoricons.**
-keep class com.zoontek.** { *; }
-dontwarn com.zoontek.**
-keep class fr.greweb.reactnativeviewshot.** { *; }
-dontwarn fr.greweb.reactnativeviewshot.**
-keep class com.reactnativecommunity.** { *; }
-dontwarn com.reactnativecommunity.**
-keep class com.learnium.RNDeviceInfo.** { *; }
-dontwarn com.learnium.RNDeviceInfo.**
-keep class com.imagepicker.** { *; }
-dontwarn com.imagepicker.**
-keep class cl.json.** { *; }
-dontwarn cl.json.**

# ---- Networking ------------------------------------------------------------
-keep class okhttp3.** { *; }
-dontwarn okhttp3.**
-keep class okio.** { *; }
-dontwarn okio.**
