package com.securemcp.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Switch
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.securemcp.data.local.CommandLogEntity
import com.securemcp.data.model.TunnelState
import com.securemcp.ui.viewmodel.MainUiState
import com.securemcp.ui.viewmodel.MainViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MainScreen(
    viewModel: MainViewModel,
    onRequestVpnPermission: () -> Unit
) {
    val uiState by viewModel.uiState.collectAsState()
    var selectedTab by remember { mutableIntStateOf(0) }
    var showSettings by remember { mutableStateOf(false) }
    val context = LocalContext.current

    val tabs = listOf("Status", "Logs", "Config")

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("SecureMCP") },
                actions = {
                    IconButton(onClick = { showSettings = !showSettings }) {
                        Icon(Icons.Default.Settings, contentDescription = "Settings")
                    }
                }
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            TabRow(selectedTabIndex = selectedTab) {
                tabs.forEachIndexed { index, title ->
                    Tab(
                        selected = selectedTab == index,
                        onClick = { selectedTab = index },
                        text = { Text(title) }
                    )
                }
            }

            when (selectedTab) {
                0 -> StatusTab(
                    uiState = uiState,
                    onConnect = {
                        if (uiState.tunnelState is TunnelState.Disconnected ||
                            uiState.tunnelState is TunnelState.Error) {
                            onRequestVpnPermission()
                        } else {
                            viewModel.disconnectTunnel()
                        }
                    },
                    onStartMcp = {
                        if (uiState.mcpConnected) {
                            viewModel.stopMcpService()
                        } else {
                            viewModel.startMcpService()
                        }
                    },
                    onAccessibilityClick = {
                        context.startActivity(viewModel.getAccessibilitySettingsIntent())
                    },
                    onAutoConnectChange = { viewModel.setAutoConnect(it) }
                )
                1 -> LogsTab(
                    logs = uiState.logs,
                    onClearLogs = { viewModel.clearLogs() }
                )
                2 -> ConfigTab(
                    uiState = uiState,
                    onSaveServer = { host, port, token ->
                        viewModel.saveServerConfig(host, port, token)
                    },
                    onGenerateKeys = { viewModel.generateKeyPair() }
                )
            }
        }
    }
}

@Composable
fun StatusTab(
    uiState: MainUiState,
    onConnect: () -> Unit,
    onStartMcp: () -> Unit,
    onAccessibilityClick: () -> Unit,
    onAutoConnectChange: (Boolean) -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // Tunnel Status Card
        StatusCard(
            title = "WireGuard Tunnel",
            status = when (uiState.tunnelState) {
                is TunnelState.Connected -> "Connected"
                is TunnelState.Connecting -> "Connecting..."
                is TunnelState.Disconnected -> "Disconnected"
                is TunnelState.Error -> "Error: ${uiState.tunnelState.message}"
            },
            isActive = uiState.tunnelState is TunnelState.Connected,
            actionLabel = if (uiState.tunnelState is TunnelState.Connected) "Disconnect" else "Connect",
            onAction = onConnect
        )

        // MCP Service Card
        StatusCard(
            title = "MCP Command Service",
            status = if (uiState.mcpConnected) "Connected" else "Disconnected",
            isActive = uiState.mcpConnected,
            actionLabel = if (uiState.mcpConnected) "Stop" else "Start",
            onAction = onStartMcp
        )

        // Accessibility Card
        StatusCard(
            title = "Accessibility Service",
            status = if (uiState.accessibilityEnabled) "Enabled" else "Disabled",
            isActive = uiState.accessibilityEnabled,
            actionLabel = "Settings",
            onAction = onAccessibilityClick
        )

        // Auto-connect toggle
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(
                containerColor = MaterialTheme.colorScheme.surfaceVariant
            )
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text("Auto-connect on boot")
                Switch(
                    checked = uiState.autoConnect,
                    onCheckedChange = onAutoConnectChange
                )
            }
        }
    }
}

@Composable
fun StatusCard(
    title: String,
    status: String,
    isActive: Boolean,
    actionLabel: String,
    onAction: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        )
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Text(
                    text = title,
                    style = MaterialTheme.typography.titleMedium
                )
                Spacer(modifier = Modifier.height(4.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        imageVector = if (isActive) Icons.Default.Check else Icons.Default.Close,
                        contentDescription = null,
                        tint = if (isActive) Color(0xFF00C853) else Color.Gray,
                        modifier = Modifier.size(16.dp)
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = status,
                        style = MaterialTheme.typography.bodyMedium,
                        color = if (isActive) Color(0xFF00C853) else MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
            Button(
                onClick = onAction,
                colors = ButtonDefaults.buttonColors(
                    containerColor = if (isActive) MaterialTheme.colorScheme.error
                    else MaterialTheme.colorScheme.primary
                )
            ) {
                Text(actionLabel)
            }
        }
    }
}

@Composable
fun LogsTab(
    logs: List<CommandLogEntity>,
    onClearLogs: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "Command Logs (${logs.size})",
                style = MaterialTheme.typography.titleMedium
            )
            OutlinedButton(onClick = onClearLogs) {
                Text("Clear")
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        if (logs.isEmpty()) {
            Text(
                text = "No commands executed yet",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        } else {
            LazyColumn(
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                items(logs) { log ->
                    LogItem(log)
                }
            }
        }
    }
}

@Composable
fun LogItem(log: CommandLogEntity) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = if (log.success) MaterialTheme.colorScheme.surfaceVariant
            else MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.3f)
        )
    ) {
        Column(
            modifier = Modifier.padding(12.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    text = log.commandType,
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.primary
                )
                Text(
                    text = java.text.SimpleDateFormat("HH:mm:ss", java.util.Locale.getDefault())
                        .format(java.util.Date(log.timestamp)),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = log.payload.take(100) + if (log.payload.length > 100) "..." else "",
                style = MaterialTheme.typography.bodySmall,
                fontFamily = FontFamily.Monospace,
                fontSize = 12.sp
            )
            log.output?.let {
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = it.take(200),
                    style = MaterialTheme.typography.bodySmall,
                    color = Color(0xFF00C853),
                    fontFamily = FontFamily.Monospace,
                    fontSize = 11.sp
                )
            }
            log.error?.let {
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = it.take(200),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.error,
                    fontFamily = FontFamily.Monospace,
                    fontSize = 11.sp
                )
            }
        }
    }
}

@Composable
fun ConfigTab(
    uiState: MainUiState,
    onSaveServer: (String, Int, String?) -> Unit,
    onGenerateKeys: () -> Pair<String, String>
) {
    var host by remember { mutableStateOf(uiState.serverConfig?.host ?: "") }
    var port by remember { mutableStateOf(uiState.serverConfig?.port?.toString() ?: "443") }
    var token by remember { mutableStateOf(uiState.serverConfig?.token ?: "") }
    var generatedKeys by remember { mutableStateOf<Pair<String, String>?>(null) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Text(
            text = "Server Configuration",
            style = MaterialTheme.typography.titleMedium
        )

        androidx.compose.material3.OutlinedTextField(
            value = host,
            onValueChange = { host = it },
            label = { Text("Server Host") },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true
        )

        androidx.compose.material3.OutlinedTextField(
            value = port,
            onValueChange = { port = it },
            label = { Text("Port") },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true
        )

        androidx.compose.material3.OutlinedTextField(
            value = token,
            onValueChange = { token = it },
            label = { Text("Auth Token (optional)") },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true
        )

        Button(
            onClick = { onSaveServer(host, port.toIntOrNull() ?: 443, token.ifBlank { null }) },
            modifier = Modifier.fillMaxWidth()
        ) {
            Text("Save Configuration")
        }

        Spacer(modifier = Modifier.height(16.dp))

        Text(
            text = "WireGuard Keys",
            style = MaterialTheme.typography.titleMedium
        )

        OutlinedButton(
            onClick = { generatedKeys = onGenerateKeys() },
            modifier = Modifier.fillMaxWidth()
        ) {
            Text("Generate Key Pair")
        }

        generatedKeys?.let { (privateKey, publicKey) ->
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.surfaceVariant
                )
            ) {
                Column(
                    modifier = Modifier.padding(12.dp)
                ) {
                    Text("Private Key:", style = MaterialTheme.typography.labelSmall)
                    Text(
                        text = privateKey,
                        fontFamily = FontFamily.Monospace,
                        fontSize = 10.sp
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text("Public Key:", style = MaterialTheme.typography.labelSmall)
                    Text(
                        text = publicKey,
                        fontFamily = FontFamily.Monospace,
                        fontSize = 10.sp
                    )
                }
            }
        }
    }
}
