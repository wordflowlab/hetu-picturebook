# 河图绘本工坊

> 围绕固定作品和图片编排绘本跨页、图文节奏与毫米版面，检查并交付离线阅读本和嵌字PDF。

## 简介

绘本工坊是独立TypeScript／React河图插件。外部Agent通过河图稳定CLI/MCP发现并调用，作者在工作面阅读、比较、反馈；作品正文和正式决定由宿主管理。

## 快速上手

安装河图插件中心提供的固定运行包，再向当前Agent说明本次作品与目标。先发现当前安装版能力，再读取包内`hetu-picturebook`方法和已有工程。

读取固定故事与图像→组织页序和翻页意图→编排图文框→跨页通读→检查实际字体与图片→表达固定页意见→返工新修订→导出HTML与PDF。

## 开发

Node.js 25，固定依赖见`package-lock.json`。

```bash
npm ci
npm run build
npm run check
npm run test:unit
npm run test:machine
npm run test:ui
npm run package
```

机器与界面验收使用`acceptance-lock.json`固定的正式宿主；完整步骤见[开发与发布](docs/07-开发发布与维护.md)。

## 边界

正文与固定图像归宿主。本包维护最多32页的绘本专业工程；读取PNG/JPEG，图像合计8MiB、单图2MiB。导出RGB PDF与离线HTML，嵌入固定中文字体。毫米、出血、安全区与实际字体度量可验证；不承诺印厂认证、CMYK/PDF-X、儿童理解程度或生成质量。缺图、缺页、文字溢出及缺字阻止PDF交付。

## 文档

[功能清单](CAPABILITIES.md) · [产品与开发文档](docs/README.md) · [验收记录](docs/08-实施计划与验收记录.md)。
