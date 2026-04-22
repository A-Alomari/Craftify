import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  TypeOrmModuleOptions,
  TypeOrmOptionsFactory,
} from '@nestjs/typeorm';
import { join } from 'path';
import { existsSync, readFileSync } from 'fs';

/**
 * DatabaseConfig
 *
 * Provides TypeORM connection options using the **sqljs** driver (sql.js).
 *
 * Synchronization policy:
 *   - Development / test: synchronize=true (auto-creates/alters tables)
 *   - Production: synchronize=false (use migrations instead)
 */
@Injectable()
export class DatabaseConfig implements TypeOrmOptionsFactory {
  constructor(private readonly configService: ConfigService) {}

  createTypeOrmOptions(): TypeOrmModuleOptions {
    const nodeEnv = this.configService.get<string>('NODE_ENV', 'development');
    const isProduction = nodeEnv === 'production';
    const isTest = nodeEnv === 'test' || Boolean(process.env.JEST_WORKER_ID);

    // Prefer DB_PATH per migration target. Keep CRAFTIFY_DB_PATH as a
    // backward-compatible alias so existing environments keep working.
    const dbPath = this.configService.get<string>('DB_PATH')
      ?? this.configService.get<string>('CRAFTIFY_DB_PATH')
      ?? (isTest ? ':memory:' : join(process.cwd(), 'craftify.db'));

    const inMemory = dbPath === ':memory:';

    // Load existing database file into memory if it exists (and not in-memory mode)
    let initialDatabase: Uint8Array | undefined;
    if (!inMemory && existsSync(dbPath)) {
      try {
        initialDatabase = new Uint8Array(readFileSync(dbPath));
      } catch {
        // File unreadable — start with empty database
      }
    }

    return {
      type: 'sqljs' as any,

      // If we have an existing DB file, pass it as the initial content
      ...(initialDatabase ? { database: initialDatabase } : {}),

      // File path for autoSave writes
      location: inMemory ? undefined : dbPath,
      autoSave: !inMemory,

      // Entity files — covers both ts-node (.ts) and compiled (.js) paths
      entities: [join(__dirname, '..', '**', '*.entity{.ts,.js}')],

      // Auto-synchronize schema in dev/test; use migrations in production
      synchronize: !isProduction,

      // Drop schema for ephemeral in-memory test databases
      dropSchema: isTest && inMemory,

      logging: this.configService.get<string>('LOG_SQL') === 'true'
        ? ['error', 'warn', 'query']
        : ['error'],
    } as TypeOrmModuleOptions;
  }
}

export function createDatabaseConfig(
  configService: ConfigService,
): TypeOrmModuleOptions {
  return new DatabaseConfig(configService).createTypeOrmOptions();
}
