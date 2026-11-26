import { Buffer } from 'node:buffer';

const workId = 'demo';
const chapter = {
  id: 'welcome',
  title: 'Welcome',
  async getPages(signal) {
    signal.throwIfAborted();
    return [
      {
        id: 'cover',
        extension: 'gif',
        async read(signal) {
          signal.throwIfAborted();
          return Buffer.from(
            'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
            'base64',
          );
        },
      },
    ];
  },
};

/** @type {import('comic-dl/extension').SourceExtension} */
const extension = {
  apiVersion: 1,
  id: 'hello',
  create() {
    return {
      id: 'hello',
      async getSeries(input, signal) {
        signal.throwIfAborted();
        if (input !== workId) {
          throw new Error('Expected series ID: demo');
        }
        return { id: workId, chapters: [chapter] };
      },
      async getChapter(input, signal) {
        signal.throwIfAborted();
        if (input !== chapter.id) {
          throw new Error('Expected chapter ID: welcome');
        }
        return { workId, chapter };
      },
    };
  },
};

export default extension;
