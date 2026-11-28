---
title: Usage
description: Browse sources, manage your shelf, follow updates, download chapters, and install comic-dl WebUI.
---

comic-dl-web is a single-user, self-hosted interface for comic-dl. The server downloads comics directly into the administrator's output directory. The browser neither transfers comic files nor acts as an online reader. Closing a page does not stop background work.

This guide assumes the service is already available. For installation, environment variables, and backups, see [Deployment](../deployment/).

## Sign-in and appearance

When the administrator enables a password, sign in before accessing business pages, APIs, covers, or live events. The default cookie lasts for the browser session; “Remember me” lasts 30 days. Server-side sessions also expire after at most 30 days. Restarting the service invalidates all sessions. Browsers may restore session cookies, so explicitly log out in Settings on shared devices.

Choose Chinese, English, or Japanese in the header, Settings, or the login page. The language cookie lasts one year in that browser. Only application-owned text is translated: comic and chapter titles, authors, summaries, tags, and source-defined filters and fields remain unchanged. Switching language reloads the current URL without interrupting server tasks.

Settings offers light, dark, and system appearance, stored in the browser. The home page is your shelf, with detailed and compact views. In compact view, use the management icon for the full controls.

## Browsing and searching

1. Open Browse sources and select CopyManga, Zerobyw, DM5, Komga, or Kavita.
2. Browse with an empty query or enter keywords. Sorting, filtering, and pagination depend on the source; search may not support every browse option.
3. Aggregated search groups results by source. One unavailable source does not mean all searches failed.
4. Open a work to view its cover, metadata, summary, and chapters, add it to the shelf, or download chapters.

Metadata and covers depend on what the source provides. A placeholder cover does not necessarily mean downloading will fail. Site terms, regional restrictions, network access, and account permissions still apply.

### Source credentials

Web management is disabled by default and must be enabled by the administrator. Once enabled, source settings can save ordinary fields and credentials for bundled adapters. Saved secrets are never displayed again.

| Source    | Notes                                                                                                                                                                                                                                         |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CopyManga | Anonymous browsing; site URL, API URL, and User-Agent are source settings.                                                                                                                                                                    |
| Zerobyw   | Anonymous browsing/search; chapter listing and downloading require a valid Cookie. Use the login link in a new tab, then copy the work request's `Cookie` header from browser developer tools. Never post it in public issues or screenshots. |
| DM5       | Public content is accessible; the current bundled adapter has no editable fields.                                                                                                                                                             |
| Komga     | Configure the server URL and API Key.                                                                                                                                                                                                         |
| Kavita    | Configure the server URL and Auth Key.                                                                                                                                                                                                        |

Web credentials are bound to the source address used when saving them. Save them again after changing the address. Clearing them falls back to deployment-provided credentials. Restore defaults resets ordinary settings only. Web-saved credentials are not injected into managed adapters that override bundled ones; ask the administrator to follow the extension's configuration instructions.

## Shelf and automatic updates

Add a work from its detail page or expand the shelf's add-by-link form. A work is deduplicated within a source; editions from different sources are separate.

- Open a work title to select chapters. Download all missing chapters lets the core verify existing archives; it does not display an advance inventory of local chapters.
- Check updates checks one work. Check all works includes works with automatic checks disabled.
- Automatic checks fetch catalogs periodically; automatic downloads queue newly discovered chapters. These switches are independent.
- The enable/pause following shortcuts change both switches.
- A blank per-work interval follows the global interval. Changing the global interval does not replace explicit work overrides.

### Why did the first check download nothing?

The first successful check records a baseline by default, avoiding an accidental download of the entire collection. Use Download history or select chapters manually to obtain older chapters.

With automatic downloads disabled, new discoveries remain available for manual enqueueing. Enabling automatic downloads later does **not retroactively queue** those discoveries. Manual checks also respect the automatic-download setting.

Disabling either switch does not cancel already queued tasks; cancel them explicitly. Retry failed or restricted chapters after resolving access or network problems. Removing a shelf entry keeps existing archives. Editing its input must still identify the same work from the same source.

## Manual downloads and task management

Enter a work link or short ID in Manual download, choose a source if needed, and view chapters. Select chapters or enter an inclusive range such as `2-4`. Recognized direct chapter links also work. The server verifies the catalog before submission; if it changed, select chapters again.

The download drawer groups manual and watcher tasks by source and work, showing chapter numbers, stages, page progress, and outcomes. You can cancel, retry, and clear finished records:

- Existing archives are skipped only after identity and integrity checks, not filename guesses.
- One chapter's failure does not hide other results. Retries use current configuration and only retry eligible chapters.
- Snapshots contain active work and bounded recent records; complete chapter results are pageable.
- Clearing records deletes neither archives nor shelf history. Watcher records are hidden only for the current process.
- Manual queues and history are process-local and do not survive restart. Completed files remain; resubmitting skips valid archives.
- Watcher queues persist across restarts. Live page progress does not; a new attempt starts counting again.

Download only content you are authorized to access and back up. Files stay on the server, not on your phone or computer. Use an external reader, Komga, or Kavita with the configured comic directory.

## Archive settings and migration

With Web management enabled, Settings can select an existing download subdirectory, interval, default source, and archive policy. Subdirectories must already exist beneath the output root and cannot be symlinks. Changing directories does not move old files.

The default is `{title}/{number}-{chapter}.cbz`. CBZ/ZIP, number padding, and templates with at most four path components (including the filename) are supported. Variables are `{title}`, `{number}`, `{chapter}`, `{workId}`, and `{chapterId}`; do not add a filename extension. Numbers come from the full catalog, not the selected subset. Direct links without canonical context fall back to chapter IDs.

Changing templates, formats, or upstream sorting does not rename files automatically. Existing valid archives remain recognized by stable identity. To rename:

1. Ask the administrator to back up archives and stop other CLI, sync, or reader tools that write to them.
2. Finish or cancel active manual tasks.
3. In Settings, preview migration for one work or the whole shelf and review the plan.
4. Confirm to apply. Occupied destinations are not overwritten. Migration is not a batch transaction; inspect partial results before previewing again after a failure.

Previews expire after ten minutes and are invalidated by settings changes or restart. Applying pauses the watcher and blocks new manual tasks. Migration changes archive paths, not database backups or content formats.

## Extensions

The market lists recommended bundled sources and actual loading status. When management is enabled, install a trusted npm package using a version range or tag. Extensions execute code with the server's permissions.

Managed versions override bundled versions of the same source. Uninstalling restores the bundled version. Bundled dependencies update with the Web image; managed packages have their own lifecycle.

Check updates only queries; installation requires confirmation. Applying resolves the saved range again, so the check result is not a version lock. Exact versions do not update automatically, and `^0.2.0` excludes `0.3.0`; explicitly choose a new range or tag for such upgrades. A loadable definition does not prove that a site, account, or download works.

## Install as an app (PWA)

Open the service over HTTPS, then:

- Chrome/Edge: use the address-bar or menu installation action.
- iPhone/iPad: use the browser's Share menu → Add to Home Screen.
- macOS Safari: use Add to Dock.

Availability depends on the OS and browser. An ordinary HTTP LAN IP generally does not qualify; localhost/127.0.0.1 development is an exception.

The installed app uses the project icon and opens the shelf in a standalone window. Sign-in and a working server connection remain necessary. There is no Service Worker, offline cache, or offline reading.

## Troubleshooting

| Symptom                           | Check                                                                                                                           |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| No new downloads                  | Baseline established? Automatic downloads enabled? Older discoveries require manual enqueueing. Inspect failures/restrictions.  |
| Output unavailable                | Ask the administrator to restore the mount marker or selected directory. Watcher tasks remain queued; do not repeatedly submit. |
| Source unavailable/missing covers | Source URL, account, network, and whether a bundled or managed version is active.                                               |
| Live progress stops               | Reconnect or refresh for a snapshot. Ask the administrator to check SSE buffering/timeouts.                                     |
| Watcher lock occupied             | Only one watcher may use a shelf. Stop the other instance.                                                                      |
| Login required after restart      | Expected: sessions are held only in server memory.                                                                              |
