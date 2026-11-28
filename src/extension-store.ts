import { spawn } from 'node:child_process';
import { gt, rsort, valid, validRange } from 'semver';
import { randomUUID } from 'node:crypto';
import {
  access,
  copyFile,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { userDataDirectory } from './config.js';
import { pathToFileURL } from 'node:url';
import {
  DuplicateSourceError,
  importExtension,
  isPackageName,
  moduleSpecifier,
  SourceRegistry,
} from './sources/index.js';

export type ExtensionAction = 'add' | 'update' | 'remove';

function storeDirectory(directory?: string) {
  if (directory !== undefined) return resolve(directory);
  if (process.env.COMIC_DL_EXTENSION_DIR) {
    return resolve(process.env.COMIC_DL_EXTENSION_DIR);
  }
  return join(userDataDirectory(), 'extensions');
}

function missing(error: unknown) {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}

async function currentProject(store: string) {
  try {
    const name = await readFile(join(store, 'current'), 'utf8');
    if (!/^[a-f0-9-]{36}$/.test(name)) {
      throw new Error(`Invalid extension store pointer: ${store}`);
    }
    return join(store, name);
  } catch (error) {
    if (!missing(error)) throw error;
  }
}

async function packageNames(project: string) {
  const { dependencies = {} } = JSON.parse(
    await readFile(join(project, 'package.json'), 'utf8'),
  ) as { dependencies?: Record<string, string> };
  return Object.keys(dependencies).sort();
}

async function loadManaged(
  project: string,
  sources: SourceRegistry,
  signal: AbortSignal,
  onLoadError?: (error: unknown) => void,
) {
  const { resolvePackage } = (await import(
    pathToFileURL(join(project, 'resolve.mjs')).href
  )) as { resolvePackage: (name: string) => string };
  const names = await packageNames(project);
  for (const name of names) {
    signal.throwIfAborted();
    try {
      if (!isPackageName(name))
        throw new Error(`Invalid installed package name: ${name}`);
      await access(join(project, 'node_modules', name, 'package.json'));
      sources.use(await importExtension(resolvePackage(name), name), name);
    } catch (cause) {
      if (onLoadError) {
        onLoadError(cause);
        continue;
      }
      throw new Error(
        `Could not register ${name}: ${cause instanceof Error ? cause.message : String(cause)}`,
        { cause },
      );
    }
  }
  return names;
}

async function discardIfUnused(store: string, project: string) {
  if ((await currentProject(store)) === project) return;
  try {
    if (!(await readdir(join(project, 'readers'))).length) {
      await rm(project, { recursive: true, force: true });
    }
  } catch (error) {
    if (!missing(error)) throw error;
  }
}

export async function withExtensions<T>(
  sources: SourceRegistry,
  explicit: readonly string[],
  signal: AbortSignal,
  run: () => Promise<T>,
  onLoadError?: (cause: unknown) => void,
  directory?: string,
): Promise<T> {
  const store = storeDirectory(directory);
  const ignoreLoadError =
    onLoadError &&
    ((cause: unknown) => {
      signal.throwIfAborted();
      if (cause instanceof DuplicateSourceError)
        sources.excludeAmbiguous(cause.id);
      onLoadError(cause);
    });
  for (;;) {
    signal.throwIfAborted();
    const project = await currentProject(store);
    const marker = project && join(project, 'readers', randomUUID());
    if (marker) {
      try {
        await writeFile(marker, '', { flag: 'wx' });
      } catch (error) {
        if (missing(error)) continue;
        throw error;
      }
    }
    try {
      if (project !== (await currentProject(store))) continue;
      const loaded = new Set(
        project
          ? await loadManaged(project, sources, signal, ignoreLoadError)
          : [],
      );
      for (const input of explicit) {
        signal.throwIfAborted();
        try {
          const specifier = moduleSpecifier(input);
          if (!loaded.has(specifier)) {
            sources.use(await importExtension(specifier, input), input);
            loaded.add(specifier);
          }
        } catch (cause) {
          if (!ignoreLoadError) throw cause;
          ignoreLoadError(cause);
        }
      }
      return await run();
    } finally {
      if (project && marker) {
        await rm(marker, { force: true });
        await discardIfUnused(store, project);
      }
    }
  }
}

export function extensionPackage(
  action: ExtensionAction,
  input: string | undefined,
) {
  if (input === undefined && action === 'update') return;
  const versionStart = input?.lastIndexOf('@') ?? -1;
  const name = versionStart > 0 ? input!.slice(0, versionStart) : input;
  const version = versionStart > 0 ? input!.slice(versionStart + 1) : undefined;
  if (
    !name ||
    !isPackageName(name) ||
    (version !== undefined &&
      (action !== 'add' || !/^[a-zA-Z0-9^~][a-zA-Z0-9._^~+-]*$/.test(version)))
  ) {
    throw new Error(
      `Provide an npm package name${action === 'add' ? ' (optionally with @version or @tag)' : ''}`,
    );
  }
  return name;
}

async function npm(
  project: string,
  args: string[],
  signal: AbortSignal,
  stdio: 'inherit' | 'ignore',
) {
  signal.throwIfAborted();
  const options = [...args, '--ignore-scripts', '--no-audit', '--no-fund'];
  const windows = process.platform === 'win32';
  const child = windows
    ? spawn(
        'cmd.exe',
        [
          '/d',
          '/s',
          '/c',
          `"npm ${options.map((option) => `"${option}"`).join(' ')}"`,
        ],
        {
          cwd: project,
          stdio,
          signal,
          windowsVerbatimArguments: true,
        },
      )
    : spawn('npm', options, { cwd: project, stdio, signal });
  await new Promise<void>((done, reject) => {
    let failure: Error | undefined;
    child.on('error', (error) => {
      failure = error;
    });
    child.on('close', (code) => {
      if (failure) reject(failure);
      else if (code === 0) done();
      else
        reject(new Error(`npm ${args[0]} failed (exit ${code ?? 'signal'})`));
    });
  });
}

function writerIsAlive(pid: number) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ESRCH') {
      return false;
    }
    throw error;
  }
}

export interface ExtensionStoreOptions {
  directory?: string;
  signal?: AbortSignal;
}

export interface ExtensionChange {
  action: ExtensionAction;
  package?: string;
  installed: readonly string[];
  changed: boolean;
}

export interface ManagedExtension {
  package: string;
  version: string | null;
  requested: string;
  sourceId: string | null;
  status: 'loaded' | 'failed';
}

/** Pin a generation while inspecting it; no package operations or pointer writes. */
async function inspectGeneration<T>(
  directory: string | undefined,
  signal: AbortSignal,
  inspect: (project: string | undefined) => Promise<T>,
): Promise<T> {
  const store = storeDirectory(directory);
  for (;;) {
    signal.throwIfAborted();
    const project = await currentProject(store);
    const marker = project && join(project, 'readers', randomUUID());
    if (marker) {
      try {
        await writeFile(marker, '', { flag: 'wx' });
      } catch (error) {
        if (missing(error)) continue;
        throw error;
      }
    }
    try {
      if (project !== (await currentProject(store))) continue;
      return await inspect(project);
    } finally {
      if (marker) await rm(marker, { force: true });
    }
  }
}

export async function listManagedExtensions({
  directory,
  signal = new AbortController().signal,
}: ExtensionStoreOptions = {}): Promise<ManagedExtension[]> {
  return inspectGeneration(directory, signal, async (project) => {
    if (!project) return [];
    const { dependencies = {} } = JSON.parse(
      await readFile(join(project, 'package.json'), 'utf8'),
    ) as { dependencies?: Record<string, string> };
    const registry = new SourceRegistry();
    const results: ManagedExtension[] = [];
    for (const name of Object.keys(dependencies).sort()) {
      signal.throwIfAborted();
      const result: ManagedExtension = {
        package: name,
        requested: dependencies[name],
        version: null,
        sourceId: null,
        status: 'failed',
      };
      results.push(result);
      try {
        if (!isPackageName(name)) continue;
        const manifest = JSON.parse(
          await readFile(
            join(project, 'node_modules', name, 'package.json'),
            'utf8',
          ),
        ) as { version?: string };
        result.version =
          typeof manifest.version === 'string' && valid(manifest.version)
            ? manifest.version
            : null;
        const { resolvePackage } = (await import(
          pathToFileURL(join(project, 'resolve.mjs')).href
        )) as { resolvePackage: (name: string) => string };
        const extension = await importExtension(resolvePackage(name), name);
        result.sourceId = extension.id;
        registry.use(extension, name);
        result.status = 'loaded';
      } catch {
        signal.throwIfAborted();
      }
    }
    // An ambiguous mapping is not a successfully usable source.
    for (const result of results) {
      if (
        results.some(
          (other) =>
            other !== result &&
            other.sourceId !== null &&
            other.sourceId === result.sourceId,
        )
      )
        result.status = 'failed';
    }
    return results;
  });
}

export type ExtensionUpdate = ManagedExtension &
  (
    | { updateStatus: 'current' | 'available'; availableVersion: string }
    | { updateStatus: 'failed'; problem: 'query-failed' | 'not-installed' }
  );

/** npm itself resolves ranges/tags and honors the user's registry configuration. */
export async function checkExtensionUpdates(
  packageName?: string,
  options: ExtensionStoreOptions = {},
): Promise<ExtensionUpdate[]> {
  if (packageName !== undefined && !isPackageName(packageName))
    throw new Error('Provide an npm package name');
  const signal = options.signal ?? new AbortController().signal;
  const installed = await listManagedExtensions({ ...options, signal });
  if (packageName && !installed.some((entry) => entry.package === packageName))
    throw new Error('Extension is not installed');
  return Promise.all(
    installed
      .filter((entry) => !packageName || entry.package === packageName)
      .map(async (entry): Promise<ExtensionUpdate> => {
        if (!entry.version)
          return { ...entry, updateStatus: 'failed', problem: 'not-installed' };
        try {
          if (
            !isPackageName(entry.package) ||
            (!validRange(entry.requested) &&
              !/^[a-zA-Z][a-zA-Z0-9._-]*$/.test(entry.requested))
          )
            throw new Error('Invalid requested version');
          const output = await new Promise<string>((resolve, reject) => {
            const spec = `${entry.package}@${entry.requested}`;
            const windows = process.platform === 'win32';
            const child = spawn(
              windows ? 'cmd.exe' : 'npm',
              windows
                ? ['/d', '/s', '/c', `"npm view "${spec}" version --json"`]
                : ['view', spec, 'version', '--json'],
              {
                signal,
                stdio: ['ignore', 'pipe', 'ignore'],
                timeout: 30_000,
                windowsVerbatimArguments: windows,
              },
            );
            let text = '';
            child.stdout.setEncoding('utf8').on('data', (chunk: string) => {
              text += chunk;
            });
            child.on('error', reject);
            child.on('close', (code) =>
              code === 0 ? resolve(text) : reject(new Error('Query failed')),
            );
          });
          const versions: unknown = JSON.parse(output);
          const availableVersion = Array.isArray(versions)
            ? rsort(
                versions.filter(
                  (version): version is string =>
                    typeof version === 'string' && valid(version) !== null,
                ),
              )[0]
            : versions;
          if (typeof availableVersion !== 'string')
            throw new Error('Invalid version');
          if (!valid(availableVersion) || !valid(entry.version))
            throw new Error('Invalid version');
          return {
            ...entry,
            updateStatus: gt(availableVersion, entry.version)
              ? 'available'
              : 'current',
            availableVersion,
          };
        } catch {
          signal.throwIfAborted();
          return { ...entry, updateStatus: 'failed', problem: 'query-failed' };
        }
      }),
  );
}

export async function manageExtensions(
  action: ExtensionAction,
  input: string | undefined,
  {
    directory,
    signal = new AbortController().signal,
    stdio = 'ignore',
  }: ExtensionStoreOptions & { stdio?: 'inherit' | 'ignore' } = {},
): Promise<ExtensionChange> {
  if (action !== 'add' && action !== 'update' && action !== 'remove')
    throw new Error('Expected an extension action: add, update, or remove');
  const name = extensionPackage(action, input);
  signal.throwIfAborted();
  const store = storeDirectory(directory);
  await mkdir(store, { recursive: true });
  const writers = join(store, 'writers');
  await mkdir(writers, { recursive: true });
  const generation = randomUUID();
  const owner = `${process.pid}-${generation}`;
  const lock = join(writers, owner);
  await mkdir(lock);
  const project = join(store, generation);
  let committed = false;
  try {
    // Publish before scanning: a later writer must see us while we hold the lock.
    // Dead owners never reuse their unique directory, even if a PID is recycled.
    for (const entry of await readdir(writers)) {
      if (entry === owner) continue;
      const [, pid] = /^([1-9]\d*)-[a-f0-9-]{36}$/.exec(entry) ?? [];
      if (!pid) continue;
      if (writerIsAlive(Number(pid))) {
        throw new Error(
          `Extension store is locked by another command (PID ${pid})`,
        );
      }
      await rm(join(writers, entry), { recursive: true, force: true });
    }
    signal.throwIfAborted();
    const previous = await currentProject(store);
    const installed = previous ? await packageNames(previous) : [];
    if (name && action !== 'add' && !installed.includes(name)) {
      throw new Error(`Extension is not installed: ${name}`);
    }
    if (action === 'update' && !installed.length) {
      return { action, package: name, installed, changed: false };
    }
    await mkdir(join(project, 'readers'), { recursive: true });
    if (previous) {
      for (const file of ['package.json', 'package-lock.json']) {
        await copyFile(join(previous, file), join(project, file));
      }
    } else {
      await writeFile(
        join(project, 'package.json'),
        JSON.stringify({ name: 'comic-dl-extension-store', private: true }),
      );
    }
    await writeFile(
      join(project, 'resolve.mjs'),
      'export const resolvePackage = (name) => import.meta.resolve(name);\n',
    );
    const args =
      action === 'add'
        ? ['install', '--save', input!]
        : action === 'remove'
          ? ['uninstall', name!]
          : ['update', ...(name ? [name] : [])];
    await npm(project, [...args, '--package-lock-only'], signal, stdio);
    if (action === 'add' && name && input !== name) {
      const manifestPath = join(project, 'package.json');
      const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as {
        dependencies: Record<string, string>;
      };
      manifest.dependencies[name] = input!.slice(name.length + 1);
      await writeFile(manifestPath, JSON.stringify(manifest));
      await npm(project, ['install', '--package-lock-only'], signal, stdio);
    }
    await npm(project, ['ci'], signal, stdio);
    const registry = new SourceRegistry();
    const names = await loadManaged(project, registry, signal);
    if (registry.ids().includes('fixture'))
      throw new Error('Source ID fixture is reserved for offline testing');
    signal.throwIfAborted();
    const pointer = join(lock, 'current');
    await writeFile(pointer, generation);
    await rename(pointer, join(store, 'current'));
    committed = true;
    if (previous) await discardIfUnused(store, previous);
    return { action, package: name, installed: names, changed: true };
  } finally {
    try {
      if (!committed) await rm(project, { recursive: true, force: true });
    } finally {
      await rm(lock, { recursive: true, force: true });
    }
  }
}
