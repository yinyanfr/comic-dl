#!/usr/bin/env node

import args from "args";
import { chapterCommand, downloadCommand, listCommand } from "./commands";

args
  .command("list", "List all chapters of a manga serie.", listCommand, [
    "l",
    "ls",
  ])
  .command(
    "download",
    "Download chapters from a manga serie.",
    downloadCommand,
    ["d", "dl"]
  )
  .command("chapter", "Download images from one chapter.", chapterCommand, [
    "c",
    "ch",
  ])
  .option("url", "The url to the serie or the chapter.")
  .option(
    "name",
    "Optional: Proride the serie title and override the folder name."
  )
  .option(
    "output",
    "Optional: The path where downloaded files are saved (default to .), setting this flag when using list will save a ComicInfo.xml to the path."
  )
  .option(
    "cookie",
    "Optional (but recommanded): Provide the path to a text file that contains your cookie."
  )
  .option(
    "from",
    "Optional: Starting chapter when downloading a serie, default to 0."
  )
  .option(
    "to",
    "Optional: Ending chapter when downloading a serie, defaults to chapter.length - 1."
  )
  .option("archive", "Optional: Output zip or cbz archive grouped by chapters.")
  .option("timeout", "Optional: Override the default 10s request timeout.")
  .option("slience", "Optional: Silence the console output.")
  .option(
    "batch",
    "Optional: Set the number or images to be downloaded simultaneously, default to 10."
  )
  .option(
    "verbose",
    "Optional: Display detailed error message, overrides silence."
  )
  .option(
    "yes",
    "Optional: Skipping confirmation prompt when downloading series."
  )
  .option(
    "max-title-length",
    "Optional: restrict the length of title as the folder name."
  )
  .option("zip-level", "Optional: zip level for archive, default to 5.")
  .option(
    "retry",
    "Optional: Automatically re-download chapters with failed images."
  )
  .option(
    "chapters",
    "Optional: Only downloading given list of chapters, example: -C 1,2,4,7"
  )
  .option("info", "Optional: Generate ComicInfo.xml.")
  .example(
    "npx zerobyw-dl dl -c cookie.txt -f 10 -t 20 -o ~/Download/zerobyw -a zip -r -i -u serie_url",
    "Download a serie from its 10th chapter to 20th chapter to the given destination, output zip archives with ComicInfo.xml by chapter, retry if a chapter is not properly downloaded."
  )
  .example(
    "npx zerobyw-dl dl -c cookie.txt -o ~/Download/zerobyw -i -u serie_url -c 0,4,12",
    "Download chapter index 0, 4, 12 from a serie"
  )
  .example(
    "npx zerobyw-dl ls -u serie_url",
    "List all chapters of the given serie."
  )
  .example(
    "npx zerobyw-dl ch -n Chapter1 -u chapter_url -c cookie.txt",
    "Download a chapter named Chapter1 to current path."
  );

args.parse(process.argv);
