package com.securemcp

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build
import dagger.hilt.android.HiltAndroidApp

@HiltAndroidApp
class SecureMcpApplication : Application() {

    companion object {
        const val TUNNEL_CHANNEL_ID = "tunnel_service"
        const val MCP_CHANNEL_ID = "mcp_commands"
    }

    override fun onCreate() {
        super.onCreate()
        createNotificationChannels()
    }

    private fun createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val notificationManager = getSystemService(NotificationManager::class.java)

            val tunnelChannel = NotificationChannel(
                TUNNEL_CHANNEL_ID,
                getString(R.string.tunnel_channel_name),
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = getString(R.string.tunnel_channel_description)
                setShowBadge(false)
            }

            val mcpChannel = NotificationChannel(
                MCP_CHANNEL_ID,
                getString(R.string.mcp_channel_name),
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = getString(R.string.mcp_channel_description)
                setShowBadge(false)
            }

            notificationManager.createNotificationChannel(tunnelChannel)
            notificationManager.createNotificationChannel(mcpChannel)
        }
    }
}
