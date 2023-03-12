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
  .option("name", "The name to the serie or the chapter, optional for series.")
  .option(
    "host",
    "Optional: Provide the base url to ZeroByw in case that the default one is taken down."
  )
  .option(
    "output",
    "Optional: The path where downloaded files are saved (default to .)."
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
  .option("timeout", "Optional: Override the default 10s request timeout")
  .option("slience", "Optional: Silence the console output.")
  .option(
    "batch",
    "Optional: Set the number or images to be downloaded simultaneously, default to 10."
  )
  .example(
    "npx zerobyw-dl dl -u serie_url -f 10 -t 20 -o ~/Download/zerobyw",
    "Download a serie from its 10th chapter to 20th chapter to the given destination."
  )
  .example(
    "npx zerobyw-dl ls -u serie_url",
    "List all chapters of the given serie."
  )
  .example(
    "npx chapter -n Chapter1 -u chapter_url",
    "Download a chapter named Chapter1."
  );

const flags = args.parse(process.argv);

console.log("The CLI is under development and will be available soon.");
console.log("Thanks for your interests.");
console.log(flags);
