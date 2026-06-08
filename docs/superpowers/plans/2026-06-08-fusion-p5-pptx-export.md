# P5 执行计划 — PPTX 导出(方案 D MVP)

> spec(单一来源):`specs/2026-06-08-fusion-p5-pptx-export-design.md`。
> 跨仓:导出器在 **workflow-san** `/Users/kevinchen/PPT_Agent/ppt-agent-workflow-san/html-slide-to-pptx/`(pptxgenjs 已装);facade 在 **ppt-agent** `commands/ppt.md`。各自 git 仓分别提交(先 `git rev-parse` 确认)。
> 铁律:pptx 为 **additive 尽力而为**——失败不阻塞既有 SVG/HTML 交付。可编辑/保真 = **用户 PowerPoint 验证**,本会话只验 zip/XML 结构;**不得声称"已可用"**。

## Task 0 — 先验 pptxgenjs SVG API(关键,先做)
写最小脚本 `scripts/_probe_svg_api.js`(临时):用 pptxgenjs `addImage` 嵌一个内联 SVG,导出 .pptx,unzip 看产出。确认:① SVG 传入形式(`data:image/svg+xml;base64,...` 还是 path);② 是否**必须同时给 PNG 兜底**才生成 `asvg:svgBlip`;③ 产出是否含 svgBlip + 媒体 .svg + ContentType svg Default。把结论写进导出器注释。验完删除 probe。

## Task 1 — 外链图内联预处理(先于嵌入)
`lib/inline-svg-images.js`:输入 SVG 字符串 + 基目录,把所有 `<image href="images/xxx">`(相对外链)读文件→base64→替换成 `href="data:image/<type>;base64,..."`。绝对 data URI / http 跳过。文件缺失→保留原 href + 告警(不崩)。单测:含外链图 SVG → href 变 data URI;缺文件→不崩。
> 理由(spec §3.1):pptx 内 SVG 是孤立媒体部件,相对 href 解析不到 → PowerPoint 破图。**必须内联**。

## Task 2 — 导出器 `svg-deck-to-pptx.js`
按 spec §2 接口。流程:枚举 `--in` 下 `slide-NN.svg`(数字排序)→ 每页:读 SVG → `inline-svg-images` 内联外链 → 取/生成 PNG 兜底(优先 `--png-dir`/已存在 render-*.png;否则调 `--render-svg-cli` 生成;再否则用纯背景色占位 PNG 保证结构合法 + 告警)→ pptxgenjs `addImage` 全幅(13.333×7.5in,x0 y0 w h 满幅)原生 SVG + PNG 兜底 → 共享单个 PptxGenJS 实例(复用 `compose_pptx.js` 范式)。写标题进 core props。容错:单页失败→跳过/纯 PNG 兜底,不中断;全失败→非零退出 + 报错。

## Task 3 — 结构化测试
`tests/svg-deck-to-pptx.test.js`(node:test;workflow-san test 脚本若只有 check-env,新增 `node --test tests/` 或独立 npm script)。用最小 fixture(2 个 1280×720 SVG,其一含外链 `<image>` + 一张小 png 资产)跑导出器 → **unzip 产出 pptx**(jszip 传递依赖可用)断言 spec §1C 六条:合法 zip;`[Content_Types].xml` 含 svg Default;`ppt/media/` 含 .svg+.png;每 slide xml 含 `asvg:svgBlip` r:embed 指向真实 svg 媒体;页数=SVG 数;presentation.xml 引用全 slide。再断言:媒体 .svg 内**外链 href 已为 data URI**(内联生效)。

## Task 4 — ppt-agent facade 接线
`commands/ppt.md` Phase 7:产出 SVG/HTML 后,**尽力而为**调导出器生成 `output/presentation.pptx`(相对路径定位 workflow-san + 存在性探测;依赖/Chrome 缺失→跳过 + 提示,不阻塞)。交付 README/summary 加一行:"PowerPoint 2016+ 打开 presentation.pptx 验证可编辑性/保真"。
`ppt/export` 文档化(spec §1E):SVG→方案D(本里程碑),HTML→storybook(已存在,交叉引用)。散文 grep 锚点:`presentation.pptx`、`svg-deck-to-pptx`、"尽力而为/additive"、"PowerPoint 验证"。

## Task 5 — dogfood 验收项
入口文档 `docs/superpowers/2026-06-07-dogfood-findings-and-next-steps.md` 加 P5 验收(spec §4):PowerPoint 打开→每页显示?可点选编辑 SVG?中文/字体?资产页图在?保真够用→D 收官;不够→记差距评估方案 A。

## 执行
- 子代理:Task 0 先验 API → 1→4 实现 + TDD → 5 文档。
- workflow-san 与 ppt-agent 各自提交。
- 完成 → 多代理对抗审核(重点:① 外链内联是否真生效防破图;② svgBlip 结构是否真嵌入可编辑而非光栅化成方案C;③ 无 Chrome/无依赖优雅降级;④ 不阻塞既有交付;⑤ 不夸大"已可用")→ 修 → 回填路线图。

## DoD
- 导出器 + 内联 + 结构测试绿;对既有 output 能产出结构合法 `presentation.pptx`(含 svgBlip + 内联图)。
- facade additive 接线、失败不阻塞;dogfood 验收项写入。
- 路线图 P5 标"✅ MVP 代码完成,**PowerPoint 保真待用户实测**(D vs A 待定)";记忆回填。
