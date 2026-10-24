import { Inject, Injectable, Logger } from '@nestjs/common';
import type { OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import type { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { DATABASE_POOL } from './database.provider.js';

export type TransactionClient = Pick<PoolClient, 'query'>;

@Injectable()
export class DatabaseService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(DatabaseService.name);

  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {
    this.pool.on('error', () => {
      this.logger.error('Se perdió una conexión PostgreSQL inactiva.');
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.ping();
      this.logger.log('Conexión PostgreSQL verificada.');
    } catch {
      await this.pool.end();
      throw new Error(
        'No se pudo conectar a PostgreSQL. Revisá DATABASE_URL, TLS y la conectividad.',
      );
    }
  }

  async ping(): Promise<void> {
    await this.pool.query('SELECT 1');
  }

  query<Row extends QueryResultRow = QueryResultRow>(
    sql: string,
    params: unknown[] = [],
  ): Promise<QueryResult<Row>> {
    return this.pool.query<Row>(sql, params);
  }

  async transaction<Result>(
    work: (client: TransactionClient) => Promise<Result>,
  ): Promise<Result> {
    const client = await this.pool.connect();
    let releaseError: Error | undefined;
    try {
      await client.query('BEGIN');
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // Una conexión cuyo rollback falla se descarta en lugar de reutilizarse.
        releaseError = new Error(
          'La conexión no pudo revertir la transacción.',
        );
      }
      throw error;
    } finally {
      client.release(releaseError);
    }
  }

  async onApplicationShutdown(): Promise<void> {
    await this.pool.end();
  }
}
