# 设计参考

「霜」的外观是方格笔记本：冷白方格纸、墨水蓝的字、红笔批注、胶带贴的卡片、一排书脊。打磨细节时对照下面这些参考。前五个是从 designeer.xyz 收录的资料里挑的。

| 参考 | 用来看什么 |
| --- | --- |
| [Minimal Gallery](https://minimal.gallery) | 克制的个人网站怎么留白、怎么只靠排版分层次 |
| [Practical Typography](https://practicaltypography.com) | 正文字号、行距、行宽；中英混排时英文的处理 |
| [Inclusive Components](https://inclusive-components.design) | 导航、卡片、列表等组件怎么做才方便键盘和读屏使用 |
| [Laws of UX](https://lawsofux.com) | 首页一屏放多少东西、点击区域多大 |
| [Refactoring UI](https://refactoringui.com) | 用颜色深浅和字重区分主次，而不是加更多边框 |
| [Yuniverse](https://www.xinyuhuang.space) | 个人空间的结构：一句话介绍、几条短信息、几个栏目入口 |
| 草稿 B「方格笔记本」 | 本地分支 prototype/home-drafts 里的原型，是这次外观的起点 |

## 已经定下的规矩

- **颜色**：所有颜色都是 `web/src/styles.css` 顶部的变量，组件里不直接写颜色值。目前只做浅色。
- **字体**：
  - 手写体只用在站名、标题和批注上，正文用系统黑体。
  - 手写字体（Long Cang）在页面显示之后才异步加载；加载不了时退回系统楷体，不会挡住页面。
- **布局**：
  - 首页是摊开的两页，中间是书脊。
  - 手机上两页上下排，书脊变成一条横线。
  - 两侧至少留 16px，任何宽度都不能横向滚动。
- **点击区域**：链接和按钮至少 32px 高。
