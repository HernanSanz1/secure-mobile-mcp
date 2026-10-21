package com.securemcp.data.local

import android.content.Context
import androidx.room.Dao
import androidx.room.Database
import androidx.room.Entity
import androidx.room.Insert
import androidx.room.PrimaryKey
import androidx.room.Query
import androidx.room.Room
import androidx.room.RoomDatabase
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import kotlinx.coroutines.flow.Flow
import javax.inject.Singleton

@Entity(tableName = "command_logs")
data class CommandLogEntity(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,
    val commandId: String,
    val commandType: String,
    val payload: String,
    val success: Boolean,
    val output: String?,
    val error: String?,
    val timestamp: Long = System.currentTimeMillis()
)

@Dao
interface CommandLogDao {
    @Query("SELECT * FROM command_logs ORDER BY timestamp DESC LIMIT :limit")
    fun getRecentLogs(limit: Int = 100): Flow<List<CommandLogEntity>>

    @Insert
    suspend fun insert(log: CommandLogEntity)

    @Query("DELETE FROM command_logs WHERE timestamp < :before")
    suspend fun deleteOldLogs(before: Long)

    @Query("DELETE FROM command_logs")
    suspend fun clearAll()
}

@Database(entities = [CommandLogEntity::class], version = 1, exportSchema = false)
abstract class LogDatabase : RoomDatabase() {
    abstract fun commandLogDao(): CommandLogDao
}

@Module
@InstallIn(SingletonComponent::class)
object DatabaseModule {
    @Provides
    @Singleton
    fun provideDatabase(@ApplicationContext context: Context): LogDatabase {
        return Room.databaseBuilder(
            context,
            LogDatabase::class.java,
            "securemcp_logs.db"
        ).build()
    }

    @Provides
    fun provideCommandLogDao(database: LogDatabase): CommandLogDao {
        return database.commandLogDao()
    }
}
