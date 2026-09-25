# 小李工具箱（com.avalonlee.toolkit）

x-hub 本地效率工作台扩展：开发、计算、文本、加密、练习、PDF、图像、办公八组 **38 项小工具**，所有计算在本机完成，数据不出设备。

## 工具清单（v1.2.1 / P0 + P1-a + P2 全量 + 交互增强批次）

| 分组 | 工具 |
|---|---|
| 开发者 | JSON 格式化 · Base64 编解码 · URL 编解码 · UUID 生成器 · JWT 查看器 · 二维码工具（生成/识别/CSV 批量） |
| 计算器 | 体脂率（BMI + 美国海军围度法） · 时间戳 · 房贷（等额本息/本金） · 利息（单利/复利） · 退休待遇测算（含延迟退休推算） · 密码生成器 · 单位换算器（12 类） |
| 文本 | 文本统计器 · 文本格式化（15 种操作，可撤销） |
| 加密 | 哈希摘要（MD5/SHA-1/SHA-2，支持文件 ≤64MB） · HMAC · AES-GCM 加解密 · Hex 转换 · 随机密钥生成 · 国密 SM2/SM3/SM4 |
| 练习 | 打字测试（中英文/中文长句/**我的词库**、WPM/CPM、正确率、IME 输入法兼容） · 打字词库（导入导出/合并去重） |
| PDF 文档 | 合并（多选排序） · 拆分（区间提取/逐页拆分） · 加页码（六方位，模板 {n}/{m}） · 旋转（角度相对叠加） · 裁剪（边距比例 CropBox） · 压缩（对象流重序列化） · PDF 转图像（逐页 PNG） |
| 图像 | 格式转换（PNG/JPEG/WebP，EXIF 方向自动纠正） · 批量压缩（限边缩放 + 降质，逐张对比） · 长图拼接（垂直/水平，间隔背景可调） · 智能颜色替换（画布取色/容差/羽化/色相模式） · 图片批量水印（平铺/角落/居中） · 图标生成器（多尺寸 PNG + 多分辨率 ICO + ZIP） · 颜色空间对比（HEX/RGB/HSL/HSV/CMYK/LAB + WCAG 对比度） |
| 办公 | PPTX 素材提取（逐页文本 + 图片引用，勾选打包 ZIP） |

## 安装（真机调试）

1. 打开 x-hub → 扩展中心 →「**我的扩展**」标签页 → 添加本目录（须含 `manifest.json`）
2. **添加即加载**：改代码约 1.5 秒自动重载；移除目录即撤销
3. `module` 形态：到 设置 →「工作台 → 自定义布局」把「小李工具箱」卡片拖进网格

## 技术说明

- **运行时** `web`（纯前端，无 Node 后端）；**形态** `module + view`；**权限** `["fs", "open-url"]`（fs 当前用于导出保存：`saveAs` 弹另存为 / `saveFile` 直落下载目录；另预留路径读写能力的探测与调用——`openFiles` / `pickDirectory` / `readFile` / `saveTo` / `exists`，宿主支持时自动启用全功能；open-url（v1.2.1 新申报）仅用于二维码识别结果的「打开链接」按钮调起系统浏览器——宿主 WebView 内 `target="_blank"` 被静默拦截，必须走 `xhub.openExternal`，用户点击才触发；存储走 `xhub.storage` 免权限，无网络 / 宿主数据访问）
- 主题：`--xhub-*` 变量 + 双声明 fallback（无宿主浏览器直开预览也正常显色）
- 无构建、无框架、无 CDN；第三方库（全部本地化在 `assets/`）：
  - `assets/md5.js`（blueimp-md5 2.19.0，MIT）
  - `assets/vendor/pdf-lib.min.js`（pdf-lib 1.17.1，Apache-2.0，UMD 全局 `PDFLib`，PDF 全部六项工具共用）
  - `assets/vendor/pdf.min.js` + `pdf.worker.min.js`（pdfjs-dist 3.11.174，Apache-2.0，**主线程模式**：worker 先加载注入 `window.pdfjsWorker`，不依赖 Worker/协议支持；PDF 转图像专用）
  - `assets/vendor/jszip.min.js`（jszip 3.10.1，MIT/MIT/GPLv3 三许可，PPTX 解包 / 图标 ZIP / 二维码批量 ZIP / 水印 ZIP 共用）
  - `assets/vendor/qrcode.js`（qrcode-generator 1.4.4，MIT；使用前切 `stringToBytesFuncs['UTF-8']` 保证中文）
  - `assets/vendor/jsQR.js`（jsQR 1.4.0，Apache-2.0，canvas 像素识别；小码自动放大重试）
  - `assets/vendor/sm-crypto.min.js`（sm-crypto 0.3.13 + jsbn 1.1.0，MIT，esbuild 打 IIFE 全局 `SMCrypto`；SM3 原生支持字节数组即文件摘要路径）

### P2 新增工具要点（v1.2.0）

- **单位换算器**：长度/质量/温度/面积/体积/速度/时间/数据/压力/能量/功率/角度 12 类，结果表全单位列出、点击行复制；温度以摄氏中转（C/F/K/R）
- **智能颜色替换**：点击画布取源色，RGB 距离 / 色相匹配（抗光照不均）双模式，容差 + 边缘羽化可调，按原始分辨率导出 PNG
- **图标生成器**：圆角 / 内边距 / 背景色 / 镜像，8 档尺寸勾选（16–512），手写 PNG-in-ICO 容器（Vista+，256px 记宽 0）出 favicon.ico，可 ZIP 打包
- **颜色空间对比**：HEX/RGB/HSL/HSV/CMYK/CIELAB/相对亮度全解析 + 两色 WCAG 对比度评级（AA/AAA、正文字/大字）
- **二维码工具**：单条生成（尺寸/静区/容错/配色，中文 UTF-8）· 图片识别（原图失败自动放大 2x/3x 重试，支持粘贴截图；识别出 http 链接可一键「打开链接」调起系统浏览器）· CSV 批量（每行 `内容[,文件名]`，ZIP 下载）
- **PPTX 素材提取**：仅 `.pptx`（Office Open XML），逐页列文本段落与图片引用（rels 过滤非 image），勾选打包 ZIP；旧版二进制 .ppt 不支持
- **国密**：SM2 密钥对/加解密（C1C3C2 与 C1C2C3）/签名验签（DER+SM3）；SM3 文本/文件摘要 + HMAC（文件 ≤16MB）；SM4 ECB/CBC + PKCS#7
- **打字词库**：每行一条，保存后打字测试新增「我的词库」模式随机出题；支持 .txt 合并导入（去重）与导出
- **PDF 转图像**：页码表达式（`1-3,7,10-`）+ 清晰度 0.5x–3x，逐页渲染 PNG 缩略预览，单页下载或 ZIP 打包
- **图片批量水印**：文字水印平铺/四角+中心/居中，字号随图幅自适应，透明度/旋转/密度/描边可调，PNG 或 JPEG 批量导出

### 输入与输出链路（v1.1.1 统一交互，fs 权限）

**输入（双通道，全部 PDF/图像工具统一）**

- 点击选择：宿主提供路径选择能力（`fs.openFiles`）时弹系统对话框并拿到**完整路径**（据此可回写源目录）；当前基座 / 无宿主时降级浏览器 `<input type=file>`
- 拖拽上传：拖放区直接 `drop` 事件接文件；无路径信息时输出自动回退下载目录
- 转换类工具（格式转换 / 批量压缩）为**两段式**：选择文件仅做解码校验预览，用户点「开始转换」才执行

**个性化（v1.1.2，storage 持久化、跨会话记忆）**

- **分组顺序自调**：侧栏分组标题 hover 显现 ↑/↓ 按钮，点击调整八组顺序（侧栏与概览分组同步生效）；未手动排序时按目录默认顺序
- **概览钉住**：打开任意工具后点标题右侧图钉（实心 = 已钉），概览顶部生成「钉住的工具」快捷区，点击直达；卡片右上 ✕ 或再次点图钉取消；未钉时概览显示小贴士引导

**输出（统一 `saveOutputs` 链路）**

- 输出目录三选（跨会话记忆）：`源文件所在目录`（默认）/ `自定义目录`（`fs.pickDirectory`）/ 系统下载目录——前两项需宿主路径读写能力，**当前基座下自动置灰**，输出统一落下载目录
- 输出文件名默认加后缀（如 `01_converted.png`、`01_q80.webp`）
- 同名冲突三选：**覆盖** / **重命名**（弹层输入框预填原名，可勾选「本批后续冲突应用相同策略」自动加序号）/ **取消**
- 无宿主（浏览器预览模式）时降级 `a[download]` 下载
- **兼容性（扩展自适配，不挑宿主版本）**：能力按方法存在性逐个检测（`HAS_PATH` = openFiles+readFile+saveTo+exists，`HAS_DIR` = pickDirectory）。无对应能力的宿主（含当前基座）下：拖拽、点击选择、两段式确认照常；源目录/自定义目录选项自动置灰，输出统一落下载目录（宿主 `saveFile` 自带重名去重），不报错、不中断
- PDF 处理对加密文件自动降级 `ignoreEncryption` 加载并标注「已加密」徽标（处理结果可能受限）
- **P2 新工具输出链路**：P2 十项统一走浏览器 `a[download]`（对象 URL 4 秒回收），未接入 `saveOutputs` 目录选择——设计上这些工具都是「生成 → 下载」型，与宿主输出目录能力正交，后续可按需统一

### 发布预检说明

- 代码中 `fs.openFiles` / `fs.pickDirectory` / `fs.readFile` / `fs.saveTo` / `fs.exists` 为**预留能力探测**（配合 `HAS_PATH` / `HAS_DIR` 运行期检测与自动降级）：本地预检可能报若干条「用到了宿主没实现的桥 API」**warn**，属预期、不阻塞发布；`fs` 权限对账无 error。
- `open-url` 权限（v1.2.1 新申报）：对应 `qrcode.js` 的 `xhub.openExternal` 调用，仅用户点击「打开链接」时触发，无自动外联。
- 版本号单一来源 = `assets/catalog.js` 的 `version` 字段 + 本 `manifest.json`；侧栏品牌区版本号由 app.js 从 catalog 动态填充。
- headless 回归：`tests/toolkit-p1a-test.html`（32 断言）与 `tests/toolkit-p2-test.html`（51 断言）均应 SUMMARY 0 failed（p1a 的 TIMEOUT 兜底与 SKIP loadImageFromBytes 为 virtual-time 环境已知现象，真机验收覆盖）。

### v1.2.1 发布预检修复（2026-09-25）

- **P0** 图片水印默认文字中性化（原为硬编码企业名，外部用户首次打开可见）
- **P0** 二维码识别「打开链接」改走 `xhub.openExternal`（原 `target="_blank"` 在宿主 WebView 内被静默拦截），manifest 相应新增 `open-url` 权限
- **P1** `img.js` saveOutputs 重试计数 `guard` 作用域缺陷（循环结束后引用 `let` 循环变量必抛 ReferenceError，此前被基座无路径能力掩盖）——随共享设施重构一并修复
- **P1** 二维码占位文字 `fillStyle` 弃用 CSS 变量（Canvas 2D 不解析 `var()`，白底占位文字原不可见）
- **P1** 打字测试切换工具时清理 200ms 统计计时器（render 返回 cleanup 函数，由 Toolkit.open 调用）
- **P1** PPTX 提取操作按钮行幂等化（重复载入文件不再累加按钮）
- **P2** `img.js` / `pdf.js` 约 280 行重复 IO 设施抽取为 `view/tools/_shared.js`（view/index.html 与两测试页 script 清单同步）；剔除死代码：恒真 `HAS_FS` 分支、未读取的 `dataset.mode`、未使用的 `MAX_SAVE`；catalog 文案修正（单位换算 12 类）；文本格式化删除恒假条件；HMAC 空密钥拦截与提示语对齐；颜色替换 / 图标生成补 `imageOrientation: 'from-image'` EXIF 方向纠正

### vendor 补丁记录

`assets/md5.js` 在原版 UMD 尾部追加了 **raw 字节接口**（`md5.raw(latin1String)` / `md5.rawHMAC`）：

> 原版 `md5(str)` 内部强制 `unescape(encodeURIComponent(str))` 做 UTF-8 预处理，无法对任意二进制字节求摘要（Latin-1 字符串会被二次 UTF-8 编码）。补丁暴露内部 `rstrMD5`，供文件摘要使用，输出与 `md5sum` 等标准工具一致（已用 1MB 随机数据对拍验证）。

若日后升级该库，需重打此补丁。

`assets/vendor/sm-crypto.min.js` 由 `npm pack sm-crypto@0.3.13` + `jsbn@1.1.0` 经 esbuild `--format=iife --global-name=SMCrypto` 打包（CJS→浏览器全局）；SM3 对字符串做 UTF-8 编码、对**数组入参**按原始字节处理——文件摘要直接 `sm3(Array.from(bytes))`，无需补丁。已用 GB/T 标准向量（SM3("abc") = 66c7f0f4…）+ 往返测试验证。

## 安全边界

- 密码生成：`crypto.getRandomValues` + 无模偏差采样（rejection sampling）
- AES-GCM：PBKDF2-SHA256 15 万次迭代派生，随机盐 16B + IV 12B，密文自带 `TK1:salt:iv:data` 版本头可自解密
- 国密：密钥对仅内存生成与显示，不写入任何存储；SM4 默认演示密钥仅供测试
- 加密工具的输入/密钥仅存在于内存，不写入任何存储
- 全部 38 项工具无网络请求；二维码识别、PDF 渲染等均为纯本地像素/字节操作

## Roadmap

- ~~v1.2（P1-b + P2）：~~ 已随 v1.2.0 全量落地（PDF 转图像、PPTX 提取、颜色三件套、二维码、国密、词库、水印、单位换算）
- 后续候选：工作台 module 卡多形态；PDF 转图像接入 `saveOutputs` 目录选择；二维码批量接入 CSV 导入文件
