import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { isLocalExtensionPath, isSourceId } from './sources/index.js';

export interface CliConfig {
  extensions?: string[];
  source?: string;
  output?: string;
  jobs?: number;
  retries?: number;
}

export function nonempty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function outputPath(output: string, base = process.cwd()) {
  if (output === '~') return homedir();
  if (/^~[/\\]/.test(output)) return resolve(homedir(), `./${output.slice(2)}`);
  return resolve(base, output);
}

export function userDataDirectory() {
  const base =
    process.platform === 'win32'
      ? process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local')
      : isAbsolute(process.env.XDG_DATA_HOME ?? '')
        ? process.env.XDG_DATA_HOME!
        : join(homedir(), '.local', 'share');
  return join(base, 'comic-dl');
}

export async function readConfig(
  file: string | undefined,
  signal: AbortSignal,
): Promise<CliConfig> {
  if (file === undefined) {
    return {};
  }
  if (!nonempty(file)) {
    throw new Error('--config requires a file path');
  }
  const path = resolve(file);
  let contents: string;
  try {
    contents = await readFile(path, { encoding: 'utf8', signal });
  } catch {
    signal.throwIfAborted();
    throw new Error(`Could not read config file: ${path}`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(contents);
  } catch {
    throw new Error('Config is not valid JSON');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Config must be a JSON object');
  }
  const fields = parsed as Record<string, unknown>;
  if (fields.version !== 1) {
    throw new Error('Config requires "version": 1');
  }
  const allowed = [
    'version',
    'extensions',
    'source',
    'output',
    'jobs',
    'retries',
  ];
  if (Object.keys(fields).some((key) => !allowed.includes(key))) {
    throw new Error(
      `Config contains an unknown field. Allowed fields: ${allowed.join(', ')}`,
    );
  }
  const { extensions, source, output, jobs, retries } = fields;
  if (
    extensions !== undefined &&
    (!Array.isArray(extensions) || !extensions.every(nonempty))
  ) {
    throw new Error(
      'Config "extensions" must be an array of non-empty strings',
    );
  }
  if (source !== undefined && !isSourceId(source)) {
    throw new Error('Config "source" must be a source ID');
  }
  if (output !== undefined && !nonempty(output)) {
    throw new Error('Config "output" must be a non-empty directory path');
  }
  const directory = dirname(path);
  return {
    extensions: extensions?.map((extension) =>
      isLocalExtensionPath(extension)
        ? resolve(directory, extension)
        : extension,
    ),
    source,
    output: output === undefined ? undefined : outputPath(output, directory),
    jobs: jobs === undefined ? undefined : configInteger('jobs', jobs, 1),
    retries:
      retries === undefined ? undefined : configInteger('retries', retries, 0),
  };
}

function configInteger(name: string, value: unknown, minimum: number) {
  if (
    typeof value !== 'number' ||
    !Number.isSafeInteger(value) ||
    value < minimum
  ) {
    throw new Error(`Config "${name}" requires an integer >= ${minimum}`);
  }
  return value;
}
