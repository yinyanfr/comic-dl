import { readFileSync } from 'node:fs';
import { argv, stdout } from 'node:process';
import { URL } from 'node:url';

const version = argv[2];
if (!version)
  throw new Error('Usage: node .github/scripts/release-notes.mjs <version>');

const changelog = readFileSync(
  new URL('../../CHANGELOG.md', import.meta.url),
  'utf8',
);
const prefix = `${version} — `;
const entries = changelog
  .split(/^## /mu)
  .slice(1)
  .filter((entry) => entry.startsWith(prefix));
if (entries.length !== 1) {
  throw new Error(
    `Expected one "## ${version} — YYYY-MM-DD" entry in CHANGELOG.md.`,
  );
}

const [heading, ...lines] = entries[0].split(/\r?\n/u);
const date = heading.slice(prefix.length).trim();
const body = lines.join('\n').trim();
const [summary, ...sections] = body.split(/^### \S.*$/mu);
if (
  !/^\d{4}-\d{2}-\d{2}$/u.test(date) ||
  !summary.trim() ||
  sections.length === 0 ||
  sections.some((section) => !section.trim())
) {
  throw new Error(
    `The ${version} changelog entry needs a date, a summary, and non-empty sections.`,
  );
}

const changelogUrl = `https://github.com/yinyanfr/comic-dl/blob/${encodeURIComponent(version)}/CHANGELOG.md`;
stdout.write(
  `## Release Notes: ${version}\n\n\`${date}\`\n\n${body}\n\n[Full changelog](${changelogUrl})\n`,
);
