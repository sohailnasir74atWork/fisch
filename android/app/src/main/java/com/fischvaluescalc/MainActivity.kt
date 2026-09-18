package com.fischvaluescalc

import android.os.Bundle
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import com.zoontek.rnbootsplash.RNBootSplash

class MainActivity : ReactActivity() {

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "FischValues"

  /**
   * The splash screen was appearing TWICE: once from the manifest's BootTheme
   * and again as the React view mounted. This activity never called
   * RNBootSplash.init(), which is what hands the Android 12+ SplashScreen over
   * to the library and holds it until JS calls RNBootSplash.hide() (App.js).
   * Without it the system splash dismisses the moment the activity draws, and
   * the theme's logo shows again behind React — one splash, seen twice.
   *
   * All three sibling apps (mm2values, Blox_Fruit, adoptme-jan7) have this
   * call; this fork was converted without it.
   *
   * The try/catch is carried over from adoptme-jan7 deliberately: init throws a
   * NullPointerException on 16 KB page-size devices, and a splash that fails to
   * initialise must not take the whole app down with it.
   */
  override fun onCreate(savedInstanceState: Bundle?) {
    try {
      RNBootSplash.init(this, R.style.BootTheme)
    } catch (e: Exception) {
      // Splash init is cosmetic; never let it block launch.
    }
    super.onCreate(null)
  }

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)
}
