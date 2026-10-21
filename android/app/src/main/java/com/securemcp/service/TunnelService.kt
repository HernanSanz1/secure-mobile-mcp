package com.securemcp.service

import android.app.Notification
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.net.VpnService
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat
import com.securemcp.R
import com.securemcp.SecureMcpApplication
import com.securemcp.data.local.SettingsDataStore
import com.securemcp.data.model.TunnelConfig
import com.securemcp.data.model.TunnelState
import com.securemcp.tunnel.WireGuardTunnel
import com.securemcp.ui.MainActivity
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import javax.inject.Inject

@AndroidEntryPoint
class TunnelService : VpnService() {

    companion object {
        private const val TAG = "TunnelService"
        private const val NOTIFICATION_ID = 1001

        const val ACTION_CONNECT = "com.securemcp.action.CONNECT"
        const val ACTION_DISCONNECT = "com.securemcp.action.DISCONNECT"
        const val EXTRA_CONFIG_JSON = "config_json"

        @Volatile
        var isRunning: Boolean = false
            private set

        fun connect(context: Context, configJson: String? = null) {
            val intent = Intent(context, TunnelService::class.java).apply {
                action = ACTION_CONNECT
                configJson?.let { putExtra(EXTRA_CONFIG_JSON, it) }
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }

        fun disconnect(context: Context) {
            val intent = Intent(context, TunnelService::class.java).apply {
                action = ACTION_DISCONNECT
            }
            context.startService(intent)
        }

        fun prepare(context: Context): Intent? {
            return VpnService.prepare(context)
        }
    }

    @Inject
    lateinit var tunnel: WireGuardTunnel

    @Inject
    lateinit var settingsDataStore: SettingsDataStore

    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private var stateJob: Job? = null

    override fun onCreate() {
        super.onCreate()
        Log.d(TAG, "Service created")
        startForeground(NOTIFICATION_ID, createNotification(false))
        observeTunnelState()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_CONNECT -> handleConnect(intent)
            ACTION_DISCONNECT -> handleDisconnect()
            else -> Log.w(TAG, "Unknown action: ${intent?.action}")
        }
        return START_STICKY
    }

    private fun handleConnect(intent: Intent) {
        serviceScope.launch {
            isRunning = true
            val configJson = intent.getStringExtra(EXTRA_CONFIG_JSON)
            val config = if (configJson != null) {
                kotlinx.serialization.json.Json.decodeFromString<TunnelConfig>(configJson)
            } else {
                settingsDataStore.tunnelConfig.first()
            }

            if (config != null) {
                tunnel.connect(this@TunnelService, config)
            } else {
                Log.e(TAG, "No tunnel configuration available")
                stopSelf()
            }
        }
    }

    private fun handleDisconnect() {
        tunnel.disconnect()
        isRunning = false
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    private fun observeTunnelState() {
        stateJob?.cancel()
        stateJob = serviceScope.launch {
            tunnel.state.collect { state ->
                val notification = createNotification(state is TunnelState.Connected)
                val notificationManager = getSystemService(NOTIFICATION_SERVICE) as android.app.NotificationManager
                notificationManager.notify(NOTIFICATION_ID, notification)
            }
        }
    }

    private fun createNotification(connected: Boolean): Notification {
        val contentIntent = PendingIntent.getActivity(
            this,
            0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE
        )

        val disconnectIntent = PendingIntent.getService(
            this,
            1,
            Intent(this, TunnelService::class.java).apply { action = ACTION_DISCONNECT },
            PendingIntent.FLAG_IMMUTABLE
        )

        return NotificationCompat.Builder(this, SecureMcpApplication.TUNNEL_CHANNEL_ID)
            .setContentTitle(getString(R.string.tunnel_notification_title))
            .setContentText(
                if (connected) getString(R.string.tunnel_notification_connected)
                else getString(R.string.tunnel_notification_disconnected)
            )
            .setSmallIcon(android.R.drawable.ic_menu_compass)
            .setContentIntent(contentIntent)
            .addAction(
                android.R.drawable.ic_menu_close_clear_cancel,
                "Disconnect",
                disconnectIntent
            )
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        super.onDestroy()
        tunnel.disconnect()
        serviceScope.cancel()
        isRunning = false
        Log.d(TAG, "Service destroyed")
    }
}
