# 人大会计学·财务管理 期末题库

中国人民大学商学院《会计学》（12 章）与《财务管理》（10 章，第 4 章无）期末难度练习题库网页，共 **150 题**（单选 84 / 判断 44 / 简答·分录 22），由 DeepSeek Harness 按人大期末难度出题，计算与流程类题目附图解。

在线地址：https://077eth017e.github.io/ruc-accounting-quiz/

## 功能

- **练习模式**：每道题做完即时判分，立刻看解析与图解；
- **考试模式**：选定范围整卷作答，交卷后统一出成绩，可「只看错题」逐题复盘；
- **题目收藏**：⭐ 收藏，支持只看收藏；
- **进度统计**：已做题数、正确率、每章进度条；
- **跨设备同步**：进度自动同步到你的 GitHub 私密 gist，手机/电脑互通；
- **手机适配**：抽屉式章节导航、底部操作条、安全区适配。

## 跨设备同步设置

1. 打开 [github.com/settings/tokens/new](https://github.com/settings/tokens/new?scopes=gist&description=ruc-quiz-sync)，创建 classic token，**只勾选 `gist` 权限**；
2. 在网页右上角 ⚙ 设置中粘贴 token，并填一个**同步标识**（如"手机"/"电脑"，所有设备用同一个标识）；
3. 点击「保存并同步」。之后每做完一题，4 秒后自动同步；另一台设备打开页面自动拉取合并。

> token 只保存在你自己浏览器的 localStorage 中，不会上传到仓库。

## 文件结构

- `index.html` — 页面结构与样式
- `app.js` — 做题逻辑与同步
- `questions.js` — 题库数据（150 题）

## 本地运行

任意静态服务器即可，例如：

```bash
python3 -m http.server 8000
# 打开 http://localhost:8000
```
