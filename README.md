# 小李工具箱

x-hub 本地效率工作台扩展：开发、计算、文本、加密、练习、PDF、图像、办公八组 **38 项小工具**，所有计算在本机完成，数据不出设备。

## 工具清单

| 分组 | 工具 | 功能说明 |
|---|---|---|
| 开发者 | JSON 格式化 | 格式化 / 压缩 / 语法校验 |
| | Base64 编解码 | 文本与文件互转 |
| | URL 编解码 | URL 组件级编解码 |
| | UUID 生成器 | 随机 UUID 生成与复制 |
| | JWT 查看器 | 解码查看头部与载荷 |
| | 二维码工具 | 生成（尺寸/容错/配色，中文）· 图片识别（自动放大重试、支持粘贴截图）· CSV 批量（ZIP 打包）；识别出链接可一键调起系统浏览器 |
| 计算器 | 体脂率 | BMI + 美国海军围度法 |
| | 时间戳 | 时间戳与日期互转 |
| | 房贷 | 等额本息 / 等额本金试算 |
| | 利息 | 单利 / 复利计算 |
| | 退休待遇测算 | 法定退休年龄（含延迟退休推算）+ 基础与个人账户养老金估算 |
| | 密码生成器 | 可配置字符集，密码学安全随机采样 |
| | 单位换算器 | 长度 / 质量 / 温度等 12 类即时换算 |
| 文本 | 文本统计器 | 字数与字符统计 |
| | 文本格式化 | 15 种操作，可撤销 |
| 加密 | 哈希摘要 | MD5 / SHA-1 / SHA-2，支持文件 ≤64MB |
| | HMAC | 消息认证码 |
| | AES-GCM 加解密 | PBKDF2 派生密钥，密文自带版本头可自解密 |
| | Hex 转换 | 文本与十六进制互转 |
| | 随机密钥生成 | 加密用随机密钥生成 |
| | 国密 SM2 / SM3 / SM4 | 密钥对与加解密 / 摘要与 HMAC（文件 ≤16MB）/ ECB 与 CBC |
| 练习 | 打字测试 | 中英文 / 中文长句 / 我的词库，WPM 与 CPM 计速、正确率，拼音输入法兼容 |
| | 打字词库 | 导入导出 / 合并去重，供打字测试「我的词库」模式出题 |
| PDF 文档 | PDF 合并 | 多选文件排序合并 |
| | PDF 拆分 | 区间提取（`1-3,7`）/ 逐页拆分 |
| | PDF 加页码 | 六方位，模板 `{n}/{m}` |
| | PDF 旋转 | 角度相对叠加，可归零 |
| | PDF 裁剪 | 边距比例 CropBox |
| | PDF 压缩 | 对象流重序列化 |
| | PDF 转图像 | 页码表达式 + 0.5x–3x 清晰度，逐页 PNG |
| 图像 | 图片格式转换 | PNG / JPEG / WebP，EXIF 方向自动纠正 |
| | 图片批量压缩 | 限边缩放 + 质量参数，逐张体积对比 |
| | 长图拼接 | 垂直 / 水平，间隔与背景可调 |
| | 智能颜色替换 | 画布取色 / 容差 / 羽化 / 色相匹配模式 |
| | 图片批量水印 | 文字水印平铺 / 角落 / 居中，字号自适应 |
| | 图标生成器 | 多尺寸 PNG + 多分辨率 ICO + ZIP 打包 |
| | 颜色空间对比 | HEX/RGB/HSL/HSV/CMYK/LAB + WCAG 对比度评级 |
| 办公 | PPTX 素材提取 | 逐页文本与图片，勾选打包 ZIP |

## 安装

1. 打开 x-hub → 扩展中心 →「**我的扩展**」标签页 → 添加本目录（须含 `manifest.json`）
2. **添加即加载**：改代码约 1.5 秒自动重载；移除目录即撤销
3. `module` 形态：到 设置 →「工作台 → 自定义布局」把「小李工具箱」卡片拖进网格

## 技术说明

- **运行时** `web`（纯前端，无 Node 后端）；**形态** `module + view`；**权限** `["fs", "open-url"]`（fs 当前用于导出保存：`saveAs` 弹另存为 / `saveFile` 直落下载目录；另预留路径读写能力的探测与调用——`openFiles` / `pickDirectory` / `readFile` / `saveTo` / `exists`，宿主支持时自动启用全功能；open-url 仅用于二维码识别结果的「打开链接」按钮调起系统浏览器——宿主 WebView 内 `target="_blank"` 被静默拦截，必须走 `xhub.openExternal`，用户点击才触发；存储走 `xhub.storage` 免权限，无网络 / 宿主数据访问）
- 主题：`--xhub-*` 变量 + 双声明 fallback（无宿主浏览器直开预览也正常显色）
- 无构建、无框架、无 CDN；第三方库（全部本地化在 `assets/`）：
  - `assets/md5.js`（blueimp-md5 2.19.0，MIT）
  - `assets/vendor/pdf-lib.min.js`（pdf-lib 1.17.1，Apache-2.0，UMD 全局 `PDFLib`，PDF 全部六项工具共用）
  - `assets/vendor/pdf.min.js` + `pdf.worker.min.js`（pdfjs-dist 3.11.174，Apache-2.0，**主线程模式**：worker 先加载注入 `window.pdfjsWorker`，不依赖 Worker/协议支持；PDF 转图像专用）
  - `assets/vendor/jszip.min.js`（jszip 3.10.1，MIT/MIT/GPLv3 三许可，PPTX 解包 / 图标 ZIP / 二维码批量 ZIP / 水印 ZIP 共用）
  - `assets/vendor/qrcode.js`（qrcode-generator 1.4.4，MIT；使用前切 `stringToBytesFuncs['UTF-8']` 保证中文）
  - `assets/vendor/jsQR.js`（jsQR 1.4.0，Apache-2.0，canvas 像素识别；小码自动放大重试）
  - `assets/vendor/sm-crypto.min.js`（sm-crypto 0.3.13 + jsbn 1.1.0，MIT，esbuild 打 IIFE 全局 `SMCrypto`；SM3 原生支持字节数组即文件摘要路径）

## 安全边界

- 密码生成：`crypto.getRandomValues` + 无模偏差采样（rejection sampling）
- AES-GCM：PBKDF2-SHA256 15 万次迭代派生，随机盐 16B + IV 12B，密文自带 `TK1:salt:iv:data` 版本头可自解密
- 国密：密钥对仅内存生成与显示，不写入任何存储；SM4 默认演示密钥仅供测试
- 加密工具的输入/密钥仅存在于内存，不写入任何存储
- 全部 38 项工具无网络请求；二维码识别、PDF 渲染等均为纯本地像素/字节操作
