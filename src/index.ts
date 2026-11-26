#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { nonempty, readConfig } from './config.js';
import { downloadSeries } from './download.js';
import { isSourceId, loadSources } from './sources/index.js';

const usage = `Usage: comic-dl <command> [options]

Commands:
  sources                   List available source IDs
  search [query]            Search or browse a source
  list <series-input>       List chapter IDs and titles
  chapter <chapter-input>   Download one chapter by its direct link
  download <series-input>   Download all or selected chapters of a series

Run comic-dl <command> --help for command options.
  -h, --help       Show help
  -V, --version    Show the installed version`;

const commandHelp = {
  sources: `Usage: comic-dl sources [options]

List the built-in source and explicitly loaded extensions.`,
  search: `Usage: comic-dl search [query] [options]

Omit query to browse the catalog. Requires --source <id> unless set in config.
  --page <n>          Results page (default: 1)`,
  list: `Usage: comic-dl list <series-input> [options]
       comic-dl list --fixture <directory> [options]

Print each chapter ID and title. Use --source <id> or set a source in config.`,
  chapter: `Usage: comic-dl chapter <chapter-input> [options]
       comic-dl chapter --fixture <directory> [--chapter <id>] [options]

Download one chapter by direct input. Use --source <id> or set a source in config.
  --output <dir>      Required output directory (may come from config)
  --retries <n>       Additional attempts for transient failures (default: 2)

With a series input, use download --chapter <id> instead.`,
  download: `Usage: comic-dl download <series-input> [options]
       comic-dl download --fixture <directory> [options]

Download a series. Use --source <id> or set a source in config.
  --output <dir>      Required output directory (may come from config)
  --chapter <id>      Select an ID printed by list; repeat to select multiple chapters
  --jobs <n>          Maximum concurrent chapters (default: 2)
  --retries <n>       Additional attempts for transient failures (default: 2)`,
};

const commonHelp = `
  --config <file>     Read defaults from an explicit JSON config file
  --extension <name>  Load an installed package or local ESM file; repeat to load more
  -h, --help          Show this help`;

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
const commonOptions = { help, extension, config: { type: 'string' } } as const;

function parseInput(
  values: { fixture?: string; source?: string },
  positionals: string[],
  defaultSource?: string,
) {
  if (values.fixture !== undefined) {
    if (
      !nonempty(values.fixture) ||
      values.source !== undefined ||
      positionals.length
    ) {
      throw new Error(
        '--fixture requires a directory and cannot be combined with --source or a positional input',
      );
    }
    return { sourceId: 'fixture', input: values.fixture };
  }
  if (positionals.length !== 1 || !nonempty(positionals[0])) {
    throw new Error('Provide exactly one positional input');
  }
  return {
    sourceId: requireSource(values.source ?? defaultSource),
    input: positionals[0],
  };
}

function requireSource(id: string | undefined) {
  if (!isSourceId(id)) {
    throw new Error('Provide --source <id> or set "source" in config');
  }
  return id;
}

async function parseCommand(args: string[], signal: AbortSignal) {
  const [command, ...rest] = args;
  if (
    !command ||
    ((command === '--help' || command === '-h') && !rest.length)
  ) {
    return { command: 'help', text: usage } as const;
  }
  if ((command === '--version' || command === '-V') && !rest.length) {
    return { command: 'version' } as const;
  }
  if (command === 'sources') {
    const { values } = parseArgs({ args: rest, options: commonOptions });
    if (values.help) {
      return {
        command: 'help',
        text: commandHelp.sources + commonHelp,
      } as const;
    }
    const config = await readConfig(values.config, signal);
    return {
      command,
      extensions: values.extension ?? config.extensions ?? [],
    } as const;
  }
  if (command === 'search') {
    const { values, positionals } = parseArgs({
      args: rest,
      options: {
        ...commonOptions,
        source,
        page: { type: 'string' },
      },
      allowPositionals: true,
    });
    if (values.help) {
      return {
        command: 'help',
        text: commandHelp.search + commonHelp,
      } as const;
    }
    if (positionals.length > 1) {
      throw new Error('search accepts at most one query argument');
    }
    const config = await readConfig(values.config, signal);
    return {
      command,
      sourceId: requireSource(values.source ?? config.source),
      extensions: values.extension ?? config.extensions ?? [],
      query: positionals[0] ?? '',
      page: integer('page', values.page ?? '1', 1),
    } as const;
  }
  if (command === 'list') {
    const { values, positionals } = parseArgs({
      args: rest,
      options: { ...commonOptions, fixture, source },
      allowPositionals: true,
    });
    if (values.help) {
      return { command: 'help', text: commandHelp.list + commonHelp } as const;
    }
    const config = await readConfig(values.config, signal);
    return {
      command,
      extensions: values.extension ?? config.extensions ?? [],
      ...parseInput(values, positionals, config.source),
    } as const;
  }
  if (command !== 'chapter' && command !== 'download') {
    throw new Error(
      'Unknown command. Run comic-dl --help for available commands.',
    );
  }

  const { values, positionals } = parseArgs({
    args: rest,
    allowPositionals: true,
    options: {
      ...commonOptions,
      fixture,
      source,
      output: { type: 'string' },
      retries: { type: 'string' },
      chapter: { type: 'string', multiple: true },
      ...(command === 'download' ? { jobs: { type: 'string' } as const } : {}),
    },
  });
  if (values.help) {
    return {
      command: 'help',
      text: commandHelp[command] + commonHelp,
    } as const;
  }
  const config = await readConfig(values.config, signal);
  const directory = values.output ?? config.output;
  if (!nonempty(directory)) {
    throw new Error(
      `${command} requires --output <directory> or "output" in config`,
    );
  }
  const chapterIds = values.chapter ?? [];
  if (!chapterIds.every(nonempty)) {
    throw new Error('--chapter requires a non-empty ID');
  }
  if (
    command === 'chapter' &&
    chapterIds.length &&
    (values.fixture === undefined || chapterIds.length > 1)
  ) {
    throw new Error(
      'Use download --chapter <id> to select chapters from a series',
    );
  }
  return {
    command,
    extensions: values.extension ?? config.extensions ?? [],
    ...parseInput(values, positionals, config.source),
    chapterIds,
    directory,
    jobs:
      command === 'chapter'
        ? 1
        : typeof values.jobs === 'string'
          ? integer('jobs', values.jobs, 1)
          : (config.jobs ?? 2),
    retries:
      values.retries === undefined
        ? (config.retries ?? 2)
        : integer('retries', values.retries, 0),
  } as const;
}

async function run(
  args: Awaited<ReturnType<typeof parseCommand>>,
  signal: AbortSignal,
) {
  if (args.command === 'help') {
    console.log(args.text);
    return 0;
  }
  if (args.command === 'version') {
    const { version } = JSON.parse(
      await readFile(new URL('../package.json', import.meta.url), {
        encoding: 'utf8',
        signal,
      }),
    ) as { version: string };
    console.log(version);
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
  const series = await (args.command === 'chapter' && !args.chapterIds.length
    ? source.getChapter(args.input, signal).then(({ workId, chapter }) => ({
        id: workId,
        chapters: [chapter],
      }))
    : source.getSeries(args.input, signal));
  let selected = series;
  if (args.chapterIds.length) {
    const requested = new Set(args.chapterIds);
    const chapters = series.chapters.filter(({ id }) => requested.delete(id));
    if (requested.size) {
      logError(
        new Error(
          `Unknown chapter ID(s): ${[...requested].map((id) => JSON.stringify(id)).join(', ')}. Run comic-dl list to see valid IDs.`,
        ),
      );
      return 2;
    }
    selected = { ...series, chapters };
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
  const controller = new AbortController();
  const interrupt = () => controller.abort();
  process.on('SIGINT', interrupt);
  try {
    let args;
    try {
      args = await parseCommand(process.argv.slice(2), controller.signal);
    } catch (error) {
      controller.signal.throwIfAborted();
      logError(error);
      if (
        error instanceof TypeError &&
        'code' in error &&
        error.code === 'ERR_PARSE_ARGS_UNKNOWN_OPTION'
      ) {
        console.error('Run comic-dl <command> --help for supported options.');
      }
      return 2;
    }
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
