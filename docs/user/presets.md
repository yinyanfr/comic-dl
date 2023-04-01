# Using Presets

`version 2.1.0`

You can now use presets with CLI to reduce the numbers of flags

- Each site can have its own presets, use `"module"` to declare site, if `"module"` is not set, it's used for all sites.
- rules written below overrides those above.
- rule names are the same as CLI flags, full names using camelCase, e.g. `maxTitleLength`, `zipLevel`

## Example

```json
[
  {
    "archive": "cbz",
    "batch": 5,
    "retry:" true,
    "info": true,
    "output": "~/Downloads/manga",
    "zipLevel": 5
  },
  {
    "module": "zerobyw",
    "batch": 10,
    "cookie": "./cookie.txt",
    "maxTitleLength": 30
  },
  {
    "module": "copymanga",
    "format": "webp"
  },
  {
    "module": "ganma",
    "auth": "your_cookie_string"
  }
]
```

```bash
npx comic-dl -p presets.json -u serie_url
```
