import { spawn } from 'node:child_process';
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
import { homedir } from 'node:os';
import { isAbsolute, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  importExtension,
  isPackageName,
  moduleSpecifier,
  SourceRegistry,
} from './sources/index.js';

export type ExtensionAction = 'add' | 'update' | 'remove';

function storeDirectory() {
  if (process.env.COMIC_DL_EXTENSION_DIR) {
    return resolve(process.env.COMIC_DL_EXTENSION_DIR);
  }
  const base =
    process.platform === 'win32'
      ? process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local')
      : isAbsolute(process.env.XDG_DATA_HOME ?? '')
        ? process.env.XDG_DATA_HOME!
        : join(homedir(), '.local', 'share');
  return join(base, 'comic-dl', 'extensions');
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
) {
  const { resolvePackage } = (await import(
    pathToFileURL(join(project, 'resolve.mjs')).href
  )) as { resolvePackage: (name: string) => string };
  const names = await packageNames(project);
  for (const name of names) {
    signal.throwIfAborted();
    if (!isPackageName(name))
      throw new Error(`Invalid installed package name: ${name}`);
    try {
      await access(join(project, 'node_modules', name, 'package.json'));
      sources.use(await importExtension(resolvePackage(name), name), name);
    } catch (cause) {
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
): Promise<T> {
  const store = storeDirectory();
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
        project ? await loadManaged(project, sources, signal) : [],
      );
      for (const input of explicit) {
        signal.throwIfAborted();
        const specifier = moduleSpecifier(input);
        if (!loaded.has(specifier)) {
          sources.use(await importExtension(specifier, input), input);
          loaded.add(specifier);
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

async function npm(project: string, args: string[], signal: AbortSignal) {
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
          `npm ${options.map((option) => `"${option}"`).join(' ')}`,
        ],
        {
          cwd: project,
          stdio: 'inherit',
          signal,
        },
      )
    : spawn('npm', options, { cwd: project, stdio: 'inherit', signal });
  await new Promise<void>((done, reject) => {
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) done();
      else
        reject(new Error(`npm ${args[0]} failed (exit ${code ?? 'signal'})`));
    });
  });
}

export async function manageExtensions(
  action: ExtensionAction,
  input: string | undefined,
  signal: AbortSignal,
) {
  const name = extensionPackage(action, input);
  const store = storeDirectory();
  await mkdir(store, { recursive: true });
  const lock = join(store, 'write-lock');
  try {
    await mkdir(lock);
  } catch (cause) {
    if (cause instanceof Error && 'code' in cause && cause.code === 'EEXIST') {
      throw new Error(`Extension store is locked: ${lock}`, { cause });
    }
    throw cause;
  }
  const generation = randomUUID();
  const project = join(store, generation);
  let committed = false;
  try {
    const previous = await currentProject(store);
    const installed = previous ? await packageNames(previous) : [];
    if (name && action !== 'add' && !installed.includes(name)) {
      throw new Error(`Extension is not installed: ${name}`);
    }
    if (action === 'update' && !installed.length) {
      console.log('No extensions installed.');
      return;
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
    await npm(project, [...args, '--package-lock-only'], signal);
    await npm(project, ['ci'], signal);
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
    console.log(
      action === 'remove'
        ? `Removed ${name}`
        : `Installed extensions: ${names.join(', ')}`,
    );
  } finally {
    try {
      if (!committed) await rm(project, { recursive: true, force: true });
    } finally {
      await rm(lock, { recursive: true, force: true });
    }
  }
}
