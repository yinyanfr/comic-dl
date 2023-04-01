# Creating a new module

```
This documentation is under construction.
```

## Quick Start

```bash
git clone https://github.com/yinyanfr/comic-dl.git
# or fork and clone your fork
cd comic-dl
npm i
npm run build
npx . gen -n mySite
```

Your module template is generated at `src/modules/mySite`.

- `index.ts` is the main source code.
- `index.d.ts` is for your API data structure, you can ignore or delete it if you are not using it.

The generated `index.ts` file will look like this:

```typescript
export default class MySiteDownloader extends ComicDownloader {
  static readonly siteName = "mySite";

  static canHandleUrl(url: string): boolean {
    return /mySite/.test(url);
  }

  constructor(protected destination: string, protected configs: Configs = {}) {
    super(destination, configs);
  }

  async getSerieInfo(url: string): Promise<SerieInfo> {
    throw new Error("Method not implemented.");
  }
  protected async getImageList(url: string): Promise<(string | null)[]> {
    throw new Error("Method not implemented.");
  }
}
```

### siteName

`static siteName` is the module identifier for CLI (`-m, --module` flag).

### canHandleUrl

`static canHandleUrl` is the rule to determine if a serie url is to be handled by this module.

Normally it would be `new Regexp("your_site_base_url").test(url)`.

This method is optional, but without which your module can't handle a url in CLI without explicitly specifying the module name.

### constructor

`constructor` is the initialization function, where you can configurate your module with configs.

`constructor` is optional too, you can delete it if you are not using it, as it works the same way.

### getSerieInfo

`getSerieInfo` is the function that returns the title, chapters and other informations of a serie.

For detail please read (TODO)

### getImageList

`getImageList` is the function that returns an array of image URLs.

For detail please read (TODO)
