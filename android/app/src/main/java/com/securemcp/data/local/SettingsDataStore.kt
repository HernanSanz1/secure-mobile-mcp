package com.securemcp.data.local

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import com.securemcp.data.model.ServerConfig
import com.securemcp.data.model.TunnelConfig
import javax.inject.Inject
import javax.inject.Singleton

private val Context.dataStore: DataStore<Preferences> by preferencesDataStore(name = "settings")

@Singleton
class SettingsDataStore @Inject constructor(
    @ApplicationContext private val context: Context
) {
    private val json = Json { ignoreUnknownKeys = true }

    companion object {
        private val SERVER_CONFIG_KEY = stringPreferencesKey("server_config")
        private val TUNNEL_CONFIG_KEY = stringPreferencesKey("tunnel_config")
        private val AUTO_CONNECT_KEY = booleanPreferencesKey("auto_connect")
        private val ACCESSIBILITY_ENABLED_KEY = booleanPreferencesKey("accessibility_enabled")
    }

    val serverConfig: Flow<ServerConfig?> = context.dataStore.data.map { prefs ->
        prefs[SERVER_CONFIG_KEY]?.let {
            try { json.decodeFromString<ServerConfig>(it) } catch (e: Exception) { null }
        }
    }

    val tunnelConfig: Flow<TunnelConfig?> = context.dataStore.data.map { prefs ->
        prefs[TUNNEL_CONFIG_KEY]?.let {
            try { json.decodeFromString<TunnelConfig>(it) } catch (e: Exception) { null }
        }
    }

    val autoConnect: Flow<Boolean> = context.dataStore.data.map { prefs ->
        prefs[AUTO_CONNECT_KEY] ?: false
    }

    val accessibilityEnabled: Flow<Boolean> = context.dataStore.data.map { prefs ->
        prefs[ACCESSIBILITY_ENABLED_KEY] ?: false
    }

    suspend fun saveServerConfig(config: ServerConfig) {
        context.dataStore.edit { prefs ->
            prefs[SERVER_CONFIG_KEY] = json.encodeToString(config)
        }
    }

    suspend fun saveTunnelConfig(config: TunnelConfig) {
        context.dataStore.edit { prefs ->
            prefs[TUNNEL_CONFIG_KEY] = json.encodeToString(config)
        }
    }

    suspend fun setAutoConnect(enabled: Boolean) {
        context.dataStore.edit { prefs ->
            prefs[AUTO_CONNECT_KEY] = enabled
        }
    }

    suspend fun setAccessibilityEnabled(enabled: Boolean) {
        context.dataStore.edit { prefs ->
            prefs[ACCESSIBILITY_ENABLED_KEY] = enabled
        }
    }

    suspend fun clearAll() {
        context.dataStore.edit { it.clear() }
    }
}
