#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { downloadSeries } from './download.js';
import { loadSources } from './sources/index.js';

const usage = `Usage: node dist/index.js <command>
  sources [--extension <module>]
  search --extension <module> --source <id> [keyword] [--page <n>]
  list --fixture <directory>
  list --extension <module> --source <id> <series-input>
  chapter --fixture <directory> --output <directory> [--chapter <id>] [--retries <n>]
  chapter --extension <module> --source <id> <chapter-input> --output <directory> [--retries <n>]
  download --fixture <directory> --output <directory> [--jobs <n>] [--retries <n>]
  download --extension <module> --source <id> <series-input> --output <directory> [--jobs <n>] [--retries <n>]

Repeat --extension to load multiple installed packages or local ESM files.`;

function integer(name: string, value: string, minimum: number) {
  const number = Number(value);
  if (
    !/^\d+$/.test(value) ||
    !Number.isSafeInteger(number) ||
    number < minimum
  ) {
    throw new Error(`--${name} requires an integer >= ${minimum}`);
  }
  return number;
}

const help = { type: 'boolean', short: 'h' } as const;
const fixture = { type: 'string' } as const;
const source = { type: 'string' } as const;
const extension = { type: 'string', multiple: true } as const;

function parseInput(
  values: { fixture?: string; source?: string },
  positionals: string[],
) {
  if (values.fixture && values.source === undefined && !positionals.length) {
    return { sourceId: 'fixture', input: values.fixture } as const;
  }
  if (
    values.fixture === undefined &&
    values.source &&
    positionals.length === 1 &&
    positionals[0]
  ) {
    return { sourceId: values.source, input: positionals[0] } as const;
  }
  throw new Error('Provide --fixture <directory> or --source <id> <input>');
}

function parseCommand(args: string[]) {
  const [command, ...rest] = args;
  if (!command || command === '--help' || command === '-h') {
    return { command: 'help' } as const;
  }
  if (command === 'sources') {
    const { values } = parseArgs({ args: rest, options: { help, extension } });
    return values.help
      ? ({ command: 'help' } as const)
      : ({ command: 'sources', extensions: values.extension ?? [] } as const);
  }
  if (command === 'search') {
    const { values, positionals } = parseArgs({
      args: rest,
      options: {
        source,
        extension,
        help,
        page: { type: 'string', default: '1' },
      },
      allowPositionals: true,
    });
    if (values.help) {
      return { command: 'help' } as const;
    }
    if (!values.source || positionals.length > 1) {
      throw new Error(
        'search requires --source <id> and accepts one keyword argument',
      );
    }
    return {
      command,
      sourceId: values.source,
      extensions: values.extension ?? [],
      query: positionals[0] ?? '',
      page: integer('page', values.page, 1),
    } as const;
  }
  if (command === 'list') {
    const { values, positionals } = parseArgs({
      args: rest,
      options: { fixture, source, extension, help },
      allowPositionals: true,
    });
    if (values.help) {
      return { command: 'help' } as const;
    }
    return {
      command,
      extensions: values.extension ?? [],
      ...parseInput(values, positionals),
    } as const;
  }
  if (command !== 'chapter' && command !== 'download') {
    throw new Error(`Unknown command: ${command}`);
  }

  const { values, positionals } = parseArgs({
    args: rest,
    allowPositionals: true,
    options: {
      fixture,
      source,
      extension,
      help,
      output: { type: 'string' },
      retries: { type: 'string', default: '2' },
      chapter: { type: 'string' },
      jobs: { type: 'string' },
    },
  });
  if (values.help) {
    return { command: 'help' } as const;
  }
  if (!values.output) {
    throw new Error(`${command} requires --output`);
  }
  if (values.chapter === '') {
    throw new Error('--chapter requires a non-empty ID');
  }
  if (command === 'chapter' && values.jobs !== undefined) {
    throw new Error('--jobs is only supported by download');
  }
  if (
    (command !== 'chapter' || values.fixture === undefined) &&
    values.chapter !== undefined
  ) {
    throw new Error('--chapter is only supported by chapter with --fixture');
  }
  return {
    command,
    extensions: values.extension ?? [],
    ...parseInput(values, positionals),
    chapterId: values.chapter,
    directory: values.output,
    jobs: command === 'chapter' ? 1 : integer('jobs', values.jobs ?? '2', 1),
    retries: integer('retries', values.retries, 0),
  } as const;
}

async function run(args: ReturnType<typeof parseCommand>, signal: AbortSignal) {
  if (args.command === 'help') {
    console.log(usage);
    return 0;
  }
  const sources = await loadSources(args.extensions, signal);
  if (args.command === 'sources') {
    for (const id of sources.keys()) {
      console.log(id);
    }
    return 0;
  }

  const create = sources.get(args.sourceId);
  if (!create) {
    throw new Error(
      `Unknown source: ${args.sourceId}. Load it with --extension.`,
    );
  }
  const source = create();
  if (args.command === 'search') {
    if (!source.search) {
      throw new Error(`Source ${source.id} does not support search`);
    }
    const { results, hasNext } = await source.search(
      args.query,
      args.page,
      signal,
    );
    for (const { title, url } of results) {
      console.log(`${url}\t${title}`);
    }
    if (hasNext) {
      console.error(`Next page: ${args.page + 1}`);
    }
    return 0;
  }
  if (args.command === 'list') {
    const series = await source.getSeries(args.input, signal);
    for (const { id, title } of series.chapters) {
      console.log(`${id}\t${title}`);
    }
    return 0;
  }
  const series = await (args.command === 'chapter' &&
  args.chapterId === undefined
    ? source.getChapter(args.input, signal).then(({ workId, chapter }) => ({
        id: workId,
        chapters: [chapter],
      }))
    : source.getSeries(args.input, signal));
  let selected = series;
  if (args.chapterId !== undefined) {
    const chapter = series.chapters.find(({ id }) => id === args.chapterId);
    if (!chapter) {
      throw new Error(`Unknown chapter ID: ${args.chapterId}`);
    }
    selected = { ...series, chapters: [chapter] };
  }

  const counts = { downloaded: 0, skipped: 0, failed: 0, restricted: 0 };
  await downloadSeries(source.id, selected, {
    directory: args.directory,
    jobs: args.jobs,
    retries: args.retries,
    signal,
    onResult(result) {
      counts[result.status]++;
      if ('error' in result) {
        const label = result.status === 'restricted' ? 'Restricted' : 'Failed';
        console.error(
          `${label}: chapter ${result.chapterId} (attempts: ${result.attempts}): ${result.error}`,
        );
      } else {
        const status = result.status === 'skipped' ? 'Skipped' : 'Downloaded';
        console.log(`${status}: ${result.path}`);
      }
    },
  });
  if (args.command === 'download') {
    const remaining =
      selected.chapters.length -
      counts.downloaded -
      counts.skipped -
      counts.restricted -
      counts.failed;
    const restricted =
      source.id !== 'fixture' ? `, ${counts.restricted} restricted` : '';
    console.log(
      `Summary: ${counts.downloaded} downloaded, ${counts.skipped} skipped${restricted}, ${counts.failed} failed, ${remaining} cancelled`,
    );
  }
  return counts.failed ||
    (counts.restricted && !counts.downloaded && !counts.skipped)
    ? 1
    : 0;
}

function logError(error: unknown) {
  console.error(
    `comic-dl: ${error instanceof Error ? error.message : String(error)}`,
  );
}

async function main() {
  let args;
  try {
    args = parseCommand(process.argv.slice(2));
  } catch (error) {
    logError(error);
    return 2;
  }

  const controller = new AbortController();
  const interrupt = () => controller.abort();
  process.on('SIGINT', interrupt);
  try {
    const code = await run(args, controller.signal);
    return controller.signal.aborted ? 130 : code;
  } catch (error) {
    if (controller.signal.aborted) {
      return 130;
    }
    logError(error);
    return 1;
  } finally {
    process.off('SIGINT', interrupt);
  }
}

process.exitCode = await main();
