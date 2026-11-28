---
title: Basic usage
description: Download from a series URL or short ID, search for a series, list chapters, or download a single chapter.
---

These Bash and Zsh examples assume you have [installed the CLI and added CopyManga](../quickstart/#add-a-manga-source).

## Download from a series URL

Open a terminal in the directory where you want to save the manga and pass the full series URL:

```sh
comic-dl d "https://www.copy20.com/comic/xiangkanbaitiantongxuederuanruobiaoqing"
```

The CLI matches the URL to an installed source and downloads the entire series to your current directory, one CBZ per chapter. `d` is short for `download`.

The latest version creates work subdirectories by default: `work title/number-chapter title.cbz`. `-o ~/manga` is the output root; you do not need to append the series name. Numbers come from the full catalog before selection. Use a [configuration file](../config-tutorial/) for templates, padding, or ZIP. Legacy hashed archives remain recognized by stable identity without automatic renaming.

## Download a range using a short ID

```sh
comic-dl d xiangkanbaitiantongxuederuanruobiaoqing --source copymanga -o ~/manga -c 2-4
```

A short ID has no domain, so use `--source copymanga` to select the source. `-o` sets the output directory. `-c 2-4` selects the second through fourth entries in the chapter list, inclusive. An out-of-bounds range fails before anything is downloaded.

## Search, list chapters, and download one chapter

```sh
comic-dl search 'Do It Yourself' --source copymanga
```

Use the URL from the first column of the search results to list chapters. If the source supports browsing, omit the keyword to display the catalog. If the CLI reports another page, pass `--page 2` or the appropriate page number.

```sh
series_url='https://www.copy20.com/comic/xiangkanbaitiantongxuederuanruobiaoqing'
comic-dl l "$series_url"
```

`l` is short for `list`. The first column is the chapter ID, and the second is its title. If you already have a supported chapter URL, replace the placeholder below and set the output directory with `-o`:

```sh
comic-dl chapter '<chapter URL>' -o ./downloads
```

See [advanced usage](../advanced/) to select by chapter ID, combine ranges, or change concurrency. The [CopyManga extension README](https://github.com/yinyanfr/comic-dl-extensions/blob/main/extensions/copymanga/README.en.md) explains source-specific options such as chapter groups.
