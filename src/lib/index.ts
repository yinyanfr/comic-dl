export function isString(n: unknown) {
  return typeof n === "string" || n instanceof String;
}
