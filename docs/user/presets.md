# Using Presets

`version 2.1.0`

You can now use presets with CLI to reduce the numbers of flags

- Each site can have its own presets, use `"module"` to declare site, if `"module"` is not set, it's used for all sites.
- Rules written below overrides those above.
- Rule names are the same as CLI flags, full names using camelCase, e.g. `maxTitleLength`, `zipLevel`
- You can still use flags, and flags come with higher priorities.

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

You can also generate a presets.json using the `generate` command

```bash
npx comic-dl gen --presets > presets.json
```
