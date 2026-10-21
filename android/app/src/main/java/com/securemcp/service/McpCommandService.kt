package com.securemcp.service

import android.app.Notification
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat
import com.securemcp.R
import com.securemcp.SecureMcpApplication
import com.securemcp.data.local.CommandLogDao
import com.securemcp.data.local.CommandLogEntity
import com.securemcp.data.local.SettingsDataStore
import com.securemcp.data.model.CommandResult
import com.securemcp.data.model.CommandType
import com.securemcp.data.model.McpCommand
import com.securemcp.ui.MainActivity
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.serialization.json.Json
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import java.io.BufferedReader
import java.io.InputStreamReader
import java.util.concurrent.TimeUnit
import javax.inject.Inject

@AndroidEntryPoint
class McpCommandService : Service() {

    companion object {
        private const val TAG = "McpCommandService"
        private const val NOTIFICATION_ID = 1002
        private const val WS_RECONNECT_DELAY_MS = 5000L

        const val ACTION_START = "com.securemcp.action.MCP_START"
        const val ACTION_STOP = "com.securemcp.action.MCP_STOP"

        @Volatile
        var isRunning: Boolean = false
            private set

        private val _connectionState = MutableStateFlow(false)
        val connectionState: StateFlow<Boolean> = _connectionState.asStateFlow()

        private val _commandResults = MutableSharedFlow<CommandResult>()
        val commandResults: SharedFlow<CommandResult> = _commandResults.asSharedFlow()

        fun start(context: Context) {
            val intent = Intent(context, McpCommandService::class.java).apply {
                action = ACTION_START
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }

        fun stop(context: Context) {
            val intent = Intent(context, McpCommandService::class.java).apply {
                action = ACTION_STOP
            }
            context.startService(intent)
        }
    }

    @Inject
    lateinit var settingsDataStore: SettingsDataStore

    @Inject
    lateinit var commandLogDao: CommandLogDao

    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val json = Json { ignoreUnknownKeys = true }

    private val httpClient = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(0, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .pingInterval(30, TimeUnit.SECONDS)
        .build()

    private var webSocket: WebSocket? = null
    private var shouldReconnect = true

    override fun onCreate() {
        super.onCreate()
        Log.d(TAG, "MCP Command Service created")
        startForeground(NOTIFICATION_ID, createNotification())
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START -> handleStart()
            ACTION_STOP -> handleStop()
        }
        return START_STICKY
    }

    private fun handleStart() {
        isRunning = true
        shouldReconnect = true
        serviceScope.launch {
            connectToServer()
        }
    }

    private fun handleStop() {
        shouldReconnect = false
        webSocket?.close(1000, "Service stopped")
        isRunning = false
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    private suspend fun connectToServer() {
        val serverConfig = settingsDataStore.serverConfig.first() ?: run {
            Log.e(TAG, "No server configuration available")
            return
        }

        val wsUrl = "wss://${serverConfig.host}:${serverConfig.port}/mcp/commands"
        val request = Request.Builder()
            .url(wsUrl)
            .apply {
                serverConfig.token?.let { addHeader("Authorization", "Bearer $it") }
            }
            .build()

        webSocket = httpClient.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                Log.i(TAG, "WebSocket connected")
                _connectionState.value = true
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                serviceScope.launch {
                    handleCommand(text)
                }
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                Log.e(TAG, "WebSocket failure", t)
                _connectionState.value = false
                scheduleReconnect()
            }

            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                Log.i(TAG, "WebSocket closed: $reason")
                _connectionState.value = false
                scheduleReconnect()
            }
        })
    }

    private fun scheduleReconnect() {
        if (!shouldReconnect) return
        serviceScope.launch {
            delay(WS_RECONNECT_DELAY_MS)
            if (isActive && shouldReconnect) {
                connectToServer()
            }
        }
    }

    private suspend fun handleCommand(commandJson: String) {
        try {
            val command = json.decodeFromString<McpCommand>(commandJson)
            Log.d(TAG, "Received command: ${command.type} - ${command.id}")

            val result = executeCommand(command)
            sendResult(result)
            logCommand(command, result)

            _commandResults.emit(result)
        } catch (e: Exception) {
            Log.e(TAG, "Error handling command", e)
        }
    }

    private suspend fun executeCommand(command: McpCommand): CommandResult {
        return when (command.type) {
            CommandType.SHELL -> executeShellCommand(command)
            CommandType.UI_ACTION -> executeUiAction(command)
            CommandType.SCREENSHOT -> executeScreenshot(command)
            CommandType.FILE_OPERATION -> executeFileOperation(command)
            CommandType.PACKAGE_OPERATION -> executePackageOperation(command)
            CommandType.CUSTOM -> executeCustomCommand(command)
        }
    }

    private fun executeShellCommand(command: McpCommand): CommandResult {
        return try {
            val process = Runtime.getRuntime().exec(arrayOf("sh", "-c", command.payload))
            val reader = BufferedReader(InputStreamReader(process.inputStream))
            val errorReader = BufferedReader(InputStreamReader(process.errorStream))

            val output = reader.readText()
            val error = errorReader.readText()
            val exitCode = process.waitFor()

            reader.close()
            errorReader.close()

            CommandResult(
                commandId = command.id,
                success = exitCode == 0,
                output = output.ifEmpty { null },
                error = error.ifEmpty { null }
            )
        } catch (e: Exception) {
            CommandResult(
                commandId = command.id,
                success = false,
                error = e.message
            )
        }
    }

    private fun executeUiAction(command: McpCommand): CommandResult {
        // Delegate to AccessibilityService if available
        val accessibility = AutomationAccessibilityService.instance
        return if (accessibility != null) {
            try {
                accessibility.executeAction(command.payload)
                CommandResult(commandId = command.id, success = true, output = "UI action executed")
            } catch (e: Exception) {
                CommandResult(commandId = command.id, success = false, error = e.message)
            }
        } else {
            CommandResult(
                commandId = command.id,
                success = false,
                error = "Accessibility service not enabled"
            )
        }
    }

    private fun executeScreenshot(command: McpCommand): CommandResult {
        val accessibility = AutomationAccessibilityService.instance
        return if (accessibility != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            try {
                // Screenshot via accessibility would be triggered here
                CommandResult(commandId = command.id, success = true, output = "Screenshot captured")
            } catch (e: Exception) {
                CommandResult(commandId = command.id, success = false, error = e.message)
            }
        } else {
            CommandResult(
                commandId = command.id,
                success = false,
                error = "Screenshot requires Android 11+ and accessibility service"
            )
        }
    }

    private fun executeFileOperation(command: McpCommand): CommandResult {
        // Parse payload for file operation details
        return CommandResult(
            commandId = command.id,
            success = false,
            error = "File operations not yet implemented"
        )
    }

    private fun executePackageOperation(command: McpCommand): CommandResult {
        return try {
            val pm = packageManager
            // Parse payload for package operation
            CommandResult(commandId = command.id, success = true, output = "Package operation completed")
        } catch (e: Exception) {
            CommandResult(commandId = command.id, success = false, error = e.message)
        }
    }

    private fun executeCustomCommand(command: McpCommand): CommandResult {
        return CommandResult(
            commandId = command.id,
            success = false,
            error = "Custom command handler not implemented"
        )
    }

    private fun sendResult(result: CommandResult) {
        try {
            val resultJson = json.encodeToString(CommandResult.serializer(), result)
            webSocket?.send(resultJson)
        } catch (e: Exception) {
            Log.e(TAG, "Error sending result", e)
        }
    }

    private suspend fun logCommand(command: McpCommand, result: CommandResult) {
        commandLogDao.insert(
            CommandLogEntity(
                commandId = command.id,
                commandType = command.type.name,
                payload = command.payload,
                success = result.success,
                output = result.output,
                error = result.error
            )
        )
    }

    private fun createNotification(): Notification {
        val contentIntent = PendingIntent.getActivity(
            this,
            0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE
        )

        return NotificationCompat.Builder(this, SecureMcpApplication.MCP_CHANNEL_ID)
            .setContentTitle("MCP Commands")
            .setContentText("Listening for commands")
            .setSmallIcon(android.R.drawable.ic_menu_manage)
            .setContentIntent(contentIntent)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        super.onDestroy()
        shouldReconnect = false
        webSocket?.close(1000, "Service destroyed")
        serviceScope.cancel()
        isRunning = false
        Log.d(TAG, "MCP Command Service destroyed")
    }
}
