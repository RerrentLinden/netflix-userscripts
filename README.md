# netflix-userscripts

两个用于 Netflix 网页版的油猴脚本（Tampermonkey userscripts for Netflix web）。

| 脚本 | 作用 | 安装 |
| --- | --- | --- |
| Netflix 双语字幕 | 同时显示两种语言的字幕，可选语言、调样式 | [点击安装](https://raw.githubusercontent.com/RerrentLinden/netflix-userscripts/main/netflix-dual-subs.user.js) |
| Netflix 锁定最高分辨率 | 始终使用当前浏览器能拿到的最高分辨率 | [点击安装](https://raw.githubusercontent.com/RerrentLinden/netflix-userscripts/main/netflix-max-resolution.user.js) |

需要先安装 [Tampermonkey](https://www.tampermonkey.net/)。两个脚本互相独立，可以只装一个。安装或更新后刷新 Netflix 页面生效。

## Netflix 双语字幕

默认上行简体中文、下行英语。脚本自己画两行字幕，并在自己的字幕就绪后隐藏 Netflix 原生字幕；关掉脚本后原生字幕恢复，不会改动你在 Netflix 里的字幕设置。

**设置面板**：在播放页移动鼠标，画面右侧中间会出现「字」按钮，点开后可以调整：

- 上行、下行各自的语言（本片提供的所有语言都可选，也可以选「不显示」只留一行）、字号、颜色
- 字体、加粗、背景不透明度、垂直位置

设置保存在浏览器本地，对所有影片生效。

**快捷键**（macOS 上 Alt 即 Option）：

| 按键 | 作用 |
| --- | --- |
| `Alt+D` | 开关双语字幕 |
| `Alt+=` / `Alt+-` | 两行字号同时放大 / 缩小 |

**说明**：

- Netflix 默认只下发少数几种推荐语言的字幕地址。选了其他语言时，脚本会把原生字幕临时切到该语言来取得地址，约 1 秒后切回原来的选择。
- 选的语言本片没有时，会退到同一语言的其他变体（例如选简体而本片只有繁体）；都没有则提示并留空。
- 只支持文本字幕，不支持图片格式的字幕。

## Netflix 锁定最高分辨率

Netflix 播放器会按网速在多档分辨率之间自动切换。脚本把较低分辨率的视频流从播放清单里去掉，只保留最高一档，播放器就不会再降档。

- 只能在 Netflix 下发给当前浏览器的档位里选，不能解锁拿不到的档位：Chrome、Firefox 最高 1080p；4K 需要 Edge（Windows）或 Safari（macOS），并且账号是高级套餐。
- 同一分辨率的多档码率全部保留，播放器仍会按网速在其中切换。
- 代价：没有低分辨率可以过渡，起播和拖动进度后的缓冲会更久，网速不够时会卡顿而不是变糊。
- 想限制上限（例如只要 1080p），改脚本顶部的 `MAX_HEIGHT`。

确认是否生效：打开浏览器开发者工具的控制台，开始播放后会看到类似 `[锁定分辨率] 1080p，保留 2/7 条视频流` 的输出。

## 工作原理

两个脚本都在页面最早期接管 `JSON.parse`，从而读到播放器收到的播放清单（manifest）：双语字幕从中取各字幕轨的下载地址，分辨率锁定则删掉其中的低分辨率视频流。Netflix 改版后可能失效，届时欢迎提 issue。

## License

[MIT](LICENSE)
