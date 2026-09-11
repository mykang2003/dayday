---
AIGC:
    Label: "1"
    ContentProducer: 001191440300708461136T1XGW3
    ProduceID: 1a300a8922dd88c733a80eae5c41e5e1_6fcabd9aada811f188ac525400dcc5b3
    ReservedCode1: Yj93deQU3hrkMxfmYZjQQVjGnUB7StA1PSLah1iBaGZfJSSrh7AjrcEEByjtXqtBPH5c1Yu5DI3IFbBMuRUrouB1t+XsjIUHFopokeVZKWbY8Dde9bOwXtBrH/5++wcoBvIuR2ZLC1SipwafLx8q1+TkF8ZHXSfx303ijnr3BUcS06NnEqrENN3JgUs=
    ContentPropagator: 001191440300708461136T1XGW3
    PropagateID: 1a300a8922dd88c733a80eae5c41e5e1_6fcabd9aada811f188ac525400dcc5b3
    ReservedCode2: Yj93deQU3hrkMxfmYZjQQVjGnUB7StA1PSLah1iBaGZfJSSrh7AjrcEEByjtXqtBPH5c1Yu5DI3IFbBMuRUrouB1t+XsjIUHFopokeVZKWbY8Dde9bOwXtBrH/5++wcoBvIuR2ZLC1SipwafLx8q1+TkF8ZHXSfx303ijnr3BUcS06NnEqrENN3JgUs=
---

# 和你第N天 · ourdays

一个纯静态的情侣纪念日 H5 小站：记录和你在一起的每一天。无需注册、无需后端，所有数据仅保存在本机浏览器。

## 功能概览

| 模块 | 说明 |
|---|---|
| 首次引导 onboarding | 录入两人昵称与"在一起"日期，进入后即为第 1 天 |
| 首页 home | 在一起天数大数字（长位数自适应排版）+ 下一个纪念日倒计时 |
| 时间轴 story | 按时间倒序浏览全部回忆 |
| 相册 album | 本地图片网格、灯箱查看、左右滑动切换 |
| 纪念日 anniv | 自定义纪念日列表与倒计时 |
| 新建回忆 memory-new | 标题 / 日期（自定义日历）/ 正文 / 配图 |
| 回忆详情 memory-detail | 单条回忆的完整内容与配图 |
| 我的 profile | 昵称、在一起日期（可修改，异常日期会标注提醒） |
| 分享海报 share | 生成 750×1200 海报，支持下载 / 长按保存 |
| AI 文案助手（可选） | 需自行填写 OpenAI 兼容 API 基址与密钥，不填不影响其它功能 |

## 目录结构

```
ourdays/
├─ index.html          入口页面（必须保留此文件名，位于仓库根目录）
├─ .nojekyll           跳过 GitHub Pages 的 Jekyll 处理（空文件）
├─ README.md
├─ css/
│  └─ style.css
└─ js/                 14 个脚本，按 index.html 中的顺序加载
   ├─ core.js  ui.js  datepicker.js  ai.js  share.js  shareview.js
   ├─ onboarding.js  home.js  timeline.js  album.js
   └─ memory.js  anniversary.js  profile.js  app.js
```

全部引用均为相对路径，无构建步骤、无 Node/服务端运行时依赖，双击 `index.html` 即可本地运行。

## 部署到 GitHub Pages

### 方式一：网页上传（无需命令行）

1. 登录 GitHub，右上角 **New repository**，仓库名如 `ourdays`，可见性选 **Public**，创建。
2. 进入仓库，点 **Add file → Upload files**。
3. 把 `index.html`、`.nojekyll`、`README.md` 与 `css/`、`js/` 两个文件夹一起拖入（**保持原有目录结构**，注意 `.nojekyll` 是隐藏文件，需先在文件管理器开启"显示隐藏文件"再一起选中）。
4. 填 Commit message 后点 **Commit changes**。
5. 进入仓库 **Settings → Pages**，Source 选 **Deploy from a branch**，Branch 选 **main** 与 **/ (root)**，点 **Save**。
6. 等待 1~2 分钟构建完成，访问下方地址。

### 方式二：git 命令

```bash
# 在 ourdays 目录下执行（index.html 所在目录）
cd path/to/ourdays

git init
git add -A
git commit -m "deploy: ourdays H5"
git branch -M main
git remote add origin https://github.com/<用户名>/<仓库名>.git
git push -u origin main
```

推送完成后，同样在仓库 **Settings → Pages** 中选择 **main / (root)** 并保存。

### 更新已部署的站点

```bash
git add -A
git commit -m "update"
git push
```

## 访问地址

```
https://<用户名>.github.io/<仓库名>/
```

例如用户名为 `alice`、仓库名为 `ourdays`，则访问 `https://alice.github.io/ourdays/`。

## 数据与隐私

- 所有数据（昵称、在一起日期、纪念日、回忆与照片）**仅保存在本机浏览器**的 localStorage / IndexedDB 中，**不会上传到任何服务器**，也不会随仓库一起发布。
- 因此：换设备、换浏览器或清除浏览器数据后记录会丢失，重要内容请自行导出备份。
- AI 文案助手为可选功能，密钥同样仅保存在本机浏览器，仅在填写后由浏览器直接请求你所填写的 API 地址。

## 部署须知

入口文件必须命名为 `index.html` 且位于仓库根目录，GitHub Pages 才会自动将其作为首页。
*（内容由AI生成，仅供参考）*
