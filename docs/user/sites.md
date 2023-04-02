# Site Introductions

If a site requires you to log in to access to its contents, first log in to the website, open the Network inspector (F12 for mainstream browsers) and get your auth info from the request header.

For cookie its in the `request.headers["Cookie"]`

For token its normally `request.headers["Authorization"]` or another header entry starting with `x-` and has a encrypted string as its value.

## [Zerobyw](https://zerobyw.github.io/)

`version 1.0.0`

Zerobyw is a pirate site where contents are manually updated by its maintainer, casually and brutally (they delete the original post and create a new post each time they update a serie).

Still zerobyw provides its contents with care, images are normally not compressed, some of them may be randomly watermarked, and each serie provides Chinese translated chapters and original Japanese version, and priorly published issues than magazine versions.

As of today, you need to login to get access to most of contents, and some of the contents are behind the paywall (5 RMB per month).

## [Copymanga](https://www.copymanga.site/)

`version 2.0.0`

Copymanga is a pirate site where contents are likely maintained by the community and translators. Serie are well managed under their ids.

Copymanga provides only Chinese translated chapters. The entire site is free with ads.

The intended way to use copymanga is using their website and mobile apps, both of which are painful to use.

**Important: Copymanga is known to have [sent horrifying images to Tachiyomi users](https://github.com/tachiyomiorg/tachiyomi-extensions/issues/12377), please use it at your own risk.**

Copymanga provides images in webp and jpg format, you can set the preferred format by `options.format`, but both of them are cropped to 800px in width.

## [Ganma](https://ganma.jp/)

`version 2.1.0`

Ganma is a non-pirate site where contents are behind the paywall (680 JPY monthly), you need a subscription purchased via Google Play Store and App Store and link it to your Ganma account.

Ganma provides official Japanese manga series.

This module will be maintained for as long as my Ganma subscription lasts.
