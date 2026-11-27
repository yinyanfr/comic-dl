import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import {
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  writeFile,
  readdir,
  symlink,
} from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { test } from 'node:test';
import { pathToFileURL, URL } from 'node:url';
import process from 'node:process';
import { setTimeout } from 'node:timers/promises';
import { execFile } from 'node:child_process';
import { createServer } from 'node:http';
import { promisify } from 'node:util';
import Database from 'better-sqlite3';
import {
  createDownloader,
  listManagedExtensions,
  checkExtensionUpdates,
  planArchiveMigration,
  applyArchiveMigration,
} from 'comic-dl';
import { Shelf } from '../dist/shelf.js';
import { trackingSchema } from '../dist/shelf-tracking.js';
import { runShelfCycle } from '../dist/shelf-updates.js';
import { SourceRegistry } from '../dist/sources/index.js';
import { outputFiles } from './helpers/output.js';

const bytes = Uint8Array.of(1, 2, 3);
const { AbortController } = globalThis;

test('portable commits and migrations do not require hardlinks and serialize concurrent writers', async (t) => {
  const directory = await setup(t);
  const script = `
    import assert from 'node:assert/strict';
    import fs from 'node:fs/promises';
    import { syncBuiltinESMExports } from 'node:module';
    import { join } from 'node:path';
    let links = 0;
    fs.link = async () => { links++; throw Object.assign(new Error('Unsupported'), {code:'ENOTSUP'}); };
    syncBuiltinESMExports();
    const { createDownloader, planArchiveMigration, applyArchiveMigration } =
      await import(${JSON.stringify(new URL('../dist/library.js', import.meta.url).href)});
    const directory = ${JSON.stringify(directory)};
    const app = createDownloader({source:'portable'}).use({id:'portable',apiVersion:1,create:()=>({
      id:'portable',async getChapter(){},async getSeries(){return {id:'work',metadata:{title:'Work'},
      chapters:[{id:'one',title:'One',async getPages(){return [{id:'1',extension:'png',
      async read(){return Uint8Array.of(1,2,3);}}];}}]};},
    })});
    const results = await Promise.all([app.download('work',{directory}),app.download('work',{directory})]);
    assert.equal(results.flat().filter(result=>result.status==='downloaded').length,1);
    assert.equal(results.flat().filter(result=>result.status==='skipped').length,1);
    const plan = await planArchiveMigration(directory,[{
      identity:['portable','work','one'],title:'Other',chapter:'One',number:1,
    }]);
    assert.equal(plan[0].status,'move');
    await fs.mkdir(join(directory,'Other'));
    await fs.writeFile(join(directory,plan[0].to),'sentinel');
    await assert.rejects(applyArchiveMigration(directory,plan),/occupied/);
    assert.equal(await fs.readFile(join(directory,plan[0].to),'utf8'),'sentinel');
    await fs.rm(join(directory,plan[0].to));
    await applyArchiveMigration(directory,plan);
    await fs.access(join(directory,plan[0].to));
    await assert.rejects(fs.access(join(directory,plan[0].from)),{code:'ENOENT'});
    assert.equal(links,0);
  `;
  await promisify(execFile)(process.execPath, [
    '--input-type=module',
    '-e',
    script,
  ]);
});

test('archive indexing isolates inaccessible or disappearing unrelated directories but not root errors', async (t) => {
  const directory = await setup(t);
  const script = `
    import assert from 'node:assert/strict';
    import fs from 'node:fs/promises';
    import { syncBuiltinESMExports } from 'node:module';
    import { join } from 'node:path';
    const original = fs.readdir;
    let blocked, code, calls = 0;
    fs.readdir = async (path,...args) => {
      if (path === blocked) { calls++; throw Object.assign(new Error(code+' simulated'),{code}); }
      return original(path,...args);
    };
    syncBuiltinESMExports();
    const { createDownloader } = await import(${JSON.stringify(new URL('../dist/library.js', import.meta.url).href)});
    const app = createDownloader({source:'portable'}).use({id:'portable',apiVersion:1,create:()=>({
      id:'portable',async getChapter(){},async getSeries(){return {id:'work',
      chapters:[{id:'one',title:'One',async getPages(){return [{id:'1',extension:'png',
      async read(){return Uint8Array.of(1);}}];}}]};},
    })});
    for (code of ['EACCES','EPERM','ENOENT','ENOTDIR']) {
      const directory = join(${JSON.stringify(directory)},code);
      blocked = join(directory,'unrelated');
      await fs.mkdir(blocked,{recursive:true});
      blocked = await fs.realpath(blocked);
      const result = await app.download('work',{directory,jobs:2});
      assert.equal(result[0].status,'downloaded',result[0].error);
    }
    assert.equal(calls,4);
    blocked = join(${JSON.stringify(directory)},'root');
    code = 'EACCES';
    await fs.mkdir(blocked);
    blocked = await fs.realpath(blocked);
    const [failed] = await app.download('work',{directory:blocked});
    assert.equal(failed.status,'failed');
    assert.match(failed.error,/EACCES/);
  `;
  await promisify(execFile)(process.execPath, [
    '--input-type=module',
    '-e',
    script,
  ]);
});

test('manual retries use private chapter IDs rather than redacted display metadata', async (t) => {
  const directory = await setup(t),
    fixture = source();
  fixture.setIds(['/chapter/one']);
  let failing = true;
  fixture.setRead(async () => {
    if (failing) throw new Error('temporary failure');
    return bytes;
  });
  const app = createDownloader({ source: 'test-web', output: directory }).use(
    fixture.extension,
  );
  const events = [];
  const handle = app.startDownload('work', {
    onEvent: (event) => events.push(event),
  });
  await handle.done;
  assert.equal(handle.snapshot()[0].chapterId, '[redacted]');
  assert.equal(handle.snapshot()[0].state, 'failed');
  failing = false;
  await handle.retry();
  assert.equal(handle.snapshot()[0].state, 'downloaded');
  assert.equal(handle.snapshot()[0].chapterId, '[redacted]');
  assert.equal(handle.snapshot()[0].id, events[0].task.id);
  assert.ok(events.every((event) => event.task.chapterId === '[redacted]'));
});
async function setup(t) {
  const directory = await mkdtemp(join(tmpdir(), 'comic-dl-web-services-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}
function source() {
  let ids = ['one', 'two', 'three'];
  let reads = 0;
  let read = async () => {
    reads++;
    return bytes;
  };
  const extension = {
    id: 'test-web',
    apiVersion: 1,
    create: () => ({
      id: 'test-web',
      async readCover(id) {
        assert.equal(id, 'work');
        return { bytes, contentType: 'image/png' };
      },
      async getSeries() {
        return {
          id: 'work',
          metadata: { title: '作品', coverId: 'work', authors: ['Author'] },
          chapters: ids.map((id) => ({
            id,
            title: `Chapter ${id}`,
            async getPages() {
              return [1, 2].map((page) => ({
                id: String(page),
                extension: 'png',
                read,
              }));
            },
          })),
        };
      },
      async getChapter() {
        return {
          workId: 'work',
          seriesInput: 'work',
          chapter: {
            id: 'three',
            title: 'direct',
            async getPages() {
              throw new Error('Use the canonical catalog');
            },
          },
        };
      },
    }),
  };
  return {
    extension,
    setIds(value) {
      ids = value;
    },
    setRead(value) {
      read = value;
    },
    get reads() {
      return reads;
    },
  };
}

test('canonical numbering, formats, legacy identity, migration preview and no-clobber', async (t) => {
  const directory = await setup(t),
    output = join(directory, 'output');
  const fixture = source();
  const app = createDownloader({ source: 'test-web' }).use(fixture.extension);
  assert.equal((await app.list('work')).metadata.title, '作品');
  assert.equal((await app.readCover('work')).contentType, 'image/png');
  const events = [];
  const direct = await app.downloadChapter('direct', {
    directory: output,
    onEvent: (event) => events.push(event),
  });
  assert.ok(direct.path.endsWith('作品/3-Chapter three.cbz'));
  assert.equal(events[0].task.number, 3);
  assert.equal(events[0].task.workTitle, '作品');
  assert.equal(events[0].task.chapterId, 'three');
  const [selected] = await app.download('work', {
    directory: output,
    chapters: ['two'],
    archive: { padding: 3, format: 'zip' },
  });
  assert.ok(selected.path.endsWith('作品/002-Chapter two.zip'));
  const hash = createHash('sha256')
    .update(JSON.stringify(['test-web', 'work', 'two']))
    .digest('hex');
  const legacy = join(output, `chapter-two-${hash}.cbz`);
  await rename(selected.path, legacy);
  const reads = fixture.reads;
  fixture.setIds(['three', 'one', 'two']); // Renumbering and format changes do not change identity.
  const [skipped] = await app.download('work', {
    directory: output,
    chapters: ['two'],
    archive: { template: '{workId}/{chapterId}', format: 'cbz' },
  });
  assert.equal(skipped.status, 'skipped');
  assert.equal(skipped.path, legacy);
  assert.equal(fixture.reads, reads);
  const entries = [
    {
      identity: ['test-web', 'work', 'two'],
      title: '作品',
      chapter: 'Chapter two',
      number: 3,
    },
  ];
  const plan = await planArchiveMigration(output, entries);
  assert.equal(plan[0].status, 'move');
  assert.ok((await readdir(output)).includes(`chapter-two-${hash}.cbz`));
  await applyArchiveMigration(output, plan);
  assert.ok((await outputFiles(output)).includes('作品/3-Chapter two.cbz'));
  await assert.rejects(
    applyArchiveMigration(output, [{ ...plan[0], from: '../outside' }]),
    /inside/,
  );
  await assert.rejects(
    app.download('work', {
      directory: output,
      archive: { template: '../{chapter}' },
    }),
    /template/,
  );
  const sentinel = join(directory, 'sentinel');
  await mkdir(sentinel);
  await symlink(sentinel, join(output, 'unsafe'), 'dir');
  await assert.rejects(
    app
      .download('work', {
        directory: output,
        chapters: ['one'],
        archive: { template: 'unsafe/{chapter}' },
      })
      .then((results) => {
        assert.equal(results[0].status, 'failed');
        throw new Error('unsafe rejected');
      }),
    /unsafe rejected/,
  );
  assert.deepEqual(await readdir(sentinel), []);
});

test('manual handles expose snapshots, page progress, cancellation, safe failures and retry', async (t) => {
  const directory = await setup(t),
    fixture = source(),
    events = [];
  fixture.setIds(['one']);
  let fail = true;
  fixture.setRead(async () => {
    if (fail) throw new Error('/private/path?token=secret');
    return bytes;
  });
  const app = createDownloader({ source: 'test-web', output: directory }).use(
    fixture.extension,
  );
  const handle = app.startDownload('work', {
    onEvent: (event) => events.push(event),
  });
  await handle.done;
  assert.equal(handle.snapshot()[0].state, 'failed');
  assert.doesNotMatch(
    JSON.stringify(handle.snapshot()),
    /private|secret|token|\.cbz/,
  );
  fail = false;
  await handle.retry();
  const snapshot = handle.snapshot()[0];
  assert.equal(snapshot.state, 'downloaded');
  assert.equal(snapshot.pagesDownloaded, 2);
  assert.deepEqual(
    events
      .filter((event) => event.task.state === 'reading')
      .map((event) => event.task.pagesDownloaded),
    [1, 2],
  );
  assert.ok(events.some((event) => event.task.state === 'archiving'));
  assert.equal(snapshot.id, events[0].task.id);
  snapshot.state = 'failed';
  assert.equal(handle.snapshot()[0].state, 'downloaded');
  fixture.setIds(['two', 'three']);
  fixture.setRead(async (signal) => {
    await setTimeout(10000, undefined, { signal });
    return bytes;
  });
  const ready = Promise.withResolvers();
  const cancelled = app.startDownload('work', {
    jobs: 1,
    onEvent: (event) => {
      if (event.task.state === 'starting') ready.resolve();
    },
  });
  await ready.promise;
  cancelled.cancel();
  await assert.rejects(cancelled.done, { name: 'AbortError' });
  assert.ok(cancelled.snapshot().every((task) => task.state === 'cancelled'));
});

test('manual checking, independent automation, discovery, queue cancellation and restart', async (t) => {
  const directory = await setup(t),
    fixture = source();
  fixture.setIds(['one']);
  const app = createDownloader({ source: 'test-web' }).use(fixture.extension);
  const file = join(directory, 'shelf.db');
  let shelf = await app.openShelf({ file });
  const entry = await shelf.add('work');
  assert.equal((await shelf.check()).events[0].status, 'baseline');
  fixture.setIds(['one', 'two']);
  const checked = await shelf.check({ entryId: entry.id });
  assert.equal(checked.events[0].discovered, 1);
  assert.equal(checked.events[0].status, 'updated');
  assert.equal(checked.queued, 0);
  assert.equal(shelf.chapters(entry.id)[1].state, 'discovered');
  await shelf.check();
  assert.equal(shelf.chapters(entry.id)[1].state, 'discovered');
  shelf.configure(entry.id, {
    autoCheck: true,
    autoDownload: true,
    intervalSeconds: 120,
  });
  const baseline = shelf.status(entry.id)[0].lastSuccess;
  shelf.configure(entry.id, { intervalSeconds: 240 });
  assert.equal(shelf.status(entry.id)[0].lastSuccess, baseline);
  assert.ok(shelf.status(entry.id)[0].nextCheck >= Date.now() + 239000);
  fixture.setIds(['one', 'two', 'three']);
  assert.equal((await shelf.check()).queued, 1);
  shelf.configure(entry.id, { autoCheck: false, autoDownload: false });
  assert.equal(shelf.status(entry.id)[0].pending, 1);
  assert.equal(shelf.enqueue(entry.id, 'two'), true);
  assert.equal(shelf.enqueue(entry.id, 'two'), false);
  assert.equal(shelf.cancel(entry.id, 'three'), true);
  shelf.close();
  shelf = await app.openShelf({ file });
  t.after(() => shelf.close());
  assert.equal(
    shelf.tasks().find((task) => task.chapterId === 'three').state,
    'cancelled',
  );
  const controller = new AbortController();
  await shelf
    .watch({
      signal: controller.signal,
      directory: join(directory, 'archives'),
      onTask() {
        controller.abort();
      },
    })
    .catch((error) => {
      if (!controller.signal.aborted) throw error;
    });
  assert.equal(
    shelf.tasks().find((task) => task.chapterId === 'two').state,
    'downloaded',
  );
  assert.equal(shelf.retry(entry.id, 'three'), true);
  assert.equal(
    shelf.tasks().find((task) => task.chapterId === 'three').state,
    'queued',
  );
});

test('v2 migration keeps baseline and task results while splitting both automation switches', async (t) => {
  const directory = await setup(t),
    file = join(directory, 'shelf.db');
  const db = new Database(file);
  db.exec(`CREATE TABLE shelf_entries (
    id TEXT PRIMARY KEY NOT NULL, source_id TEXT NOT NULL, work_id TEXT NOT NULL,
    input TEXT NOT NULL, title TEXT NOT NULL, following INTEGER NOT NULL,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 0,
    UNIQUE(source_id,work_id)) STRICT;`);
  db.exec(trackingSchema);
  db.exec(`INSERT INTO shelf_entries(id,source_id,work_id,input,title,following,created_at,updated_at,last_success)
    VALUES ('a','s','a','a','A',1,'now','now',123),('b','s','b','b','B',0,'now','now',456);
    INSERT INTO shelf_chapters(entry_id,catalog_version,chapter_id,state)
    VALUES ('a',0,'baseline','seen'),('a',0,'pending','queued'),('b',0,'failed','blocked'),('b',0,'done','complete');
    PRAGMA user_version = 2;`);
  db.close();
  const shelf = await createDownloader().openShelf({ file });
  t.after(() => shelf.close());
  assert.deepEqual(
    shelf.list().map((entry) => [entry.autoCheck, entry.autoDownload]),
    [
      [1, 1],
      [0, 0],
    ],
  );
  assert.equal(shelf.status('a')[0].lastSuccess, 123);
  assert.equal(shelf.status('b')[0].complete, 1);
  assert.equal(
    shelf.tasks('b').find((task) => task.chapterId === 'failed').state,
    'failed',
  );
  assert.equal(shelf.chapters('a')[0].state, 'seen');
});

test('NAS root marker and existing child are independent, disappear and recover without recreation', async (t) => {
  const directory = await setup(t),
    root = join(directory, 'mount'),
    output = join(root, 'Manga');
  await mkdir(output, { recursive: true });
  const marker = join(root, '.nas-ready');
  await writeFile(marker, '');
  const fixture = source();
  fixture.setIds(['one']);
  const shelf = new Shelf(join(directory, 'shelf.db'));
  t.after(() => shelf.close());
  const sources = new SourceRegistry().use(fixture.extension);
  const signal = new AbortController().signal;
  const entry = await shelf.add(sources, 'test-web', 'work', { signal });
  shelf.setFollowing(entry.id, true);
  let now = 1_000_000;
  const cycle = () =>
    runShelfCycle(shelf.tracking, sources, shelf.tracking.due(now), {
      directory: output,
      outputRoot: root,
      outputMarker: '.nas-ready',
      signal,
      jobs: 1,
      retries: 0,
      now: () => now,
      onCheck() {},
      onTask() {},
    });
  await cycle();
  fixture.setIds(['one', 'two']);
  now += 3600000;
  await rm(marker);
  await cycle();
  assert.equal(shelf.tracking.status()[0].pending, 1);
  assert.deepEqual(await outputFiles(output), []);
  await writeFile(marker, '');
  const moved = join(root, 'moved');
  await rename(output, moved);
  now += 60000;
  await cycle();
  await assert.rejects(readdir(output), { code: 'ENOENT' });
  await rename(moved, output);
  now += 60000;
  fixture.setRead(async () => {
    await rm(marker, { force: true });
    return bytes;
  });
  await cycle();
  assert.deepEqual(await outputFiles(output), []);
  assert.equal(shelf.tracking.status()[0].pending, 1);
  fixture.setRead(async () => bytes);
  await writeFile(marker, '');
  now += 60000;
  await cycle();
  assert.equal(shelf.tracking.status()[0].complete, 1);
  assert.deepEqual(await outputFiles(output), ['作品/2-Chapter two.cbz']);
});

test('read-only extension inventory includes broken packages without changing the generation', async (t) => {
  const directory = await setup(t),
    generation = randomUUID(),
    project = join(directory, generation);
  await mkdir(join(project, 'readers'), { recursive: true });
  const dependencies = { '@test/good': '^1.0.0', '@test/bad': 'next' };
  await writeFile(
    join(project, 'package.json'),
    JSON.stringify({ dependencies }),
  );
  for (const name of Object.keys(dependencies)) {
    await mkdir(join(project, 'node_modules', name), { recursive: true });
    await writeFile(
      join(project, 'node_modules', name, 'package.json'),
      JSON.stringify({ name, version: '1.0.0' }),
    );
    await writeFile(
      join(project, 'node_modules', name, 'index.mjs'),
      name.endsWith('bad')
        ? 'throw new Error("secret");'
        : 'export default {id:"test",apiVersion:1,create(){ throw new Error("Credentials required") }}',
    );
  }
  await writeFile(
    join(project, 'resolve.mjs'),
    `export const resolvePackage = name => ${JSON.stringify(pathToFileURL(join(project, 'node_modules/')).href)} + name + "/index.mjs";`,
  );
  await writeFile(join(directory, 'current'), generation);
  const result = await listManagedExtensions({ directory });
  assert.deepEqual(
    result.map((entry) => [entry.package, entry.status, entry.sourceId]),
    [
      ['@test/bad', 'failed', null],
      ['@test/good', 'loaded', 'test'],
    ],
  );
  assert.equal(result[1].requested, '^1.0.0');
  assert.equal(result[1].version, '1.0.0');
  assert.equal(await readFile(join(directory, 'current'), 'utf8'), generation);
  assert.deepEqual(await readdir(join(project, 'readers')), []);
  let tag = '1.1.0';
  const registry = createServer((request, response) => {
    if (decodeURIComponent(request.url).split('?')[0] !== '/@test/good') {
      response.writeHead(404).end();
      return;
    }
    response.setHeader('content-type', 'application/json');
    response.end(
      JSON.stringify({
        name: '@test/good',
        'dist-tags': { latest: '2.0.0', next: tag },
        versions: Object.fromEntries(
          ['1.0.0', '1.1.0', '1.2.0-beta.1', '2.0.0'].map((version) => [
            version,
            { name: '@test/good', version },
          ]),
        ),
      }),
    );
  });
  await new Promise((resolve) => registry.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => registry.close(resolve)));
  const query = async (name) => {
    const script = `import { checkExtensionUpdates } from ${JSON.stringify(new URL('../dist/library.js', import.meta.url).href)};
      console.log(JSON.stringify(await checkExtensionUpdates(${JSON.stringify(name)}, { directory: ${JSON.stringify(directory)} })));`;
    const { stdout } = await promisify(execFile)(
      process.execPath,
      ['--input-type=module', '-e', script],
      {
        env: {
          ...process.env,
          npm_config_registry: `http://127.0.0.1:${registry.address().port}`,
          npm_config_fetch_retries: '0',
          npm_config_cache: join(directory, 'cache'),
        },
      },
    );
    return JSON.parse(stdout);
  };
  const updates = await query();
  assert.equal(updates[0].updateStatus, 'failed');
  assert.equal(updates[1].updateStatus, 'available');
  assert.equal(updates[1].availableVersion, '1.1.0');
  assert.equal(
    (await listManagedExtensions({ directory }))[1].version,
    '1.0.0',
  );
  assert.equal(await readFile(join(directory, 'current'), 'utf8'), generation);
  dependencies['@test/good'] = 'next';
  await writeFile(
    join(project, 'package.json'),
    JSON.stringify({ dependencies }),
  );
  assert.equal((await query('@test/good'))[0].availableVersion, '1.1.0');
  tag = '1.2.0-beta.1';
  assert.equal((await query('@test/good'))[0].availableVersion, '1.2.0-beta.1');
  tag = '1.0.0';
  assert.equal((await query('@test/good'))[0].updateStatus, 'current');
  dependencies['@test/good'] = '1.0.0';
  await writeFile(
    join(project, 'package.json'),
    JSON.stringify({ dependencies }),
  );
  assert.equal((await query('@test/good'))[0].updateStatus, 'current');
  assert.deepEqual(await readdir(join(project, 'readers')), []);
  await assert.rejects(
    checkExtensionUpdates('@test/missing', { directory }),
    /not installed/,
  );
  const absent = join(directory, 'absent');
  assert.deepEqual(await listManagedExtensions({ directory: absent }), []);
  await assert.rejects(readdir(absent), { code: 'ENOENT' });
});

test(
  'watcher cancellation interrupts one chapter, persists cancellation, and explicit retry resumes it',
  { timeout: 5000 },
  async (t) => {
    const directory = await setup(t),
      fixture = source();
    fixture.setIds(['one']);
    const app = createDownloader({ source: 'test-web' }).use(fixture.extension);
    const shelf = await app.openShelf({ file: join(directory, 'shelf.db') });
    t.after(() => shelf.close());
    const entry = await shelf.add('work');
    await shelf.check();
    shelf.enqueue(entry.id, 'one');
    const controller = new AbortController(),
      events = [];
    await shelf
      .watch({
        signal: controller.signal,
        directory: join(directory, 'out'),
        onEvent(event) {
          events.push(event);
          if (event.task.state === 'reading') shelf.cancel(entry.id, 'one');
          if (event.task.state === 'cancelled') controller.abort();
        },
      })
      .catch((error) => {
        if (!controller.signal.aborted) throw error;
      });
    assert.equal(shelf.tasks()[0].state, 'cancelled');
    assert.deepEqual(await outputFiles(join(directory, 'out')), []);
    assert.doesNotMatch(JSON.stringify(events), /\.cbz|private\/|token=/);
    shelf.retry(entry.id, 'one');
    const resumed = new AbortController();
    await shelf
      .watch({
        signal: resumed.signal,
        directory: join(directory, 'out'),
        onTask() {
          assert.equal(shelf.tasks()[0].pagesDownloaded, 2);
          assert.equal(shelf.tasks()[0].totalPages, 2);
          resumed.abort();
        },
      })
      .catch((error) => {
        if (!resumed.signal.aborted) throw error;
      });
    assert.equal(shelf.tasks()[0].state, 'downloaded');
  },
);

test(
  'a cancelled and immediately retried task cannot accept the old run result',
  { timeout: 5000 },
  async (t) => {
    const directory = await setup(t),
      fixture = source();
    fixture.setIds(['one']);
    const app = createDownloader({ source: 'test-web' }).use(fixture.extension);
    const shelf = await app.openShelf({ file: join(directory, 'shelf.db') });
    t.after(() => shelf.close());
    const entry = await shelf.add('work');
    await shelf.check();
    shelf.enqueue(entry.id, 'one');
    const control = new AbortController();
    let changed = false;
    await shelf
      .watch({
        signal: control.signal,
        directory: join(directory, 'out'),
        onEvent(event) {
          if (event.task.state === 'archiving' && !changed) {
            changed = true;
            shelf.cancel(entry.id, 'one');
            shelf.retry(entry.id, 'one');
          }
          if (event.task.state === 'cancelled') control.abort();
        },
      })
      .catch((error) => {
        if (!control.signal.aborted) throw error;
      });
    assert.equal(shelf.tasks()[0].state, 'queued');
    assert.deepEqual(await outputFiles(join(directory, 'out')), []);
  },
);

test('missing queued chapters resume with automatic checks disabled, without a busy loop', async (t) => {
  const directory = await setup(t),
    fixture = source();
  fixture.setIds(['one']);
  const shelf = new Shelf(join(directory, 'shelf.db'));
  t.after(() => shelf.close());
  const registry = new SourceRegistry().use(fixture.extension);
  const signal = new AbortController().signal;
  const entry = await shelf.add(registry, 'test-web', 'work', { signal });
  shelf.setFollowing(entry.id, true);
  let now = 1000000;
  const cycle = () =>
    runShelfCycle(shelf.tracking, registry, shelf.tracking.due(now), {
      directory: join(directory, 'out'),
      signal,
      jobs: 1,
      now: () => now,
      onCheck() {},
      onTask() {},
    });
  await cycle();
  const lastCheck = shelf.tracking.status()[0].lastCheck;
  shelf.configure(entry.id, { autoCheck: false, autoDownload: false });
  shelf.tracking.enqueue(entry.id, 'one');
  fixture.setIds(['two']);
  await cycle();
  assert.deepEqual(shelf.tracking.due(now), []);
  assert.equal(shelf.tracking.nextDue(), now + 60000);
  fixture.setIds(['one', 'two']);
  now += 60000;
  await cycle();
  assert.equal(shelf.tracking.status()[0].complete, 1);
  assert.equal(shelf.tracking.status()[0].lastCheck, lastCheck);
});
