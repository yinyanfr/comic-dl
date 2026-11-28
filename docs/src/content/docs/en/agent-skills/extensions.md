---
title: Develop source extensions
description: Guide agents through API v1 adapters, safe credentials, offline tests, and packaging.
---

## Load the skill

```sh
npx skills add yinyanfr/comic-dl --skill comic-dl-extension-dev
```

[Read SKILL.md](https://github.com/yinyanfr/comic-dl/blob/main/skills/comic-dl-extension-dev/SKILL.md) · [Installation](../)

For independent source packages. Companion adapters live in [comic-dl-extensions](https://github.com/yinyanfr/comic-dl-extensions); parsing does not belong in the core.

## Workflow

1. Read API v1 and repository instructions; establish stable work/chapter IDs, full reading order, and sanitized samples.
2. Start from the offline hello adapter, default-export `SourceExtension`, and import public types from `comic-dl/extension`.
3. Implement matching, settings validation, authentication, and ordered lazy pages; add optional metadata, search, and covers as needed.
4. Test redirects, credential boundaries, cancellation, restrictions, selection, and direct links using fixtures and loopback HTTP.
5. Pack compiled ESM and test the artifact through both CLI and library in a temporary consumer.

## Example request

> Use comic-dl-extension-dev to build an adapter from my sanitized HTML/JSON samples. Keep API v1, start with offline tests, do not contact the live site or publish npm packages, and list capabilities needing live acceptance.

## Safety and acceptance

- Sources own site logic; core owns scheduling, retries, archives, and events; UIs own presentation.
- Keep cookies/keys out of public settings, results, cover URLs, and fixtures. Do not reattach secrets across origins.
- Missing metadata must not break downloads; avoid per-result detail fetches during search.
- Do not invent direct-link directory positions. Verify stable identity and page order.
- Managed installation disables lifecycle scripts, so ship compiled entry points. Publication requires separate authorization.

See [extension development](../../extensions/develop/), [API v1](../../specs/source-extension-v1/), and [Zerobyw walkthrough](../../extensions/zerobyw-walkthrough/).
