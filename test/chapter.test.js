import {
  Uint8ArrayReader,
  Uint8ArrayWriter,
  ZipReader,
  ZipWriter,
} from '@zip.js/zip.js';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { outputFiles as readdir } from './helpers/output.js';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execPath } from 'node:process';
import { test } from 'node:test';
import { fileURLToPath, URL } from 'node:url';
import { promisify } from 'node:util';

const run = promisify(execFile);
const cli = fileURLToPath(new URL('../dist/index.js', import.meta.url));
const firstPage = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64',
);
const secondPage = Buffer.from(firstPage);
secondPage[13] = 128; // Change the first palette color.

async function makeFixture(t) {
  const directory = await mkdtemp(join(tmpdir(), 'comic-dl-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));

  const output = join(directory, 'output');
  const secondPath = join(directory, 'a.gif');
  const manifest = {
    workId: 'demo',
    chapterId: '1',
    pages: ['z.gif', 'a.gif'],
  };
  const writeManifest = () =>
    writeFile(join(directory, 'chapter.json'), JSON.stringify(manifest));
  await writeManifest();
  await writeFile(join(directory, 'z.gif'), firstPage);

  return {
    output,
    secondPath,
    manifest,
    writeManifest,
    download: () =>
      run(execPath, [
        cli,
        'chapter',
        '--fixture',
        directory,
        '--output',
        output,
      ]),
  };
}

async function assertPages(archivePath, expected) {
  const reader = new ZipReader(
    new Uint8ArrayReader(await readFile(archivePath)),
    { useWebWorkers: false },
  );
  try {
    const entries = await reader.getEntries();
    assert.deepEqual(
      entries.map(({ filename }) => filename),
      ['1.gif', '2.gif'],
    );
    for (const [index, entry] of entries.entries()) {
      assert.equal(entry.directory, false);
      const bytes = await entry.getData(new Uint8ArrayWriter(), {
        checkSignature: true,
      });
      assert.deepEqual(Buffer.from(bytes), expected[index]);
    }
  } finally {
    await reader.close();
  }
}

test('missing page fails cleanly; rerun writes an ordered CBZ and then skips it', async (t) => {
  const { download, output, secondPath } = await makeFixture(t);

  await assert.rejects(download(), {
    code: 1,
    stdout: '',
    stderr: /Page 2:.*ENOENT.*a\.gif/,
  });
  assert.deepEqual(await readdir(output), []);

  await writeFile(secondPath, secondPage);
  const [result, concurrent] = await Promise.all([download(), download()]);
  assert.match(`${result.stdout}${concurrent.stdout}`, /^Downloaded: /m);
  const files = await readdir(output);
  assert.equal(files.length, 1);
  assert.match(files[0], /\.cbz$/);
  const archivePath = join(output, files[0]);
  await assertPages(archivePath, [firstPage, secondPage]);

  await rm(secondPath);
  const skipped = await download();
  assert.equal(skipped.stdout.trimEnd(), `Skipped: ${archivePath}`);
  await assertPages(archivePath, [firstPage, secondPage]);
});

test('rebuilds a corrupt archive and detects a changed page order', async (t) => {
  const { download, output, secondPath, manifest, writeManifest } =
    await makeFixture(t);
  await writeFile(secondPath, secondPage);
  await download();
  const [filename] = await readdir(output);
  let archivePath = join(output, filename);
  const damaged = await readFile(archivePath);
  const offset = damaged.indexOf(firstPage);
  assert.notEqual(offset, -1);
  damaged[offset] ^= 1;
  await writeFile(archivePath, damaged);
  archivePath = (await download()).stdout.trim().slice('Downloaded: '.length);
  await assertPages(archivePath, [firstPage, secondPage]);

  manifest.pages.reverse();
  await writeManifest();
  archivePath = (await download()).stdout.trim().slice('Downloaded: '.length);
  await assertPages(archivePath, [secondPage, firstPage]);
});

test('a complete CBZ from another chapter is not skipped', async (t) => {
  const { download, output, secondPath, manifest, writeManifest } =
    await makeFixture(t);
  await writeFile(secondPath, secondPage);
  await download();
  const [firstFilename] = await readdir(output);
  const firstArchive = await readFile(join(output, firstFilename));

  manifest.chapterId = '2';
  await writeManifest();
  await download();
  const secondFilename = (await readdir(output)).find(
    (filename) => filename !== firstFilename,
  );
  assert.ok(secondFilename);
  await writeFile(join(output, secondFilename), firstArchive);

  assert.match((await download()).stdout, /^Downloaded: /);
  assert.match((await download()).stdout, /^Skipped: /);
});

test('a same-named legacy CBZ without the identity marker is not skipped', async (t) => {
  const { download, output, secondPath } = await makeFixture(t);
  await writeFile(secondPath, secondPage);
  await download();
  const [filename] = await readdir(output);
  const archivePath = join(output, filename);

  const writer = new ZipWriter(new Uint8ArrayWriter(), {
    useWebWorkers: false,
  });
  await writer.add('1.gif', new Uint8ArrayReader(firstPage));
  await writer.add('2.gif', new Uint8ArrayReader(secondPage));
  await writeFile(archivePath, await writer.close());
  await assertPages(archivePath, [firstPage, secondPage]);

  assert.match((await download()).stdout, /^Downloaded: /);
  assert.match((await download()).stdout, /^Skipped: /);
});
