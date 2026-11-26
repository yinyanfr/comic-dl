import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import { createServer } from 'node:http';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { env, execPath, pid } from 'node:process';
import { test } from 'node:test';
import { setImmediate } from 'node:timers/promises';
import { fileURLToPath, URL } from 'node:url';
import { promisify } from 'node:util';
import downloader, { createDownloader } from 'comic-dl';
import { readConfig } from '../dist/config.js';
import helloExtension from '../examples/hello-extension.mjs';

const exec = promisify(execFile);
const root = fileURLToPath(new URL('../', import.meta.url));
const cli = join(root, 'dist/index.js');
const hello = './examples/hello-extension.mjs';

function run(...args) {
  return exec(execPath, [cli, ...args], {
    cwd: root,
    env: {
      ...env,
      COMIC_DL_EXTENSION_DIR: join(root, 'test', 'no-managed-extensions'),
    },
  });
}

async function makeDirectory(t) {
  const directory = await mkdtemp(join(tmpdir(), 'comic-dl-extension-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

test('the CLI loads multiple explicit extensions and downloads through an independent source', async (t) => {
  const directory = await makeDirectory(t);
  await writeFile(
    join(directory, 'second.mjs'),
    `import hello from ${JSON.stringify(new URL('../examples/hello-extension.mjs', import.meta.url).href)};
    export default { ...hello, id: 'second' };`,
  );
  assert.equal((await run('src')).stdout, 'fixture\n');
  await assert.rejects(run('list', '--source', 'hello', 'demo'), {
    code: 2,
    stderr: /Unknown source: hello/,
  });
  assert.equal(
    (
      await run(
        'sources',
        '--extension',
        hello,
        '--extension',
        join(directory, 'second.mjs'),
      )
    ).stdout,
    'fixture\nhello\nsecond\n',
  );
  const options = ['--extension', hello, '--source', 'hello'];
  assert.equal(
    (await run('list', ...options, 'demo')).stdout,
    'welcome\tWelcome\n',
  );
  const outputDirectory = join(directory, 'downloads');
  const output = ['--output', outputDirectory];
  assert.match(
    (await run('chapter', ...options, 'welcome', ...output)).stdout,
    /^Downloaded: /,
  );
  assert.match(
    (await run('download', ...options, 'demo', ...output)).stdout,
    /0 downloaded, 1 skipped, 0 restricted, 0 failed/,
  );
  assert.match(
    (await readdir(outputDirectory)).join('\n'),
    /^chapter-welcome-[a-f0-9]+\.cbz$/,
  );
});

test('extensions with an unsupported version, a duplicate ID or an invalid source are rejected', async (t) => {
  const directory = await makeDirectory(t);
  const file = join(directory, 'extension.mjs');
  await writeFile(
    file,
    'export default {apiVersion: 2, id: "other", create() {}};',
  );
  await assert.rejects(run('sources', '--extension', file), {
    code: 1,
    stderr: /Invalid source extension .* API version 1/,
  });
  await writeFile(
    file,
    'export default {apiVersion: 1, id: "fixture", create() {}};',
  );
  await assert.rejects(run('sources', '--extension', file), {
    code: 1,
    stderr: /Duplicate source ID: fixture/,
  });
  await writeFile(
    file,
    'export default {apiVersion: 1, id: "other", create() { return {}; }};',
  );
  await assert.rejects(
    run('list', '--extension', file, '--source', 'other', 'demo'),
    {
      code: 1,
      stderr: /Extension other returned an invalid source/,
    },
  );
  await assert.rejects(
    run('sources', '--extension', 'https://example.invalid/extension.mjs'),
    {
      code: 1,
      stderr: /installed package name or a local extension file path/,
    },
  );
});

test('loads config-relative paths and gives explicit options precedence', async (t) => {
  const directory = await makeDirectory(t);
  const file = join(directory, 'comic-dl.json');
  await copyFile(join(root, hello), join(directory, 'hello.mjs'));
  await writeFile(
    file,
    JSON.stringify({
      version: 1,
      extensions: ['./hello.mjs'],
      source: 'hello',
      output: 'configured-output',
      jobs: 1,
      retries: 0,
    }),
  );
  const config = ['--config', file];
  assert.equal((await run('sources', ...config)).stdout, 'fixture\nhello\n');
  assert.equal(
    (await run('list', 'demo', ...config)).stdout,
    'welcome\tWelcome\n',
  );
  const args = ['download', 'demo', ...config, '--chapter', 'welcome'];
  const configured = join(directory, 'configured-output');
  const output = join(directory, 'cli-output');
  assert.ok(
    (await run(...args)).stdout.startsWith(`Downloaded: ${configured}`),
  );
  assert.equal((await readdir(configured)).length, 1);
  await rm(join(directory, 'hello.mjs'));
  assert.ok(
    (
      await run(
        ...args,
        '--extension',
        hello,
        '--source',
        'hello',
        '--output',
        output,
      )
    ).stdout.startsWith(`Downloaded: ${output}`),
  );
  assert.equal((await readdir(output)).length, 1);
  await assert.rejects(
    run('list', 'demo', ...config, '--extension', hello, '--source', 'other'),
    {
      code: 2,
      stderr: /Unknown source: other/,
    },
  );
});

test('expands home-relative output in migrated JSON configs', async (t) => {
  const directory = await makeDirectory(t);
  const config = join(directory, 'config.json');
  await writeFile(config, JSON.stringify({ version: 1, output: '~/manga' }));
  assert.equal(
    (await readConfig(config, t.signal)).output,
    join(homedir(), 'manga'),
  );
});

test('chapter retries a transient error while resolving a direct link', async (t) => {
  const directory = await makeDirectory(t);
  const file = join(directory, 'retry.mjs');
  await writeFile(
    file,
    `import hello from ${JSON.stringify(new URL('../examples/hello-extension.mjs', import.meta.url).href)};
    export default { ...hello, create(api) {
      const source = hello.create(api);
      let attempts = 0;
      return { ...source, async getChapter(...args) {
        if (++attempts === 1) throw new api.TransientSourceError('Test disconnect');
        return source.getChapter(...args);
      }};
    }};`,
  );
  const args = [
    'chapter',
    'welcome',
    '--extension',
    file,
    '--source',
    'hello',
    '-o',
    directory,
  ];
  await assert.rejects(run(...args, '--retries', '0'), {
    code: 1,
    stderr: /hello: could not resolve the chapter: Test disconnect/,
  });
  assert.match((await run(...args, '--retries', '1')).stdout, /^Downloaded:/);
});

test('validates config without echoing its contents and exposes command-specific help', async (t) => {
  const directory = await makeDirectory(t);
  const file = join(directory, 'config.json');
  assert.match((await run('--help')).stdout, /^Usage: comic-dl <command>/);
  assert.match((await run('-V')).stdout, /^\d+\.\d+\.\d+.*\n$/);
  assert.match(
    (await run('d', '--help', '--config', file)).stdout,
    /^Usage: comic-dl download[\s\S]*--chapter <selection>[\s\S]*--config <file>/,
  );
  assert.doesNotMatch((await run('list', '-h')).stdout, /--output|--jobs/);
  await assert.rejects(run('list', 'demo', '--output', directory), { code: 2 });
  await assert.rejects(run('ls', '-u', 'demo'), { code: 2 });
  const options = ['sources', '--config', file];
  await assert.rejects(run(...options), {
    code: 2,
    stderr: /Could not read config/,
  });
  for (const [contents, diagnostic] of [
    ['not-json-secret', /not valid JSON/],
    ['{"version":2}', /"version": 1/],
    ['{"version":1,"auth":"not-json-secret"}', /unknown field/],
    ['{"version":1,"jobs":"2"}', /"jobs" requires an integer/],
  ]) {
    await writeFile(file, contents);
    await assert.rejects(run(...options), (error) => {
      assert.equal(error.code, 2);
      assert.equal(error.stdout, '');
      assert.match(error.stderr, diagnostic);
      assert.doesNotMatch(error.stderr, /not-json-secret/);
      return true;
    });
  }
});

test('the library registers sources without reading CLI state and returns download results', async (t) => {
  const directory = await makeDirectory(t);
  const instance = createDownloader().use(helloExtension);
  assert.deepEqual(downloader.sources(), []);
  assert.deepEqual(instance.sources(), ['hello']);
  assert.equal((await instance.list('demo', { source: 'hello' })).id, 'demo');
  const [result] = await instance.download('demo', {
    source: 'hello',
    directory,
  });
  assert.equal(result.status, 'downloaded');
  assert.equal((await readdir(directory)).length, 1);
});

test(
  'a throwing result callback stops new work and waits for active chapters',
  { timeout: 5_000 },
  async () => {
    const started = [];
    const active = Promise.withResolvers();
    const callback = Promise.withResolvers();
    const failure = new Error('Callback failed');
    const instance = createDownloader().use({
      ...helloExtension,
      create(api) {
        const source = helloExtension.create(api);
        return {
          ...source,
          async getSeries() {
            return {
              id: 'demo',
              chapters: ['first', 'active', 'pending'].map((id) => ({
                id,
                title: id,
                async getPages() {
                  started.push(id);
                  if (id === 'active') await active.promise;
                  return [];
                },
              })),
            };
          },
        };
      },
    });
    const reported = [];
    let settled = false;
    const result = assert
      .rejects(
        instance.download('demo', {
          source: 'hello',
          onResult(chapter) {
            reported.push(chapter.chapterId);
            callback.resolve();
            throw failure;
          },
        }),
        failure,
      )
      .finally(() => {
        settled = true;
      });
    await callback.promise;
    await setImmediate();
    try {
      assert.equal(settled, false);
    } finally {
      active.resolve();
    }
    await result;
    assert.deepEqual(started, ['first', 'active']);
    assert.deepEqual(reported, ['first']);
  },
);

test('npm-managed extensions are discovered and updates stay in range', async (t) => {
  const directory = await makeDirectory(t);
  const name = '@example/comic-dl-test-source';
  const registry = new Map();
  const archives = new Map();
  const server = createServer((request, response) => {
    const path = decodeURIComponent(request.url);
    if (archives.has(path)) {
      response.end(archives.get(path));
    } else if (registry.has(path.slice(1))) {
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify(registry.get(path.slice(1))));
    } else {
      response.writeHead(404).end();
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const origin = `http://127.0.0.1:${server.address().port}`;
  async function publish(version, apiVersion = 1, packageName = name) {
    const project = join(
      directory,
      `${version}-${packageName.split('/').at(-1)}`,
    );
    await mkdir(project);
    const manifest = {
      name: packageName,
      version,
      type: 'module',
      exports: './index.js',
      scripts: { postinstall: 'node -e "process.exit(55)"' },
    };
    await writeFile(join(project, 'package.json'), JSON.stringify(manifest));
    const sample = await readFile(join(root, hello), 'utf8');
    await writeFile(
      join(project, 'index.js'),
      sample
        .replace('apiVersion: 1', `apiVersion: ${apiVersion}`)
        .replace("title: 'Welcome'", `title: '${version}'`),
    );
    const args = ['pack', '--ignore-scripts', '--json'];
    const { stdout } = env.npm_execpath
      ? await exec(execPath, [env.npm_execpath, ...args], { cwd: project })
      : await exec('npm', args, { cwd: project });
    const [{ filename, integrity }] = JSON.parse(stdout);
    const path = `/tarballs/${filename}`;
    archives.set(path, await readFile(join(project, filename)));
    const packument = registry.get(packageName) ?? {
      name: packageName,
      versions: {},
      'dist-tags': {},
    };
    packument.versions[version] = {
      ...manifest,
      dist: { tarball: origin + path, integrity },
    };
    packument['dist-tags'].latest = version;
    registry.set(packageName, packument);
  }
  const managed = (...args) =>
    exec(execPath, [cli, ...args], {
      cwd: directory,
      env: {
        ...env,
        COMIC_DL_EXTENSION_DIR: join(directory, 'store'),
        npm_config_cache: join(directory, 'npm-cache'),
        npm_config_registry: origin,
        npm_config_fetch_retries: '0',
      },
    });
  const list = () => managed('list', '--source', 'hello', 'demo');
  await publish('1.0.0');
  await managed('add', name);
  assert.equal(
    (await managed('sources', '--extension', name)).stdout,
    'fixture\nhello\n',
  );
  assert.equal((await list()).stdout, 'welcome\t1.0.0\n');
  await publish('1.1.0');
  await publish('2.0.0');
  await managed('update', name);
  assert.equal((await list()).stdout, 'welcome\t1.1.0\n');
  await publish('1.2.0');
  const writers = join(directory, 'store', 'writers');
  const orphan = spawn(execPath, ['-e', '']);
  await once(orphan, 'exit');
  const abandonedLock = join(writers, `${orphan.pid}-${randomUUID()}`);
  const activeLock = join(writers, `${pid}-${randomUUID()}`);
  await mkdir(abandonedLock);
  await mkdir(activeLock);
  await assert.rejects(managed('update'), {
    code: 1,
    stderr: /Extension store is locked by another command/,
  });
  assert.equal((await list()).stdout, 'welcome\t1.1.0\n');
  await rm(activeLock, { recursive: true });
  await managed('update');
  assert.deepEqual(await readdir(writers), []);
  assert.equal((await list()).stdout, 'welcome\t1.2.0\n');
  const invalid = '@example/invalid';
  await publish('1.0.0', 2, invalid);
  await assert.rejects(managed('add', invalid), {
    stderr: /Invalid source extension/,
  });
  assert.equal((await list()).stdout, 'welcome\t1.2.0\n');
  await managed('remove', name);
  assert.equal((await managed('sources')).stdout, 'fixture\n');
});
