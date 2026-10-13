import type { Pool } from 'pg';
import { DatabaseService } from './database.service.js';

function createDatabase() {
  const queries: string[] = [];
  const client = {
    query: vi.fn(async (sql: string) => {
      queries.push(sql);
      return { rows: [] };
    }),
    release: vi.fn(),
  };
  const pool = { connect: vi.fn(async () => client), on: vi.fn() };
  const database = new DatabaseService(pool as unknown as Pool);
  return { database, client, queries };
}

describe('Transacciones PostgreSQL', () => {
  it('mantiene todas las escrituras en la misma conexión y confirma al finalizar', async () => {
    const { database, client, queries } = createDatabase();
    const result = await database.transaction(async (transaction) => {
      await transaction.query('INSERT INTO sales DEFAULT VALUES');
      await transaction.query('INSERT INTO stock_movements DEFAULT VALUES');
      return 'venta-confirmada';
    });
    expect(result).toBe('venta-confirmada');
    expect(queries).toEqual([
      'BEGIN',
      'INSERT INTO sales DEFAULT VALUES',
      'INSERT INTO stock_movements DEFAULT VALUES',
      'COMMIT',
    ]);
    expect(client.release).toHaveBeenCalledOnce();
  });

  it('revierte una escritura parcial y conserva el error de negocio', async () => {
    const { database, client, queries } = createDatabase();
    const businessError = new Error('Stock insuficiente');
    await expect(
      database.transaction(async (transaction) => {
        await transaction.query('INSERT INTO sales DEFAULT VALUES');
        throw businessError;
      }),
    ).rejects.toBe(businessError);
    expect(queries).toEqual([
      'BEGIN',
      'INSERT INTO sales DEFAULT VALUES',
      'ROLLBACK',
    ]);
    expect(client.release).toHaveBeenCalledOnce();
  });

  it('descarta una conexión si el rollback falla', async () => {
    const { database, client } = createDatabase();
    const businessError = new Error('Operación fallida');
    client.query.mockImplementation(async (sql: string) => {
      if (sql === 'ROLLBACK') throw new Error('Conexión perdida');
      return { rows: [] };
    });
    await expect(
      database.transaction(async () => {
        throw businessError;
      }),
    ).rejects.toBe(businessError);
    expect(client.release).toHaveBeenCalledWith(expect.any(Error));
  });
});
