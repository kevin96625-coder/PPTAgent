# 复合组件设计灵魂 — blocks(SVG 落地)

> Ported & adapted from Akxan/ppt-agent-skill (MIT, © 2025 sunbigfly); adapted to this repo's pure-SVG 1280×720 model and outline.json schema. 设计规范属通用,非原帖(linux.do/1782304)。
> Ported & adapted: component "design soul" + when-to-use. ALL HTML/CSS templates dropped; every block carries a pure-SVG landing hint (`<rect rx fill stroke>`, `<g transform>`) for this repo. No HTML markup elements, no CSS backdrop filters.

复合组件不是"网页 UI 组件",而是**信息叙事的视觉载体**。每个组件是一种独特的信息组织方式,承载特定的演讲节奏与观众情绪。本文件给**哲学 + 何时用 + SVG 落地提示**,代码骨架请见 `charts-catalog.md` 与 `prompts/svg-generator.md` 的图表段。

**与本仓库 schema 的关系**:这些组件由页面 `type`(comparison/process/quote/image)与 `data_elements` 的语义触发,不是新枚举。slide-core 在对应页型时引用本文件深化画法。

## 组件总表

| 组件 | 叙事角色 | 触发页型 / data_elements |
|------|---------|--------------------------|
| card-styles(6 变体) | 每张卡片的"空间存在感" | 所有 content/data 页 |
| timeline | 时间的河流 | `type=process` / `layout_type=timeline` |
| diagram | 结构的星图 | `type=process`(架构/层级/循环) |
| quote | 灵魂的锚点 | `type=quote` |
| comparison | 碰撞的擂台 | `type=comparison` |
| people | 面孔的力量 | 团队/人物(常配 `asset`) |
| image_hero | 画面的沉浸 | `type=image` / `asset.needed=true` |
| matrix | 象限的定位 | `type=data`(2×2 战略) |

## 灵动组合原则
- 复合组件自带视觉骨架(轴线/节点/面板),用无界悬浮(无包裹 `<rect>`)即可,方块包裹是画蛇添足。
- 一页中复合组件与基础卡片共存时,让复合组件跨列成为主角,基础卡片退为配角。
- 同一页不宜超过 1 个跨列跨行的复合组件,否则两个"主角"互相抢戏。

---

## card-styles — 6 种"空间存在感"(SVG 落地)

不要把 card_style 理解为"换个背景色"。每种变体代表信息在画面中的**存在方式**:沉入底层、漂浮中层、还是跃出表面。**每页至少 2 种混用打破单调;灼焰核心(accent)与浮岩(elevated)各最多 1 个/页。**

| 变体 | 灵魂 | SVG 落地提示 |
|------|------|--------------|
| **filled — 沉稳大地** | 扎实基底,可信承载面 | `<rect rx fill="${card_bg}">`,无描边或极淡描边 |
| **transparent — 无界之灵** | 内容裸露在虚空呼吸,靠自身视觉重力 | 无 `<rect>` 背景;只画 `<text>`/数据图形,直接生长在页面 |
| **outline — 虚境描边** | 若有若无的气泡膜,暗示边界不制造隔阂 | `<rect fill="none" stroke="${accent}" stroke-opacity="0.2">` |
| **accent — 灼焰核心** | 唯一燃烧的核心,反色文字 | `<rect fill="${accent}">` + 反色 `<text fill="#fff">`,一页最多 1 个 |
| **glass — 雾中幻影** | 半透明浮冰,底图若隐若现 | **不要用 CSS 毛玻璃滤镜**(本管线无 HTML/CSS);改用低透明叠色:`<rect fill="${card_bg}" opacity="0.35">` 叠在背景上 |
| **elevated — 悬崖浮岩** | 用阴影制造 Z 轴凸起 | `<rect fill="${card_bg}" filter="url(#card-shadow)">` + 微上移偏移,一页最多 1 个 |

**推荐灵动组合**(张力强 → 柔和):`accent`+`transparent`+`filled` / `elevated`+`outline`+`transparent` / `filled`+`outline`(最低限度层次)。

**与内容的共鸣**:大数字与金句用 transparent(自身就是锚点);timeline/diagram 用 transparent(自带骨架);comparison 用 outline(轻分隔);text/list 用 filled/outline(明确阅读边界)。

---

## timeline — 时间的河流
- **何时用**:4-8 个有时间顺序的事件(`type=process` / `layout_type=timeline`)。超过 8 个拆页。
- **设计灵魂**:轴线不必死板直线——可微弯、在 highlight 节点处膨胀加粗、末端渐隐暗示"未来仍延伸";节点交替上下排列制造呼吸起伏;highlight 节点更大更实,普通节点更小描边。
- **SVG 落地**:轴线 `<line stroke="${text}" opacity="0.2">` 或渐变 `<line>`;节点 `<circle r="8" fill="${accent}">`(highlight)/ `<circle r="5" fill="none" stroke>`(普通);标签 `<text text-anchor="middle">` 上下交替 `y`。推荐 transparent(自带轴线骨架)。

---

## diagram — 结构的星图
- **何时用**:架构 / 层级 / 循环 / 流程 / 金字塔(`type=process`)。
- **子类灵魂**:pyramid(底宽顶尖,层间渐变暗示"越上越珍贵");flowchart(连线可曲,箭头随重要性变大);hub-spoke(中心大圆不可动摇,重要辐射臂更粗);layers(从上到下渐深,地层沉积感);cycle(弧线连接暗示永不停歇,当前阶段节点突出)。
- **SVG 落地**:节点 `<rect rx>` 或 `<circle>`;连线 `<line>` / `<path d="M..C..">`(曲线);箭头用 `<polygon>`(禁止 CSS border 三角)。文字用 `<text>`。推荐 transparent(自带节点连线骨架)。

---

## quote — 灵魂的锚点
- **何时用**:权威引用 / 颠覆性观点(`type=quote`)。一页最多 1 个。
- **设计灵魂**:引文 28-36px、`font-weight:500`、行高 1.6;超大装饰引号(80-120px,极低透明度 0.1-0.15)像水印衬在文字后;金句周围大量留白——留白就是"请静听"的无声邀请;来源信息明显弱于引文。
- **变奏**:左侧竖线式(3px accent 竖线 + 下方来源,庄重)/ 居中悬浮式(诗意)/ 偏心张力式(不对称灵动)。
- **SVG 落地**:大引号 `<text font-size="110" fill="${accent}" opacity="0.12">"</text>`;引文 `<text font-size="32">`;竖线 `<rect width="3" fill="${accent}">`;头像用 `<clipPath id="avatar"><circle cx="40" cy="40" r="40"/></clipPath>` + `<image href="images/slide-NN.jpg" clip-path="url(#avatar)"/>`。推荐 transparent。

---

## comparison — 碰撞的擂台
- **何时用**:A vs B 决策 / before-after / pros-cons(`type=comparison`)。每面板 3-5 个维度。
- **设计灵魂**:有立场的对比——推荐方案用更强 accent + 更大字号 + 更丰满内容,另一侧中性克制,视觉上引导结论;无立场的对比——两侧不同 accent 色但结构对称;VS 分隔符可用跨中轴的圆形 accent 块 + "VS";对比维度上下对齐制造"逐条 PK"紧张感;verdict 跨两面板居中收官。
- **SVG 落地**:两面板 `<g transform="translate(...)">` + `<rect fill="none" stroke>`(outline 轻分隔);VS `<circle fill="${accent}">` + `<text>`;维度行 `<text>` 水平对齐。推荐 outline。

---

## people — 面孔的力量
- **何时用**:团队 / 人物展示(3-6 人),常配 `asset`(真实照片)。
- **设计灵魂**:不要做成通讯录(等距等大 = 最无聊);有核心人物则其头像明显更大、偏离中心;参差排列制造呼吸;头像背后可叠极淡渐变光晕。姓名最重要,职位次之,简介最弱可省。
- **SVG 落地**:头像 `<circle>` + `<clipPath>` 裁切真实 `<image>`(`asset.needed=true` 时);无照片用 `<circle fill="${accent}">` + 首字母 `<text fill="#fff">`;3px 选中边框 `<circle fill="none" stroke="${accent}" stroke-width="3">`。**禁止手绘假人脸**。

---

## image_hero — 画面的沉浸
- **何时用**:cover / section 等氛围页(`type=image` 或 `asset.needed=true`)。一页最多 1 个。
- **设计灵魂**:图像是主角,文字是浮游;遮罩让文字可读而非遮住图;灵动手法——渐隐融合(图从一侧渐隐,文字在渐隐区安身)/ 底部涌现(图铺满上 70%,文字从底部暗区涌现,电影海报感)/ 角落低语(文字极小蜷在一角,让图独占舞台)。
- **SVG 落地**:真实图用 `<image href="images/slide-NN.jpg" preserveAspectRatio="xMidYMid slice">`;遮罩用 `<rect>` + `<linearGradient>`(半透明渐变,**不要用 CSS 遮罩/毛玻璃滤镜**,本管线为纯 SVG);文字 `<text>` 叠在遮罩上。**禁止手绘假实物**(详见 slide-core 资产规则)。推荐 transparent/glass。

---

## matrix — 象限的定位
- **何时用**:2×2 战略定位 / SWOT / 竞争矩阵(`type=data`)。占据大区域。
- **设计灵魂**:十字轴是脊柱——用 accent 极低透明度的粗线(2-3px)有存在感不抢内容;highlight 象限"跳出来"(accent 15% 透明背景 + 加粗标题 + accent 胶囊标签),其余象限克制(5% 或透明);轴标签像坐标系刻度铭牌;项目标签用圆角药丸可在象限内自由散落暗示"定位"。
- **SVG 落地**:十字轴 `<line stroke="${accent}" stroke-opacity="0.25" stroke-width="2">`;象限背景 `<rect fill="${accent}" opacity="0.15">`(highlight);药丸 `<rect rx="12">` + `<text>`;轴标签 `<text letter-spacing="1">`。推荐 transparent + 跨列跨行。
