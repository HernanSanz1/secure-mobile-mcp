package com.aster.ui.screens.pairing

import android.Manifest
import android.util.Log
import android.util.Size
import android.widget.Toast
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.aster.data.crypto.HandshakeManager
import com.aster.data.crypto.KeyManager
import com.aster.data.crypto.PairingData
import com.aster.data.local.SettingsDataStore
import com.aster.ui.components.AsterButton
import com.aster.ui.components.AsterButtonVariant
import com.aster.ui.components.AsterCard
import com.aster.ui.components.AsterTopBar
import com.aster.ui.components.GlowOrb
import com.aster.ui.theme.AsterTheme
import com.google.accompanist.permissions.ExperimentalPermissionsApi
import com.google.accompanist.permissions.isGranted
import com.google.accompanist.permissions.rememberPermissionState
import com.google.mlkit.vision.barcode.BarcodeScanning
import com.google.mlkit.vision.barcode.common.Barcode
import com.google.mlkit.vision.common.InputImage
import compose.icons.FeatherIcons
import compose.icons.feathericons.Camera
import compose.icons.feathericons.CheckCircle
import compose.icons.feathericons.Key
import compose.icons.feathericons.Shield
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.launch
import java.util.concurrent.Executors
import javax.inject.Inject

private const val TAG = "QRScanScreen"
private val GreenAccent = Color(0xFF22C55E)
private val BlueAccent = Color(0xFF3B82F6)

// ============================================================================
// ViewModel
// ============================================================================

sealed class PairingState {
    object Initial : PairingState()
    object Scanning : PairingState()
    data class Scanned(val data: PairingData) : PairingState()
    object GeneratingKeys : PairingState()
    data class Ready(val data: PairingData, val fingerprint: String) : PairingState()
    data class Error(val message: String) : PairingState()
}

@HiltViewModel
class QRScanViewModel @Inject constructor(
    private val keyManager: KeyManager,
    private val handshakeManager: HandshakeManager,
    private val settingsDataStore: SettingsDataStore
) : ViewModel() {

    var state by mutableStateOf<PairingState>(PairingState.Initial)
        private set

    var pairingData: PairingData? = null
        private set

    fun onQRCodeScanned(qrData: String) {
        if (state is PairingState.Scanned || state is PairingState.Ready) {
            return // Already scanned
        }

        val data = handshakeManager.parsePairingQR(qrData)
        if (data == null) {
            state = PairingState.Error("Invalid QR code. Please scan the pairing QR from the Aster server dashboard.")
            return
        }

        pairingData = data
        state = PairingState.Scanned(data)
    }

    fun generateAndSaveKeys() {
        val data = pairingData ?: return
        state = PairingState.GeneratingKeys

        viewModelScope.launch {
            val result = keyManager.generateKeys()

            result.fold(
                onSuccess = {
                    val fingerprint = keyManager.getPublicKeyFingerprint() ?: "Unknown"
                    state = PairingState.Ready(data, fingerprint)

                    // Save the server URL for later connection
                    settingsDataStore.saveServerUrl(data.serverUrl)
                },
                onFailure = { error ->
                    state = PairingState.Error("Failed to generate keys: ${error.message}")
                }
            )
        }
    }

    fun reset() {
        state = PairingState.Initial
        pairingData = null
    }

    fun startScanning() {
        state = PairingState.Scanning
    }
}

// ============================================================================
// QR Scan Screen
// ============================================================================

@OptIn(ExperimentalPermissionsApi::class)
@Composable
fun QRScanScreen(
    onNavigateBack: () -> Unit,
    onPairingComplete: (serverUrl: String) -> Unit,
    viewModel: QRScanViewModel = hiltViewModel()
) {
    val colors = AsterTheme.colors
    val context = LocalContext.current
    val state = viewModel.state

    val cameraPermissionState = rememberPermissionState(Manifest.permission.CAMERA)

    LaunchedEffect(Unit) {
        if (!cameraPermissionState.status.isGranted) {
            cameraPermissionState.launchPermissionRequest()
        } else {
            viewModel.startScanning()
        }
    }

    LaunchedEffect(cameraPermissionState.status.isGranted) {
        if (cameraPermissionState.status.isGranted && state is PairingState.Initial) {
            viewModel.startScanning()
        }
    }

    Scaffold(
        modifier = Modifier.fillMaxSize(),
        containerColor = colors.bg,
        topBar = {
            AsterTopBar(
                title = "Pair Device",
                onBack = onNavigateBack
            )
        }
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 20.dp, vertical = 16.dp),
            verticalArrangement = Arrangement.spacedBy(20.dp)
        ) {
            when (state) {
                is PairingState.Initial, is PairingState.Scanning -> {
                    ScanningView(
                        hasPermission = cameraPermissionState.status.isGranted,
                        onRequestPermission = { cameraPermissionState.launchPermissionRequest() },
                        onQRScanned = { viewModel.onQRCodeScanned(it) }
                    )
                }

                is PairingState.Scanned -> {
                    ScannedView(
                        data = state.data,
                        onConfirm = { viewModel.generateAndSaveKeys() },
                        onCancel = { viewModel.reset() }
                    )
                }

                is PairingState.GeneratingKeys -> {
                    GeneratingKeysView()
                }

                is PairingState.Ready -> {
                    ReadyView(
                        data = state.data,
                        fingerprint = state.fingerprint,
                        onConnect = { onPairingComplete(state.data.serverUrl) }
                    )
                }

                is PairingState.Error -> {
                    ErrorView(
                        message = state.message,
                        onRetry = { viewModel.reset() }
                    )
                }
            }

            // Instructions
            InstructionsCard()

            Spacer(modifier = Modifier.height(16.dp))
        }
    }
}

// ============================================================================
// Scanning View with Camera
// ============================================================================

@Composable
private fun ScanningView(
    hasPermission: Boolean,
    onRequestPermission: () -> Unit,
    onQRScanned: (String) -> Unit
) {
    val colors = AsterTheme.colors

    AsterCard(modifier = Modifier.fillMaxWidth()) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Icon(
                    imageVector = FeatherIcons.Camera,
                    contentDescription = null,
                    tint = BlueAccent,
                    modifier = Modifier.size(20.dp)
                )
                Text(
                    text = "Scan Pairing QR",
                    style = MaterialTheme.typography.titleMedium,
                    color = colors.text,
                    fontWeight = FontWeight.SemiBold
                )
            }

            if (hasPermission) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .aspectRatio(1f)
                        .clip(RoundedCornerShape(12.dp))
                        .background(Color.Black)
                ) {
                    CameraPreviewWithScanner(onQRScanned = onQRScanned)

                    // Overlay scan frame
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(48.dp)
                            .border(2.dp, BlueAccent.copy(alpha = 0.5f), RoundedCornerShape(12.dp))
                    )
                }

                Text(
                    text = "Point camera at the QR code on the server dashboard",
                    style = MaterialTheme.typography.bodySmall,
                    color = colors.textSubtle,
                    textAlign = TextAlign.Center
                )
            } else {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(16.dp),
                    modifier = Modifier.padding(vertical = 32.dp)
                ) {
                    Icon(
                        imageVector = FeatherIcons.Camera,
                        contentDescription = null,
                        tint = colors.textMuted,
                        modifier = Modifier.size(48.dp)
                    )

                    Text(
                        text = "Camera permission required to scan QR codes",
                        style = MaterialTheme.typography.bodyMedium,
                        color = colors.textSubtle,
                        textAlign = TextAlign.Center
                    )

                    AsterButton(
                        onClick = onRequestPermission,
                        text = "Grant Permission",
                        variant = AsterButtonVariant.PRIMARY
                    )
                }
            }
        }
    }
}

@Composable
@androidx.annotation.OptIn(androidx.camera.core.ExperimentalGetImage::class)
private fun CameraPreviewWithScanner(
    onQRScanned: (String) -> Unit
) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    val scope = rememberCoroutineScope()

    var lastScannedValue by remember { mutableStateOf<String?>(null) }

    val previewView = remember { PreviewView(context) }
    val cameraExecutor = remember { Executors.newSingleThreadExecutor() }
    val barcodeScanner = remember { BarcodeScanning.getClient() }

    DisposableEffect(Unit) {
        val cameraProviderFuture = ProcessCameraProvider.getInstance(context)

        cameraProviderFuture.addListener({
            try {
                val cameraProvider = cameraProviderFuture.get()

                val preview = Preview.Builder()
                    .build()
                    .also { it.setSurfaceProvider(previewView.surfaceProvider) }

                val imageAnalyzer = ImageAnalysis.Builder()
                    .setTargetResolution(Size(1280, 720))
                    .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                    .build()
                    .also { analysis ->
                        analysis.setAnalyzer(cameraExecutor) { imageProxy ->
                            val mediaImage = imageProxy.image
                            if (mediaImage != null) {
                                val inputImage = InputImage.fromMediaImage(
                                    mediaImage,
                                    imageProxy.imageInfo.rotationDegrees
                                )

                                barcodeScanner.process(inputImage)
                                    .addOnSuccessListener { barcodes ->
                                        for (barcode in barcodes) {
                                            if (barcode.format == Barcode.FORMAT_QR_CODE) {
                                                val value = barcode.rawValue
                                                if (value != null && value != lastScannedValue) {
                                                    lastScannedValue = value
                                                    scope.launch {
                                                        onQRScanned(value)
                                                    }
                                                }
                                            }
                                        }
                                    }
                                    .addOnFailureListener { e ->
                                        Log.e(TAG, "Barcode scanning failed", e)
                                    }
                                    .addOnCompleteListener {
                                        imageProxy.close()
                                    }
                            } else {
                                imageProxy.close()
                            }
                        }
                    }

                val cameraSelector = CameraSelector.DEFAULT_BACK_CAMERA

                cameraProvider.unbindAll()
                cameraProvider.bindToLifecycle(
                    lifecycleOwner,
                    cameraSelector,
                    preview,
                    imageAnalyzer
                )
            } catch (e: Exception) {
                Log.e(TAG, "Camera binding failed", e)
            }
        }, ContextCompat.getMainExecutor(context))

        onDispose {
            cameraExecutor.shutdown()
            barcodeScanner.close()
        }
    }

    AndroidView(
        factory = { previewView },
        modifier = Modifier.fillMaxSize()
    )
}

// ============================================================================
// Scanned View
// ============================================================================

@Composable
private fun ScannedView(
    data: PairingData,
    onConfirm: () -> Unit,
    onCancel: () -> Unit
) {
    val colors = AsterTheme.colors

    AsterCard(modifier = Modifier.fillMaxWidth()) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            GlowOrb(
                color = GreenAccent,
                size = 56.dp,
                isAnimating = false
            )

            Text(
                text = "Server Found",
                style = MaterialTheme.typography.titleMedium,
                color = GreenAccent,
                fontWeight = FontWeight.SemiBold
            )

            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(8.dp))
                    .background(colors.surface2)
                    .padding(12.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                InfoRow(label = "Server", value = data.serverUrl)
                data.fingerprint?.let {
                    InfoRow(label = "Fingerprint", value = it)
                }
            }

            Text(
                text = "Confirm to generate device identity keys and pair with this server.",
                style = MaterialTheme.typography.bodySmall,
                color = colors.textSubtle,
                textAlign = TextAlign.Center
            )

            Row(
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                AsterButton(
                    onClick = onCancel,
                    text = "Cancel",
                    variant = AsterButtonVariant.SECONDARY,
                    modifier = Modifier.weight(1f)
                )
                AsterButton(
                    onClick = onConfirm,
                    text = "Pair",
                    variant = AsterButtonVariant.PRIMARY,
                    modifier = Modifier.weight(1f)
                )
            }
        }
    }
}

// ============================================================================
// Generating Keys View
// ============================================================================

@Composable
private fun GeneratingKeysView() {
    val colors = AsterTheme.colors

    AsterCard(modifier = Modifier.fillMaxWidth()) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            GlowOrb(
                color = BlueAccent,
                size = 56.dp,
                isAnimating = true
            )

            Text(
                text = "Generating Keys...",
                style = MaterialTheme.typography.titleMedium,
                color = BlueAccent,
                fontWeight = FontWeight.SemiBold
            )

            Text(
                text = "Creating secure device identity keys stored in hardware-backed Android Keystore.",
                style = MaterialTheme.typography.bodySmall,
                color = colors.textSubtle,
                textAlign = TextAlign.Center
            )
        }
    }
}

// ============================================================================
// Ready View
// ============================================================================

@Composable
private fun ReadyView(
    data: PairingData,
    fingerprint: String,
    onConnect: () -> Unit
) {
    val colors = AsterTheme.colors

    AsterCard(modifier = Modifier.fillMaxWidth()) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Icon(
                imageVector = FeatherIcons.CheckCircle,
                contentDescription = null,
                tint = GreenAccent,
                modifier = Modifier.size(56.dp)
            )

            Text(
                text = "Pairing Complete",
                style = MaterialTheme.typography.titleMedium,
                color = GreenAccent,
                fontWeight = FontWeight.SemiBold
            )

            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(8.dp))
                    .background(colors.surface2)
                    .padding(12.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                InfoRow(label = "Server", value = data.serverUrl)
                InfoRow(label = "Device Fingerprint", value = fingerprint)
            }

            Text(
                text = "Your device identity has been created. Connect to the server to complete registration.",
                style = MaterialTheme.typography.bodySmall,
                color = colors.textSubtle,
                textAlign = TextAlign.Center
            )

            AsterButton(
                onClick = onConnect,
                text = "Connect to Server",
                variant = AsterButtonVariant.PRIMARY,
                modifier = Modifier.fillMaxWidth()
            )
        }
    }
}

// ============================================================================
// Error View
// ============================================================================

@Composable
private fun ErrorView(
    message: String,
    onRetry: () -> Unit
) {
    val colors = AsterTheme.colors

    AsterCard(modifier = Modifier.fillMaxWidth()) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            GlowOrb(
                color = colors.error,
                size = 56.dp,
                isAnimating = false
            )

            Text(
                text = "Error",
                style = MaterialTheme.typography.titleMedium,
                color = colors.error,
                fontWeight = FontWeight.SemiBold
            )

            Text(
                text = message,
                style = MaterialTheme.typography.bodySmall,
                color = colors.textSubtle,
                textAlign = TextAlign.Center
            )

            AsterButton(
                onClick = onRetry,
                text = "Try Again",
                variant = AsterButtonVariant.PRIMARY,
                modifier = Modifier.fillMaxWidth()
            )
        }
    }
}

// ============================================================================
// Instructions Card
// ============================================================================

@Composable
private fun InstructionsCard() {
    val colors = AsterTheme.colors

    AsterCard(modifier = Modifier.fillMaxWidth()) {
        Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Icon(
                    imageVector = FeatherIcons.Shield,
                    contentDescription = null,
                    tint = GreenAccent,
                    modifier = Modifier.size(20.dp)
                )
                Text(
                    text = "Secure Pairing",
                    style = MaterialTheme.typography.titleSmall,
                    color = colors.text,
                    fontWeight = FontWeight.SemiBold
                )
            }

            Text(
                text = "This pairing process establishes a cryptographic trust relationship between this device and the server.",
                style = MaterialTheme.typography.bodySmall,
                color = colors.textSubtle
            )

            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                InstructionStep(
                    number = 1,
                    text = "Open the Aster server dashboard at localhost:5989"
                )
                InstructionStep(
                    number = 2,
                    text = "Click 'Add Device' to show the pairing QR code"
                )
                InstructionStep(
                    number = 3,
                    text = "Scan the QR code with this screen"
                )
                InstructionStep(
                    number = 4,
                    text = "Device identity keys are generated and stored securely"
                )
            }

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(8.dp))
                    .background(GreenAccent.copy(alpha = 0.08f))
                    .padding(12.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(
                    imageVector = FeatherIcons.Key,
                    contentDescription = null,
                    tint = GreenAccent,
                    modifier = Modifier.size(16.dp)
                )
                Text(
                    text = "Private keys never leave this device",
                    style = MaterialTheme.typography.labelMedium,
                    color = GreenAccent
                )
            }
        }
    }
}

@Composable
private fun InstructionStep(number: Int, text: String) {
    val colors = AsterTheme.colors

    Row(
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.Top
    ) {
        Box(
            modifier = Modifier
                .size(22.dp)
                .clip(RoundedCornerShape(6.dp))
                .background(BlueAccent),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = number.toString(),
                style = MaterialTheme.typography.labelSmall,
                color = Color.White,
                fontWeight = FontWeight.Bold
            )
        }

        Text(
            text = text,
            style = MaterialTheme.typography.bodySmall,
            color = colors.textSubtle,
            modifier = Modifier.weight(1f)
        )
    }
}

@Composable
private fun InfoRow(label: String, value: String) {
    val colors = AsterTheme.colors

    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.labelMedium,
            color = colors.textMuted
        )
        Text(
            text = value,
            style = MaterialTheme.typography.labelMedium,
            color = colors.text,
            fontWeight = FontWeight.Medium
        )
    }
}
