# PDF 合并与打印工具（纯前端）

本项目为纯前端 PDF 合并与打印工具，文件仅在浏览器本地内存中处理，不上传服务器。

## 快速开始（本地）

- 方式一：直接打开
  - 双击 index.html 用 Chrome/Edge 打开即可使用。

- 方式二：本地静态服务器（可选其一）
  - Node:
    - npx serve ./pdf-merge-print -p 5173
    - 打开 http://localhost:5173
  - Python:
    - cd pdf-merge-print
    - python -m http.server 5173
    - 打开 http://localhost:5173
  - PowerShell 简易：
    - cd pdf-merge-print
    - 启动命令同上（建议 Python/Node 任一）

提示：某些浏览器直接 file:// 打开也可用；如遇到预览异常，建议使用本地服务器方式。

## 功能说明

- 多个 PDF 文件选择/拖拽添加
- 文件排序（上移/下移）、删除
- 按顺序合并为单个 PDF
- 合并结果预览、下载、打印
- 数据不出本地浏览器

## 部署到服务器

### 1) 使用 Docker（推荐）

在项目根目录执行：
- docker build -t pdf-merge-print .
- docker run -d -p 8080:80 --name pdf-merge pdf-merge-print
- 浏览器访问：http://服务器IP:8080

### 2) 使用 Nginx（裸机/云主机）

- 将整个 pdf-merge-print 目录上传到服务器，如 /var/www/pdf-merge-print
- 使用本仓库提供的 nginx.conf 作为站点配置（或合并到你的全局配置）
- 关键点：
  - root 指向包含 index.html 的目录
  - 为 .pdf 设置正确的 Content-Type: application/pdf
  - 可开启 gzip 静态压缩

参考（已在 nginx.conf 提供）：
- root /usr/share/nginx/html;
- index index.html;

### 3) 静态托管（对象存储或前端平台）

- 直接将 pdf-merge-print/ 目录上传至：
  - 对象存储（COS/OSS/OBS）+ CDN
  - GitHub Pages（将目录内容放在 gh-pages 分支）
  - Vercel/Netlify（作为静态站点部署）

## 目录结构

- pdf-merge-print/
  - index.html        主页面（已可用）
  - README.md         文档（本文件）
  - Dockerfile        Nginx 静态托管镜像
  - nginx.conf        最小化 Nginx 站点配置
  - .dockerignore     Docker 构建忽略

## 常见问题

- 预览空白或打印异常：
  - 先尝试通过本地静态服务器访问（避免浏览器对 file:// 的限制）
  - 更换浏览器（Chrome/Edge）
- 合并很慢或浏览器卡顿：
  - 大体积/超多页 PDF 在浏览器内处理较耗内存与 CPU，可分批合并或使用更高配置的设备
- 离线使用：
  - 当前依赖 pdf-lib 的 CDN。若需要完全离线，请将 pdf-lib 改为本地文件并本地引用（我可以为你添加）。

## 许可证

个人与企业内部使用均可。请自行保证使用中的文档隐私与合规。