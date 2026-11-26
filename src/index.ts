import { parseArgs } from 'node:util';
import { downloadChapter } from './download.js';
import { fixtureSource } from './sources/fixture.js';

const usage =
  'Usage: node dist/index.js chapter --fixture <directory> --output <directory>';

async function main(args: string[]) {
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log(usage);
    return;
  }
  const [command, ...options] = args;
  if (command !== 'chapter') {
    throw new Error(`Unknown command: ${command}`);
  }

  const { values } = parseArgs({
    args: options,
    options: {
      fixture: { type: 'string' },
      output: { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
  });
  if (values.help) {
    console.log(usage);
    return;
  }
  if (!values.fixture || !values.output) {
    throw new Error('chapter requires --fixture and --output');
  }

  const result = await downloadChapter(
    fixtureSource,
    values.fixture,
    values.output,
  );
  console.log(
    `${result.status === 'skipped' ? 'Skipped' : 'Downloaded'}: ${result.path}`,
  );
}

try {
  await main(process.argv.slice(2));
} catch (error) {
  console.error(
    `comic-dl: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
}
