#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import {
  isOutputMarker,
  nonempty,
  outputPath,
  readConfig,
  sourceOverrides,
  userDataDirectory,
} from './config.js';
import type { CliConfig } from './config.js';
import {
  defaultJobs,
  defaultRetries,
  downloadSeries,
  resolveDownloadSeries,
  retrySourceRead,
  selectChapters,
} from './download.js';
import {
  extensionPackage,
  manageExtensions,
  withExtensions,
} from './extension-store.js';
import type { CheckEvent, ShelfEntry, TaskEvent } from './shelf-types.js';
import type { Shelf } from './shelf.js';
import { fixtureExtension } from './sources/fixture.js';
import { isSourceId, SourceRegistry } from './sources/index.js';
import {
  assignment,
  isOptionKey,
  SourceOptionError,
} from './source-options.js';
import type { SettingsBySource } from './source-options.js';

const aliases = new Map([
  ['src', 'sources'],
  ['s', 'search'],
  ['l', 'list'],
  ['c', 'chapter'],
  ['d', 'download'],
  ['a', 'add'],
  ['u', 'update'],
  ['rm', 'remove'],
]);

const usage = `Usage: comic-dl <command> [options]

Commands:
  sources (src)              List available source IDs
  search (s) [query]         Search or browse a source
  list (l) <series-input>    List chapter IDs and titles
  chapter (c) <chapter-input> Download one chapter by its direct link
  download (d) <series-input> Download all or selected chapters of a series
  shelf <action>             Save works from multiple sources and manage subscriptions
  add (a) <package>           Install an npm source extension
  update (u) [package]       Update one or all managed extensions
  remove (rm) <package>      Uninstall a managed extension

Run comic-dl <command> --help for command options.
  -h, --help       Show help
  -V, --version    Show the installed version`;

const commandHelp = {
  add: `Usage: comic-dl add <package>[@version-or-tag]

Install a published npm extension into the managed extension directory.`,
  update: `Usage: comic-dl update [package]

Update one or all installed extensions within their saved npm version ranges.`,
  remove: `Usage: comic-dl remove <package>

Uninstall a managed npm extension by package name.`,
  sources: `Usage: comic-dl sources [options]

List available source IDs. Use --source <id> --options to show the source settings as JSON.`,
  search: `Usage: comic-dl search [query] [options]

Omit query to browse the catalog. Requires --source <id> unless set in config.
  --page <n>          Results page (default: 1)
  --sort <id>         Select a source-defined sort
  --filter <key=value> Set a source-defined filter; repeat for different keys
  --options           Show sorts, filters and choices for this mode as JSON`,
  list: `Usage: comic-dl list <series-input> [options]
       comic-dl list --fixture <directory> [options]

Print each chapter ID and title. Full URLs can select the source automatically.
  --source <id>      Select a source explicitly`,
  chapter: `Usage: comic-dl chapter <chapter-input> [options]
       comic-dl chapter --fixture <directory> [--chapter <id>] [options]

Download one chapter by direct input. Full URLs can select the source automatically.
  --source <id>      Select a source explicitly
  -o, --output <dir>  Required output directory (may come from config)
  -c, --chapter <id>  Select one ID with --fixture
  --retries <n>       Additional attempts for transient failures (default: 2)

With a series input, use download --chapter <id> instead.`,
  download: `Usage: comic-dl download <series-input> [options]
       comic-dl download --fixture <directory> [options]

Download a series. Full URLs can select the source automatically.
  --source <id>      Select a source explicitly
  -o, --output <dir>  Output directory (default: current directory)
  -c, --chapter <selection>
                     Chapter ID or inclusive 1-based range (e.g. 2-4); repeat to combine
  --jobs <n>          Maximum concurrent chapters (default: 2)
  --retries <n>       Additional attempts for transient failures (default: 2)`,
  shelf: `Usage: comic-dl shelf <action> [options]

  add <series-input>          Add a work; accepts --source <id> and --title <title>
  list                        List entry IDs, sources, subscription states and titles
  set-input <id> <input>      Change the input for the same source and work
  follow <id>                 Subscribe to a saved work
  unfollow <id>               Unsubscribe while keeping the work on the shelf
  remove <id>                 Remove a work without deleting its downloads
  check [id]                  Check subscriptions and queue new chapters, without downloading
  status [id]                 Show check and download status offline
  watch                       Check regularly and download queued chapters (foreground)
  retry <id> <chapter-id>     Requeue a failed or restricted chapter

  --shelf-db <file>           Use a separate local SQLite database (default: shelf.sqlite in user data)
  --include-history           Queue existing chapters when checking one specific subscription
  -o, --output <dir>          Required for watch (may come from config)
  --require-output-marker <name>
                               Defer downloading unless this file exists in the output directory
  --interval <seconds>        Watch check interval (default: 3600)
  --jobs <n>                  Watch download concurrency (default: 2; may come from config)

The add, set-input, check and watch actions accept source configuration options:`,
};

const commonHelp = `
  --config <file>     Read defaults from an explicit JSON config file
  --extension <name>  Load an installed package or local ESM file; repeat to load more
  --set <id.key=value> Override a non-secret source setting for this run; repeat for more
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
const commonOptions = {
  help,
  extension,
  config: { type: 'string' },
  set: { type: 'string', multiple: true },
} as const;

function sourceArguments(
  values: { extension?: string[]; set?: string[] },
  config: CliConfig,
) {
  return {
    extensions: values.extension ?? config.extensions ?? [],
    sourceSettings: config.sourceSettings,
    overrides: sourceOverrides(values.set),
  };
}

function searchFilters(inputs: readonly string[] = []) {
  const filters = new Map<string, string>();
  for (const input of inputs) {
    const [key, value] = assignment(input, '--filter');
    if (!isOptionKey(key) || filters.has(key)) {
      throw new Error(
        '--filter requires a distinct filter key for each assignment',
      );
    }
    filters.set(key, value);
  }
  return Object.fromEntries(filters);
}

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
  const input = positionals[0];
  const sourceId = values.source ?? defaultSource;
  if (
    sourceId === undefined &&
    /^https?:\/\//i.test(input) &&
    URL.canParse(input)
  ) {
    return { sourceId, input };
  }
  return { sourceId: requireSource(sourceId), input };
}

function requireSource(id: string | undefined) {
  if (!isSourceId(id)) {
    throw new Error('Provide --source <id> or set "source" in config');
  }
  return id;
}

async function parseShelfCommand(args: string[], signal: AbortSignal) {
  const [action, ...rest] = args;
  if (!action || action === '--help' || action === '-h') {
    return { command: 'help', text: commandHelp.shelf + commonHelp } as const;
  }
  if (
    action !== 'add' &&
    action !== 'list' &&
    action !== 'set-input' &&
    action !== 'follow' &&
    action !== 'unfollow' &&
    action !== 'remove' &&
    action !== 'check' &&
    action !== 'status' &&
    action !== 'watch' &&
    action !== 'retry'
  ) {
    throw new Error('Unknown shelf action. Run comic-dl shelf --help.');
  }

  const { values, positionals } = parseArgs({
    args: rest,
    options: {
      ...commonOptions,
      'shelf-db': { type: 'string' },
      source,
      title: { type: 'string' },
      'include-history': { type: 'boolean' },
      output: { type: 'string', short: 'o' },
      'require-output-marker': { type: 'string' },
      interval: { type: 'string' },
      jobs: { type: 'string' },
    },
    allowPositionals: true,
  });
  if (values.help) {
    return { command: 'help', text: commandHelp.shelf + commonHelp } as const;
  }
  if (
    action !== 'add' &&
    (values.source !== undefined || values.title !== undefined)
  ) {
    throw new Error('--source and --title are only accepted by shelf add');
  }
  if (
    action !== 'watch' &&
    (values.output !== undefined ||
      values['require-output-marker'] !== undefined ||
      values.interval !== undefined ||
      values.jobs !== undefined)
  ) {
    throw new Error(
      '--output, --require-output-marker, --interval and --jobs require shelf watch',
    );
  }
  if (
    values['include-history'] &&
    (action !== 'check' || positionals.length !== 1)
  ) {
    throw new Error('--include-history requires shelf check and one entry ID');
  }
  const optionalId = action === 'check' || action === 'status';
  const count =
    action === 'set-input' || action === 'retry'
      ? 2
      : action === 'list' || action === 'watch'
        ? 0
        : 1;
  if (
    (optionalId ? positionals.length > 1 : positionals.length !== count) ||
    !positionals.every(nonempty)
  ) {
    throw new Error(
      optionalId
        ? `shelf ${action} accepts at most one entry ID.`
        : `shelf ${action} requires ${count} positional argument(s).`,
    );
  }
  const dbOption = values['shelf-db'];
  if (dbOption !== undefined && !nonempty(dbOption)) {
    throw new Error('--shelf-db requires a file path');
  }
  const file = dbOption
    ? outputPath(dbOption)
    : join(userDataDirectory(), 'shelf.sqlite');
  const command = 'shelf' as const;
  const [id, input] = positionals;
  if (
    action !== 'add' &&
    action !== 'set-input' &&
    action !== 'check' &&
    action !== 'watch'
  ) {
    if (
      values.config !== undefined ||
      values.extension !== undefined ||
      values.set !== undefined
    ) {
      throw new Error(
        '--config, --extension and --set require shelf add, set-input, check or watch',
      );
    }
    return { command, action, file, id, input } as const;
  }

  const config = await readConfig(values.config, signal);
  const sourceArgs = sourceArguments(values, config);
  const retries = config.retries;
  if (action === 'check') {
    return {
      command,
      action,
      file,
      id,
      ...sourceArgs,
      retries,
      includeHistory: values['include-history'],
    } as const;
  }
  if (action === 'watch') {
    const directory = values.output ?? config.output;
    if (!nonempty(directory))
      throw new Error(
        'shelf watch requires --output <directory> or "output" in config',
      );
    const outputMarker = values['require-output-marker'];
    if (outputMarker !== undefined && !isOutputMarker(outputMarker)) {
      throw new Error(
        '--require-output-marker requires a filename inside the output directory',
      );
    }
    const seconds = integer('interval', values.interval ?? '3600', 1);
    if (seconds > 365 * 24 * 3600)
      throw new Error('--interval must not exceed 365 days');
    return {
      command,
      action,
      file,
      ...sourceArgs,
      retries,
      directory: outputPath(directory),
      outputMarker,
      interval: seconds * 1000,
      jobs:
        values.jobs === undefined
          ? (config.jobs ?? defaultJobs)
          : integer('jobs', values.jobs, 1),
    } as const;
  }
  if (action === 'set-input') {
    return {
      command,
      action,
      file,
      id,
      input,
      ...sourceArgs,
      retries,
    } as const;
  }
  if (values.title !== undefined && !nonempty(values.title)) {
    throw new Error('--title requires a non-empty title');
  }
  return {
    command,
    action,
    file,
    ...sourceArgs,
    retries,
    title: values.title,
    ...parseInput(values, positionals, config.source),
  } as const;
}

async function parseCommand(args: string[], signal: AbortSignal) {
  const [name, ...rest] = args;
  const command = aliases.get(name) ?? name;
  if (
    !command ||
    ((command === '--help' || command === '-h') && !rest.length)
  ) {
    return { command: 'help', text: usage } as const;
  }
  if ((command === '--version' || command === '-V') && !rest.length) {
    return { command: 'version' } as const;
  }
  if (command === 'shelf') {
    return parseShelfCommand(rest, signal);
  }
  if (command === 'add' || command === 'update' || command === 'remove') {
    const { values, positionals } = parseArgs({
      args: rest,
      options: { help },
      allowPositionals: true,
    });
    if (values.help)
      return { command: 'help', text: commandHelp[command] } as const;
    if (positionals.length > 1)
      throw new Error(`${command} accepts at most one package`);
    extensionPackage(command, positionals[0]);
    return {
      command: 'manage',
      action: command,
      package: positionals[0],
    } as const;
  }
  if (command === 'sources') {
    const { values } = parseArgs({
      args: rest,
      options: { ...commonOptions, source, options: { type: 'boolean' } },
    });
    if (values.help) {
      return {
        command: 'help',
        text: commandHelp.sources + commonHelp,
      } as const;
    }
    const config = await readConfig(values.config, signal);
    if (values.source !== undefined && !values.options) {
      throw new Error('sources --source requires --options');
    }
    return {
      command,
      ...sourceArguments(values, config),
      settingsSource: values.options
        ? requireSource(values.source ?? config.source)
        : undefined,
    } as const;
  }
  if (command === 'search') {
    const { values, positionals } = parseArgs({
      args: rest,
      options: {
        ...commonOptions,
        source,
        page: { type: 'string' },
        sort: { type: 'string' },
        filter: { type: 'string', multiple: true },
        options: { type: 'boolean' },
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
    if (
      values.options &&
      (values.sort !== undefined ||
        values.filter !== undefined ||
        values.page !== undefined)
    ) {
      throw new Error(
        '--options cannot be combined with --sort, --filter or --page',
      );
    }
    const config = await readConfig(values.config, signal);
    return {
      command,
      sourceId: requireSource(values.source ?? config.source),
      ...sourceArguments(values, config),
      query: positionals[0] ?? '',
      page: integer('page', values.page ?? '1', 1),
      showOptions: values.options,
      sort: values.sort,
      filters: searchFilters(values.filter),
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
      ...sourceArguments(values, config),
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
      output: { type: 'string', short: 'o' },
      retries: { type: 'string' },
      chapter: { type: 'string', multiple: true, short: 'c' },
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
  const directory =
    values.output ??
    config.output ??
    (command === 'download' ? '.' : undefined);
  if (!nonempty(directory)) {
    throw new Error(
      directory === undefined
        ? 'chapter requires --output <directory> or "output" in config'
        : '--output requires a non-empty directory',
    );
  }
  const selections = values.chapter ?? [];
  if (!selections.every(nonempty)) {
    throw new Error('--chapter requires a non-empty selection');
  }
  if (
    command === 'chapter' &&
    selections.length &&
    (values.fixture === undefined || selections.length > 1)
  ) {
    throw new Error(
      'Use download --chapter <id> to select chapters from a series',
    );
  }
  return {
    command,
    ...sourceArguments(values, config),
    ...parseInput(values, positionals, config.source),
    selections,
    directory: outputPath(directory),
    jobs:
      command === 'chapter'
        ? 1
        : typeof values.jobs === 'string'
          ? integer('jobs', values.jobs, 1)
          : (config.jobs ?? defaultJobs),
    retries:
      values.retries === undefined
        ? (config.retries ?? defaultRetries)
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
  if (args.command === 'manage') {
    const result = await manageExtensions(args.action, args.package, {
      signal,
      stdio: 'inherit',
    });
    if (!result.changed) console.log('No extensions installed.');
    else if (result.action === 'remove')
      console.log(`Removed ${result.package}`);
    else console.log(`Installed extensions: ${result.installed.join(', ')}`);
    return 0;
  }
  if (args.command === 'shelf') {
    return runShelfCommand(args, signal);
  }
  const sources = builtinSources(args);
  return withExtensions(sources, args.extensions, signal, () => {
    sources.validateOverrides();
    return runSourceCommand(args, sources, signal);
  });
}

function builtinSources(args: {
  sourceSettings?: SettingsBySource;
  overrides: SettingsBySource;
}) {
  return new SourceRegistry(args.sourceSettings, args.overrides).use(
    fixtureExtension,
  );
}

function printShelfEntry(entry: ShelfEntry) {
  const title = entry.title.replace(/\p{Cc}/gu, ' ');
  const state = entry.following ? 'following' : 'not-following';
  console.log(`${entry.id}\t${entry.sourceId}\t${state}\t${title}`);
}

async function runShelfCommand(
  args: Extract<
    Awaited<ReturnType<typeof parseShelfCommand>>,
    { command: 'shelf' }
  >,
  signal: AbortSignal,
) {
  const { Shelf } = await import('./shelf.js');
  signal.throwIfAborted();
  const shelf = new Shelf(args.file);
  try {
    if (args.action === 'check' || args.action === 'watch') {
      const { checkSubscriptions, watchShelf } =
        await import('./shelf-updates.js');
      const withSources = <T>(run: (sources: SourceRegistry) => Promise<T>) => {
        const sources = builtinSources(args);
        return withExtensions(
          sources,
          args.extensions,
          signal,
          () => {
            sources.validateOverrides();
            return run(sources);
          },
          () =>
            logError(
              'Could not load a source extension. Other available sources will still be checked.',
            ),
        );
      };
      const options = { signal, retries: args.retries, onCheck: printCheck };
      const hasOverrides = Object.keys(args.overrides).length > 0;
      if (args.action === 'watch') {
        if (hasOverrides) await withSources(() => Promise.resolve());
        console.log('Watching shelf subscriptions. Press Ctrl+C to stop.');
        await watchShelf(shelf.tracking, withSources, {
          ...args,
          ...options,
          onTask: printTask,
          onOutputUnavailable: () =>
            logError('Output marker unavailable; downloads deferred.'),
        });
        return 0;
      }

      const entries = shelf.tracking.subscriptions(args.id);
      if (!entries.length && args.id) {
        logError('Subscription not found. Run comic-dl shelf list.');
        return 2;
      }
      const result =
        entries.length || hasOverrides
          ? await withSources((sources) =>
              checkSubscriptions(shelf.tracking, sources, entries, {
                ...options,
                includeHistory: args.includeHistory,
              }),
            )
          : { failures: 0, queued: 0 };
      console.log(
        `Summary: ${entries.length} checked, ${result.queued} queued, ${result.failures} failed`,
      );
      return result.failures ? 1 : 0;
    }
    if (args.action !== 'add' && args.action !== 'set-input') {
      switch (args.action) {
        case 'status':
          return printShelfStatus(shelf, args.id);
        case 'retry':
          if (!shelf.tracking.retry(args.id, args.input)) {
            logError(
              'No failed or restricted chapter to retry for this subscription. Run comic-dl shelf status.',
            );
            return 2;
          }
          console.log('Chapter queued.');
          break;
        case 'list':
          for (const entry of shelf.list()) printShelfEntry(entry);
          break;
        case 'remove':
          shelf.remove(args.id);
          break;
        default:
          printShelfEntry(
            shelf.setFollowing(args.id, args.action === 'follow'),
          );
      }
      return 0;
    }

    const sources = builtinSources(args);
    return await withExtensions(sources, args.extensions, signal, async () => {
      sources.validateOverrides();
      const options = { signal, retries: args.retries };
      if (args.action === 'add') {
        const sourceId = selectSourceId(
          sources,
          args.sourceId,
          args.input,
          'series',
        );
        if (!sourceId) return 2;
        printShelfEntry(
          await shelf.add(sources, sourceId, args.input, {
            ...options,
            title: args.title,
          }),
        );
      } else {
        printShelfEntry(
          await shelf.setInput(sources, args.id, args.input, options),
        );
      }
      return 0;
    });
  } finally {
    shelf.close();
  }
}

function printCheck(event: CheckEvent) {
  const prefix = `${event.id}\t${event.sourceId}`;
  if (event.status === 'failed') {
    console.error(`${prefix}\tfailed\t${event.problem}`);
  } else if (event.status === 'changed') {
    console.log(`${prefix}\tchanged; check result discarded`);
  } else {
    console.log(`${prefix}\t${event.status}\t${event.queued} queued`);
  }
}

function printTask(event: TaskEvent) {
  console.log(
    `${event.entryId}\tchapter ${JSON.stringify(event.chapterId)}\t${event.state}`,
  );
}

function printShelfStatus(shelf: Shelf, id?: string) {
  const statuses = shelf.tracking.status(id);
  if (id && !statuses.length) {
    logError('Shelf entry not found. Run comic-dl shelf list.');
    return 2;
  }
  const displayTime = (time: number | null) =>
    time === null ? '-' : new Date(time).toISOString();
  for (const status of statuses) {
    const state = status.following ? 'following' : 'not-following';
    console.log(
      `${status.id}\t${status.sourceId}\t${state}\tlast check: ${displayTime(status.lastCheck)}\t` +
        `last success: ${displayTime(status.lastSuccess)}\t${status.result ?? 'unchecked'}\t` +
        `${status.pending} pending (${status.restricted} restricted), ${status.blocked} blocked, ${status.complete} complete`,
    );
  }
  if (id) {
    for (const chapter of shelf.tracking.needsAttention(id)) {
      console.log(
        `${id}\tchapter ${JSON.stringify(chapter.id)}\t${chapter.state}`,
      );
    }
  }
  return 0;
}

function selectSourceId(
  sources: SourceRegistry,
  explicit: string | undefined,
  input: string,
  kind: 'series' | 'chapter',
) {
  let id = explicit;
  if (id === undefined) {
    try {
      id = sources.match(input, kind);
    } catch (error) {
      logError(
        `${error instanceof Error ? error.message : String(error)} Install a source with comic-dl add <package> or select one with --source.`,
      );
      return;
    }
  }
  if (!sources.ids().includes(id)) {
    logError(
      `Unknown source: ${id}. Install it with comic-dl add <package> or load it with --extension.`,
    );
    return;
  }
  return id;
}

async function runSourceCommand(
  args: Extract<
    Awaited<ReturnType<typeof parseCommand>>,
    {
      extensions: readonly string[];
      command: 'sources' | 'search' | 'list' | 'chapter' | 'download';
    }
  >,
  sources: SourceRegistry,
  signal: AbortSignal,
) {
  if (args.command === 'sources') {
    if (args.settingsSource) {
      console.log(
        JSON.stringify(sources.settings(args.settingsSource), null, 2),
      );
      return 0;
    }
    for (const id of sources.ids()) {
      console.log(id);
    }
    return 0;
  }

  const sourceId = selectSourceId(
    sources,
    args.sourceId,
    args.command === 'search' ? '' : args.input,
    args.command === 'chapter' ? 'chapter' : 'series',
  );
  if (!sourceId) return 2;
  if (args.command === 'search') {
    if (args.showOptions) {
      console.log(
        JSON.stringify(
          await sources.catalog(sourceId, args.query, signal),
          null,
          2,
        ),
      );
      return 0;
    }
    const search = await sources.prepareSearch(
      sourceId,
      args.query,
      args.page,
      signal,
      { sort: args.sort, filters: args.filters },
      true,
    );
    const { results, hasNext } = await readSource(
      sourceId,
      'search the catalog',
      search,
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
  const source = sources.create(sourceId);
  if (args.command === 'list') {
    const series = await readSource(
      source.id,
      'list chapters',
      () => source.getSeries(args.input, signal),
      signal,
    );
    for (const { id, title } of series.chapters) {
      console.log(`${id}\t${title}`);
    }
    return 0;
  }
  const direct = args.command === 'chapter' && !args.selections.length;
  const series = await readSource(
    source.id,
    direct ? 'resolve the chapter' : 'list chapters',
    () => resolveDownloadSeries(source, args.input, direct, signal),
    signal,
    args.retries,
  );
  let selected = series;
  if (args.selections.length) {
    try {
      selected = selectChapters(
        series,
        args.selections,
        args.command === 'download',
      );
    } catch (error) {
      logError(error);
      return 2;
    }
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
          `${label}: chapter ${result.chapterId} (attempts: ${result.attempts}, source: ${source.id}): ${result.error}`,
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

async function readSource<T>(
  source: string,
  operation: string,
  read: () => Promise<T>,
  signal: AbortSignal,
  retries?: number,
): Promise<T> {
  try {
    return await retrySourceRead(read, signal, retries);
  } catch (cause) {
    signal.throwIfAborted();
    const reason = cause instanceof Error ? cause.message : String(cause);
    throw new Error(`${source}: could not ${operation}: ${reason}`, { cause });
  }
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
    if (args.command === 'shelf' && args.action === 'watch') {
      process.on('SIGTERM', interrupt);
    }
    const code = await run(args, controller.signal);
    return controller.signal.aborted ? 130 : code;
  } catch (error) {
    if (controller.signal.aborted) {
      return 130;
    }
    logError(error);
    return error instanceof SourceOptionError ? 2 : 1;
  } finally {
    process.off('SIGINT', interrupt);
    process.off('SIGTERM', interrupt);
  }
}

process.exitCode = await main();
