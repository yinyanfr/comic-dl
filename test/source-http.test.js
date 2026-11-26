import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { test } from 'node:test';
import { setTimeout } from 'node:timers';
import { createSourceHttp } from '../dist/sources/http.js';
import { TransientSourceError } from '../dist/sources/source.js';

async function serve(t, handle) {
  const server = createServer(handle);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve) => server.close(resolve)));
  return `http://127.0.0.1:${server.address().port}`;
}

test('credentials are opt-in, origin-scoped and never reattached after an external redirect', async (t) => {
  const requests = [];
  function capture(request) {
    const { authorization, cookie, 'x-source-token': token } = request.headers;
    requests.push([request.url, authorization, cookie, token]);
  }

  const sourceOrigin = await serve(t, (request, reply) => {
    capture(request);
    if (request.url === '/same-origin') {
      reply.writeHead(302, { location: '/authenticated' });
    } else if (request.url === '/cross-origin') {
      reply.writeHead(302, { location: `${imagesOrigin}/bounce` });
    } else if (request.url === '/other-allowed-origin') {
      reply.writeHead(302, { location: `${otherOrigin}/landing` });
    }
    reply.end('source');
  });
  const imagesOrigin = await serve(t, (request, reply) => {
    capture(request);
    if (request.url === '/bounce') {
      reply.writeHead(307, { location: `${sourceOrigin}/return` });
    }
    reply.end('image');
  });
  const otherOrigin = await serve(t, (request, reply) => {
    capture(request);
    reply.end('other');
  });

  const secrets = ['Bearer test', 'session=test', 'test-key'];
  const read = createSourceHttp({
    credentialOrigins: [sourceOrigin, otherOrigin],
    credentialHeaders: {
      Authorization: secrets[0],
      Cookie: secrets[1],
      'X-Source-Token': secrets[2],
    },
  });
  await read(`${sourceOrigin}/page`, t.signal);
  await read(`${imagesOrigin}/page`, t.signal, true);
  await read(`${sourceOrigin}/same-origin`, t.signal, true);
  await read(`${sourceOrigin}/cross-origin`, t.signal, true);
  await read(`${sourceOrigin}/other-allowed-origin`, t.signal, true);
  await read(`${otherOrigin}/direct`, t.signal, true);
  const anonymous = [undefined, undefined, undefined];
  assert.deepEqual(requests, [
    ['/page', ...anonymous],
    ['/page', ...anonymous],
    ['/same-origin', ...secrets],
    ['/authenticated', ...secrets],
    ['/cross-origin', ...secrets],
    ['/bounce', ...anonymous],
    ['/return', ...anonymous],
    ['/other-allowed-origin', ...secrets],
    ['/landing', ...anonymous],
    ['/direct', ...secrets],
  ]);
});

test('the source HTTP session classifies rate limits and rejects unsafe redirect destinations', async (t) => {
  const origin = await serve(t, (request, reply) => {
    if (request.url === '/rate') {
      reply.writeHead(429).end();
    } else if (request.url === '/missing') {
      reply.writeHead(404).end();
    } else {
      reply.writeHead(302, { location: 'file:///unexpected' }).end();
    }
  });
  const read = createSourceHttp({
    credentialOrigins: [],
    credentialHeaders: {},
  });
  await assert.rejects(read(`${origin}/rate`, t.signal), TransientSourceError);
  await assert.rejects(read(`${origin}/missing`, t.signal), {
    message: 'Source returned HTTP 404',
  });
  await assert.rejects(
    read(`${origin}/redirect`, t.signal),
    /requires an HTTP\(S\) URL/,
  );
});

test('connection and response interruptions are retryable without logging the request URL', async (t) => {
  const origin = await serve(t, (request, reply) => {
    if (request.url.startsWith('/body')) {
      reply.writeHead(200, { 'Content-Length': '10' });
      reply.write('one');
      setTimeout(() => reply.destroy(), 40);
    } else {
      request.socket.destroy();
    }
  });
  const read = createSourceHttp({
    credentialOrigins: [],
    credentialHeaders: {},
  });
  for (const path of ['/connect', '/body']) {
    await assert.rejects(
      read(`${origin}${path}?key=secret`, t.signal),
      (error) => {
        assert.ok(error instanceof TransientSourceError);
        assert.equal(
          error.message,
          `Network error ${path === '/body' ? 'reading response from' : 'requesting'} ${origin}`,
        );
        return true;
      },
    );
  }
});
