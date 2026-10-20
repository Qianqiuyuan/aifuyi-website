# QUICKSTART — 打开、修改、发布

面向你自己改细节用。技术栈是**零依赖静态站**：一个 HTML、一份 CSS、两份 JS。没有构建、没有 npm install、没有框架。改完保存，刷新浏览器就生效。

---

## 1. 三种打开方式

### VS Code（最省事）

1. `File → Open Folder…` → 选 `site` 文件夹（不是文件的父目录以上）。
2. 右下角会弹「此工作区有推荐扩展」→ 装 **Live Server**。
3. 在 `index.html` 上右键 → **Open with Live Server**。
   端口已在 `.vscode/settings.json` 里锁成 `5173`，打开就是 `http://127.0.0.1:5173/`。
4. 想调试 JS：按 <kbd>F5</kbd>，会自动先起本地服务器再挂 Chrome 调试器（配置见 `.vscode/launch.json`）。

> 不要同时开 Live Server 和 `npm run dev`，两个都占 5173。

### IntelliJ IDEA

- **File → Open…** 选 `site` 文件夹。不要选 `New Project from Existing Sources`，不要选 Maven/Gradle 模板——它会当成普通文件夹打开，识别为 HTML/CSS/JS 项目。
- **IDEA Ultimate**：编辑器里打开 `index.html`，右上角会出现浏览器图标，点一下（或 `View → Open in Browser`）走内置服务器，地址形如 `http://localhost:63342/...`。改完按 <kbd>Ctrl</kbd>+<kbd>F5</kbd> 刷。
- **IDEA Community**：没有内置 Web 服务器，也没有 JS 补全。用下面「命令行」的方式起服务，然后在 IDEA 里正常编辑即可。
- 想让 IDEA 一键起服务：`Run → Edit Configurations → ＋ → npm`，`package.json` 选当前目录，`Command` 填 `run`，`Scripts` 填 `dev`。
- 编码统一：`Settings → Editor → File Encodings` 三个下拉全设 **UTF-8**（页面里有 `×`、`°`、`—`，编码错了会乱码）。

### 命令行 / 双击

```powershell
cd D:\deepseek\workspace\site

node tools\serve.mjs          # 推荐，零依赖
# 或
npm run dev                   # 同上
# 或（没有 Node）
python -m http.server 5173 --bind 127.0.0.1
```

也可以**直接双击 `index.html`**——页面没有 fetch 请求，`file://` 下完全正常。只是浏览器缓存较顽固，改 CSS 后常要 <kbd>Ctrl</kbd>+<kbd>F5</kbd>。

---

## 2. 目录与职责

```
site\
├─ index.html              页面结构：所有英文文案、图片、区块顺序
├─ assets\css\style.css    全部样式：颜色、字号、间距、响应式、打印版式
├─ assets\js\rfq.js        ★ 询价构建器：CONFIG、价格模型、摘要生成、邮件/WhatsApp 出口
├─ assets\js\site.js       导航、滚动显现、产品卡预设（RFQPreset）
├─ assets\img\             放你自己的图片（现在图片走 Cloudinary，也可改成放这里）
├─ tools\serve.mjs         本地预览服务器（零依赖，~120 行）
├─ .vscode\                VS Code 任务/调试/扩展推荐
├─ package.json            `npm run dev`
├─ .editorconfig           缩进 2 空格、LF、UTF-8
├─ README.md               技术说明：部署、SEO、图片替换、待接后端
└─ QUICKSTART.md           本文件
```

`index.html` 里区块顺序（用 `<!-- ░░░ 名字 ░░░ -->` 注释分隔，搜 `░░░` 可快速跳转）：

`hero` → `products` → `capabilities` → `factory` → `quality` → `process` → `rfq` → `faq` → `contact` → `footer`

---

## 3. 改什么 · 去哪里

| 想改的东西 | 文件 | 位置 | 注意 |
|---|---|---|---|
| 品牌主色（橙 `#FF5A1F`） | `style.css` | `:root` 里的 `--accent`、`--accent-soft` | `--accent-soft` 用的是 `rgba(255,90,31,.12)`，两处要一起改 |
| 深色底 / 纸白 | `style.css` | `:root` 的 `--bg`、`--paper` | 深浅两套变量在 `.sec-dark` 里被重映射，别只改一半 |
| **邮箱 / WhatsApp** | `rfq.js` | 文件顶部 `CONFIG` | WhatsApp **只写数字带国家码**，不要 `+`、空格、横线 |
| **起订量 / 上限** | `index.html` **和** `rfq.js` | HTML 第 07 步的 `data-group="qty"` 里那五个 `<button>`；JS 的 `CONFIG.moq`、`CONFIG.maxQty` | 两处都改。HTML 决定给买家看哪几档，CONFIG 决定自定义输入框拦不拦 |
| 是否显示价格区间 | `rfq.js` | `CONFIG.showBand` | 改 `false` 后摘要卡的价格块整体消失，其余照常 |
| 价格基数 | `rfq.js` | `MATERIAL` 表里每行的 `lo / hi / tool` | 单位是**基准规格下的美元/件**，不是你实际成本 |
| 数量折扣曲线 | `rfq.js` | `QTY_ANCHOR` | 数组是 `[数量, 系数]`，中间值对数插值 |
| **螺纹可用组合（如 M10 不能选 2.0）** | `rfq.js` | `PITCH_RULE` | 每个规格一个 `{ok:[…], note:'…'}`；`note` 会显示在选项下方，并作为禁用项的鼠标提示 |
| **质量模块轮播图** | `index.html` | `<ul class="car-track" id="carTrack">` 里的五个 `<li class="car-slide">` | 第一张是真实证书 `<img>`；后四张是 CSS 仿真的报告页。换真扫描件时把整个 `<div class="doc-card">…</div>` 换成 `<img src="…" alt="…">` 即可，箭头/圆点自动跟着数量走 |
| **工厂四图占比** | `style.css` | `.gal` 的 `grid-template-areas`（三档媒体查询各一份） | 四张图刻意不等大：`g1` 大图、`g2` 横条、`g3` 竖列、`g4` 宽底。想换顺序就改字母排布，不用动 HTML |
| **社交账号链接** | `index.html` | `<section id="contact">` 里的 `.soc-row` 三个 `<a>` | Facebook / Instagram / LinkedIn 各一条，`href` 换成对应主页即可 |
| 新增一个材质选项 | `index.html` **和** `rfq.js` | HTML 第 05 步加 `<button class="chip" data-v="…">`；JS 的 `MATERIAL` 加**同名 key** | 两处字符串必须逐字一致，否则该选项算不出价 |
| 新增螺纹 / 头型 / 长度 / 表面处理 | 只改 `index.html` | 第 02–06 步的 `.chips` 容器 | 只要 `data-v`，JS 不用动（除非你想让它影响价格） |
| 产品卡文案与图片 | `index.html` | `<section id="products">` 里四个 `<article class="card">` | 图片 URL 后面可加 `?w=640&f=auto&q=auto` 提速 |
| 产品卡按钮做什么 | `site.js` | `PRESETS` 对象 | key 要和 HTML 的 `onclick="RFQPreset('…')"` 对上 |
| 工厂 / 质量 / 流程 / FAQ 文案 | `index.html` | 各 `<section>` 的 `<header class="sec-head">` 和正文 | 纯文字替换，不用碰 CSS |
| 联系方式与页脚 | `index.html` | `<section id="contact">` 和 `<footer>` | 见下方「保持一致」 |
| 打印出来的规格书 | `style.css` | `@media print` 与 `.print-sheet` | 摘要卡打印时被渲染成 A4 询价单 |

---

## 4. 四个最常见的改动（照抄即可）

### ① 换成企业邮箱（**上线前必做**）

现在用的是个人 Gmail，欧美买家看到会直接降信任。四处都在，建议全局搜索替换：

```powershell
# 在 site 目录下，先看有多少处：
Select-String -Path index.html,assets\js\rfq.js -Pattern "wenhui452324"
```

需要同步的 4 处：

1. `index.html` JSON-LD 里的 `"email"`（约第 39 行）
2. `index.html` contact 区的 `<a href="mailto:…">`（约第 523 行）
3. `rfq.js` 的 `CONFIG.email`
4. 同一个 `CONFIG` 旁边的 `whatsapp`（如果你换了号码）

换完在浏览器里点一次 “Send by email”——现在会弹出菜单，选 Gmail / Outlook / 默认邮件客户端，收件人和正文都已预填好（邮件主题带询价编号 `RFQ-…`）。

### ② 把价格区间调成你自己的数

`rfq.js` 的 `MATERIAL` 是**占位数字**。做法：

1. 先挑一个「基准规格」——建议固定为 `M14×1.5 / 球面 R14 / SCM435 12.9 / 锌铝涂层 / 3,000 件`。
2. 用你真实的成本+目标毛利，算出这个基准规格的**单件美元价**，填成 `lo`（下限）和 `hi`（上限）。`hi / lo` 保持在 1.4 左右，别做太窄。
3. `tool` 是该材质的模具难度系数，只有相对意义，不动也行。
4. 自测：打开页面，选基准规格 + 3,000 件，看 `sumBand` 是否落在你预期的数。
5. 控制台可以直读（规格与螺距是两个字段，别再写 `thread`）：

```js
RFQ.set('size','M14'); RFQ.set('pitch','1.5');
RFQ.set('material','SCM435, class 12.9');
RFQ.set('qty','3 000');
RFQ.band();      // → {unitLo, unitHi, toolLo, toolHi, totalLo, totalHi}
RFQ.mailto();    // → 完整的 mailto: 链接，可直接粘到浏览器地址栏验证
```

### ③ 加一张产品卡

在 `<section id="products">` 的 `<div class="cards">` 里，复制一个 `<article class="card" data-reveal>…</article>` 整块，改三样：

```html
<img src="…" alt="用英文写，给 Google 和读屏软件看" loading="lazy" width="640" height="640">
<h3>Rain wipers</h3>
<p>…</p>
<button class="link" type="button" onclick="RFQPreset('wiper')">Request a quote →</button>
```

然后在 `site.js` 的 `PRESETS` 里补一条，否则按钮点了只滚动不填内容：

```js
'wiper': { product: 'Other custom fastener', notes: 'Rain wiper set. Drawing to follow.' }
```

> 主业务线是轮毂螺栓。雨刮/洗车/坐垫这些建议等主业务跑顺了再加，页面已经预留了位置。

### ④ 加一条 FAQ

`<section id="faq">` 里照抄一个 `<details>` 块：

```html
<details>
  <summary>Can you ship to a forwarder in Shenzhen?</summary>
  <p>Yes. Give us the forwarder address and we ship FOB there; you handle the ocean leg.</p>
</details>
```

---

## 5. 三处必须保持一致的「联动点」

改错这三处，页面不报错但会静默失效——这是纯静态站最容易踩的坑。

| 联动 | 位置 A | 位置 B | 失效表现 |
|---|---|---|---|
| 材质选项 | `index.html` 的 `data-v="40Cr, class 10.9"` | `rfq.js` 的 `MATERIAL['40Cr, class 10.9']` | 选了材质但价格不出来、摘要里缺这一行 |
| 产品卡按钮 | `onclick="RFQPreset('wheel-bolt')"` | `site.js` 的 `PRESETS['wheel-bolt']` | 点了只滚动，不预填 |
| 联系信息 | `index.html`（JSON-LD / contact / footer） | `rfq.js` 的 `CONFIG` | 邮件发到旧地址，或者两处号码不一致 |

速查：改完在控制台跑 `RFQ.text()`，看生成的询价文本是否完整、每个字段都有值、没有 `—`。

---

## 6. 控制台调试速查

页面加载后在 DevTools Console 里：

```js
RFQ.config                 // 看当前邮箱/WhatsApp/MOQ/showBand
RFQ.state                  // 看当前选择
RFQ.set('product','Wheel nut')   // 直接设定某一项（会触发重绘）
RFQ.band()                 // 看算出来的价格区间
RFQ.text()                 // 看最终要发出去的纯文本
RFQPreset('wheel-bolt')    // 测产品卡预设
```

调试小技巧：临时加 `?debug` 不生效——没有这个开关。想快速定位某段样式，直接改 CSS 里的 `outline:1px solid red`，别装工具。

---

## 7. 上线前必做 5 件事

1. **换企业邮箱**（见 ①）——这一条比其它四条加起来都重要。
2. **校准价格区间**（见 ②），或者干脆把 `showBand` 改 `false` 先不显示数字。
3. **换成本地图片**：现在图片是 Cloudinary 外链，能用，但用自己的域名更稳。下载原图放进 `assets\img\`，把 `src` 改成 `assets/img/xxx.webp`，顺手压到 640px 宽、WebP。
4. **量一次真实加载**：DevTools → Network → 关掉缓存刷新，看总大小。当前 HTML+CSS+JS 不到 100 KB，大头是图片。
5. **手机上看一遍**：DevTools 切 iPhone 12 / Pixel 5，重点看询价区的 chips 有没有挤成两行破版。

发布就三步：把 `site` 里除 `.vscode`、`tools`、`*.md` 以外的文件传到主机 `www` 根目录即可。详细部署（Netlify / Cloudflare Pages / 国内主机 / HTTPS）见 `README.md`。

---

## 8. 建议的版本管理

```powershell
cd D:\deepseek\workspace\site
git init
git add .
git commit -m "initial: AIFUYI site"
```

`.gitignore` 已经写好（忽略 `.idea/`、`node_modules/`、`*.zip`）。以后每次改完先 `git commit`，改坏了 `git restore .` 就能回滚——纯静态站没有构建步骤，回滚成本为零。

---

## 9. 这版没有、但你可能想要的

按你之前提的顺序排的优先级：

1. **企业邮箱 + 域名邮**（`@yhaifuyi.com`）——信任度的起点。
2. **表单后端**：现在询价是「生成文本 → 交给买家自己的邮件/WhatsApp」，你不留痕。接一个 Formspree / 自建 PHP，`rfq.js` 的 `CONFIG.endpoint` 填上就行，代码已预留。
3. **产品图本地化 + WebP**，以及轮毂螺栓的**尺寸示意图**（买家最常问的就是 seat 和 length 到底量哪里）。
4. **多语言（德/意）**：目标市场是美德意阿联酋，德语页对德国改装店是加分项。
5. **案例页**：3–5 个真实订单（车型 + 规格 + 交期），比任何文案都有效。
