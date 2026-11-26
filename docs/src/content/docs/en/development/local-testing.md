---
title: Local development testing
description: Use local fixtures to verify chapter listings, CBZ generation, and archive integrity.
---

`fixture` is a built-in test source. It reads local images and JSON you prepare in advance and does not access manga sites. Use it to verify the CLI, page order, and CBZ output without a network connection. From the repository root, run:

```sh
npm ci
npm test
node dist/index.js sources
```

`npm test` builds the core and runs regression tests. `sources` should include `fixture`. The following steps reproduce some of the test cases manually.

## Verify a single chapter archive

Put two test images, `cover.png` and `page-2.jpg`, in `./demo` alongside a `chapter.json` file. `workId` and `chapterId` are stable identifiers; `pages` lists file names from the same directory in reading order:

```json
{
  "workId": "demo",
  "chapterId": "1",
  "pages": ["cover.png", "page-2.jpg"]
}
```

```sh
node dist/index.js chapter --fixture ./demo -o ./downloads
```

Use `unzip -l ./downloads/*.cbz` to inspect the entries and `unzip -t ./downloads/*.cbz` to check archive integrity. Running the command again with the same inputs should report `Skipped`. To test a missing page, move one image out of the fixture and use an empty output directory: the command should exit nonzero and leave no partial CBZ. Restore the image and try again.

## Verify series listing and chapter selection

Create `series.json` in the image directory and provide the three images it names. `workId` identifies the work, each `id` is unique within it, and both `chapters` and `pages` are in reading order. Use file names without directory components.

```json
{
  "workId": "demo",
  "chapters": [
    {
      "id": "1",
      "title": "Chapter one",
      "pages": ["01-cover.png", "01-page-2.jpg"]
    },
    { "id": "2", "title": "Chapter two", "pages": ["02-cover.png"] }
  ]
}
```

```sh
node dist/index.js list --fixture ./demo
node dist/index.js chapter --fixture ./demo -c 2 -o ./series-output
node dist/index.js download --fixture ./demo -o ./series-output
```

`list` should print chapters `1` and `2` in manifest order. The second command creates only chapter `2`; the last should create chapter `1` and skip the completed chapter `2`. `--fixture` replaces the positional series or chapter input and cannot be combined with an explicit `--source`. See the [CLI reference](../../reference/cli/) for options and exit codes.
