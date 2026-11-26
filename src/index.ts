import { parseArgs } from 'node:util';
import { downloadSeries } from './download.js';
import { sources } from './sources/index.js';

const usage = `Usage: node dist/index.js <command>
  sources
  list --fixture <directory>
  chapter --fixture <directory> --output <directory> [--chapter <id>] [--retries <n>]
  download --fixture <directory> --output <directory> [--jobs <n>] [--retries <n>]`;

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

function parseCommand(args: string[]) {
  const [command, ...rest] = args;
  if (!command || command === '--help' || command === '-h') {
    return { command: 'help' } as const;
  }
  if (command === 'sources') {
    const { values } = parseArgs({ args: rest, options: { help } });
    return values.help
      ? ({ command: 'help' } as const)
      : ({ command: 'sources' } as const);
  }
  if (command === 'list') {
    const { values } = parseArgs({ args: rest, options: { fixture, help } });
    if (values.help) {
      return { command: 'help' } as const;
    }
    if (!values.fixture) {
      throw new Error('list requires --fixture');
    }
    return { command, input: values.fixture } as const;
  }
  if (command !== 'chapter' && command !== 'download') {
    throw new Error(`Unknown command: ${command}`);
  }

  const { values } = parseArgs({
    args: rest,
    options: {
      fixture,
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
  if (!values.fixture || !values.output) {
    throw new Error(`${command} requires --fixture and --output`);
  }
  if (values.chapter === '') {
    throw new Error('--chapter requires a non-empty ID');
  }
  if (command === 'chapter' && values.jobs !== undefined) {
    throw new Error('--jobs is only supported by download');
  }
  if (command === 'download' && values.chapter !== undefined) {
    throw new Error('--chapter is only supported by chapter');
  }
  return {
    command,
    input: values.fixture,
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
  if (args.command === 'sources') {
    for (const { id } of Object.values(sources)) {
      console.log(id);
    }
    return 0;
  }

  const source = sources.fixture;
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

  const counts = { downloaded: 0, skipped: 0, failed: 0 };
  await downloadSeries(source.id, selected, {
    directory: args.directory,
    jobs: args.jobs,
    retries: args.retries,
    signal,
    onResult(result) {
      counts[result.status]++;
      if (result.status === 'failed') {
        console.error(
          `Failed: chapter ${result.chapterId} (attempts: ${result.attempts}): ${result.error}`,
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
      counts.failed;
    console.log(
      `Summary: ${counts.downloaded} downloaded, ${counts.skipped} skipped, ${counts.failed} failed, ${remaining} cancelled`,
    );
  }
  return counts.failed ? 1 : 0;
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
