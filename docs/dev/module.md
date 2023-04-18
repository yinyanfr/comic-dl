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
npx . gen --module mySite
```

Your module template is generated at `src/modules/mySite`.

- `index.ts` is the main source code.
- `index.d.ts` is for your API data structure, you can ignore or delete it if you are not using it.
- the default export of your module is appended to `src/modules/index.ts`, if you change the name of the module, please modify this file as well.

The generated `index.ts` file will look like this:

```typescript
export default class MySiteDownloader extends ComicDownloader {
  static readonly siteName = 'mySite';

  static canHandleUrl(url: string): boolean {
    return /mySite/.test(url);
  }

  constructor(protected destination: string, protected configs: Configs = {}) {
    super(destination, configs);
  }

  static readonly preferredCLIPresets: Partial<CliOptions> = {};

  async getSerieInfo(url: string): Promise<SerieInfo> {
    throw new Error('Method not implemented.');
  }
  protected async getImageList(url: string): Promise<(string | null)[]> {
    throw new Error('Method not implemented.');
  }
}
```

### siteName

`static siteName` is the module identifier for CLI (`-m, --module` flag).

### canHandleUrl

`static canHandleUrl` is the rule to determine if a serie url is to be handled by this module.

Normally it would be `new Regexp("your_site_base_url").test(url)`.

This method is optional, but without which your module can't handle a url in CLI without explicitly specifying the module name.

### preferredCLIPresets

`static preferredCLIPresets` is the presets to be generated when using `gen --presets` command.

Please note that this only serves as a template and is not taken as the default configs or options of this module.

### urlCompletion

`static urlCompletion` is used to complete a shorthand Url.

### constructor

`constructor` is the initialization function, where you can configurate your module with configs.

`constructor` is optional too, you can delete it if you are not using it, as it works the same way.

### getSerieInfo

`getSerieInfo` is the function that returns the title, chapters and other informations of a serie.

For detail please read (TODO)

### getImageList

`getImageList` is the function that returns an array of image URLs.

For detail please read (TODO)
