# comic-dl

- 这是 TypeScript 从零重写，不是旧 `ComicDownloader` 的迁移。不要假定旧站可用或复用 Kindlegarten 的 GUI。
- 保留下载服务和漫画源适配器的边界：站点识别、认证和解析留在源侧，下载编排、输出和界面不要塞回同一个基类。核心验证不依赖真实漫画站。
- 跟随 `.node-version` 使用 Node.js 24。原生 Node ESM + TypeScript `NodeNext`，相对模块导入写运行时 `.js` 扩展名；`dist/` 由 `npm run build` 生成。
- `npm ci` 后用 `npm run check` 检查格式、lint 和类型。CI 还执行 `npm run build` 和 `node dist/index.js`；Husky 仅检查暂存文件，不能代替完整检查。
