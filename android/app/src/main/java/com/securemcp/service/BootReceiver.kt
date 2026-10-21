package com.securemcp.service

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import com.securemcp.data.local.SettingsDataStore
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import javax.inject.Inject

@AndroidEntryPoint
class BootReceiver : BroadcastReceiver() {

    @Inject
    lateinit var settingsDataStore: SettingsDataStore

    companion object {
        private const val TAG = "BootReceiver"
    }

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_BOOT_COMPLETED) return

        Log.i(TAG, "Boot completed, checking auto-connect settings")

        val pendingResult = goAsync()
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val autoConnect = settingsDataStore.autoConnect.first()
                if (autoConnect) {
                    Log.i(TAG, "Auto-connect enabled, starting services")
                    TunnelService.connect(context)
                    McpCommandService.start(context)
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error during boot initialization", e)
            } finally {
                pendingResult.finish()
            }
        }
    }
}
