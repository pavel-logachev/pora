package net.logachev.pora.devicesettings

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import kotlin.concurrent.thread

class PoraNotificationRecoveryReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val pendingResult = goAsync()
    thread {
      try {
        val delegateClass = Class.forName(
          "expo.modules.notifications.service.delegates.ExpoSchedulingDelegate"
        )
        val delegate = delegateClass
          .getConstructor(Context::class.java)
          .newInstance(context)
        delegateClass
          .getMethod("setupScheduledNotifications")
          .invoke(delegate)
      } catch (error: Throwable) {
        Log.e("PoraNotifications", "Could not rebuild alarms after a time change", error)
      } finally {
        pendingResult.finish()
      }
    }
  }
}
