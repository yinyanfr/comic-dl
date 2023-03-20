/**
 * MIT License
 * Copyright (c) 2023 Yan
 */

export function isString(n: unknown) {
  return typeof n === "string" || n instanceof String;
}
