import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

describe('Arranque con el adaptador HTTP de Vercel', () => {
  it('completa la importación antes de abrir el listener y atiende la API', () => {
    // Reproduce el contrato del loader de @vercel/node: captura listen(),
    // espera a que termine import(main) y recién entonces abre el servidor.
    const script = `
      import assert from 'node:assert/strict';
      import http from 'node:http';

      Object.assign(process.env, {
        NODE_ENV: 'test', PORT: '3000',
        FRONTEND_ORIGIN: 'https://frontend.example',
        DATABASE_URL: 'postgresql://test:test@127.0.0.1:1/test',
        DATABASE_SSL: 'false', DATABASE_CA_PATH: '', DATABASE_POOL_MAX: '1',
        SUPABASE_URL: 'http://127.0.0.1:1',
        SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
        SUPABASE_SECRET_KEY: 'sb_secret_test',
      });
      const { DatabaseService } = await import('./dist/infrastructure/database/database.service.js');
      // Esta prueba verifica el arranque HTTP; no conecta servicios externos.
      DatabaseService.prototype.onModuleInit = async function () {};
      DatabaseService.prototype.ping = async function () {};

      async function within(promise, label) {
        let timer;
        try {
          return await Promise.race([
            promise,
            new Promise((_, reject) => {
              timer = setTimeout(() => reject(new Error(label)), 10000);
            }),
          ]);
        } finally {
          clearTimeout(timer);
        }
      }

      const originalListen = http.Server.prototype.listen;
      let capture;
      const captured = new Promise(resolve => { capture = resolve; });
      http.Server.prototype.listen = function () {
        http.Server.prototype.listen = originalListen;
        capture(this);
        return this;
      };
      let server;
      try {
        await within(import('./dist/main.js'), 'La importación quedó bloqueada esperando listen()');
        server = await within(captured, 'La aplicación no entregó un servidor HTTP');
        await new Promise((resolve, reject) => {
          server.once('error', reject);
          originalListen.call(server, 0, '127.0.0.1', resolve);
        });
        const base = 'http://127.0.0.1:' + server.address().port;
        const health = await fetch(base + '/api/health');
        assert.equal(health.status, 200);
        assert.deepEqual(await health.json(), { status: 'ok', database: 'up' });
        const docs = await fetch(base + '/api/docs/');
        assert.equal(docs.status, 200);
        assert.match(await docs.text(), /swagger-ui/);
        const preflight = await fetch(base + '/api/auth/login', {
          method: 'OPTIONS',
          headers: {
            Origin: 'https://frontend.example',
            'Access-Control-Request-Method': 'POST',
            'Access-Control-Request-Headers': 'content-type',
          },
        });
        assert.equal(preflight.status, 204);
        assert.equal(preflight.headers.get('access-control-allow-origin'), 'https://frontend.example');
        console.log('Vercel: importación, health, Swagger y CORS correctos.');
      } finally {
        http.Server.prototype.listen = originalListen;
        if (server?.listening) await new Promise(resolve => server.close(resolve));
      }
    `;
    const output = execFileSync(
      process.execPath,
      [
        '--experimental-require-module',
        '--input-type=module',
        '--eval',
        script,
      ],
      {
        cwd: fileURLToPath(new URL('../', import.meta.url)),
        encoding: 'utf8',
        timeout: 25000,
      },
    );
    expect(output).toContain(
      'Vercel: importación, health, Swagger y CORS correctos.',
    );
  }, 30000);
});
