/**
 * MIT License
 * Copyright (c) 2023 Yan
 */

export function isString(n: unknown) {
  return typeof n === 'string' || n instanceof String;
}

export function formatImageName(index: number) {
  return index < 10 ? `0${index}` : `${index}`;
}

export function kavitaRename(chapterName: string) {
  const match = chapterName.match(/([0-9]+)[-~][0-9]+/);
  if (match) {
    return match[1];
  }
  return chapterName;
}
