# Tutorduo · 英语阅读与听说

一个本地运行的英语学习网页：读感兴趣的英文、按句听音、按需看中文、收藏表达，再用 REPHRASE 在新语境里复习。

**网页负责学习交互，AI 对话负责准备内容。无需填写 AI API Key。** 适合希望用自己喜欢的文章或视频字幕练习阅读、听力和口语的人。

## 能做什么

- **阅读学习**：一句一行；点击英文，从这句连续往后朗读；点击句旁 ▶，展开或收起这句中文。
- **听音**：Jenny 美式女声 / Guy 美式男声，默认 1.25×；支持全文、本段、任一句起读，以及暂停、继续和当前句高亮。
- **理解表达**：点击下划线查看语境含义、例句和用法；标注也支持简单词组成的地道搭配。
- **词库与自测**：收藏、设为重点、标为已掌握；默认隐藏中文，点击揭晓。已掌握的词退出待复习列表。
- **REPHRASE**：独立页面显示最近一次复习文章。关闭网页后仍保留，新结果覆盖旧结果；可另存到材料库。
- **材料管理**：导入 JSON、SRT、VTT、TXT；删除可恢复；导出、恢复完整文字与学习状态备份。
- **本地查词**：可选安装 ECDICT，选中未标注的词也能查基本义。
- **原视频**：材料带 YouTube 来源时，可加载官方播放器，使用视频自己的播放控件。

## 快速开始

需要 **Python 3.10+**。推荐另装 **Node.js 22+**，用于对话桥接和测试。核心网页没有 npm 构建步骤。

```bash
git clone https://github.com/Justine3631/tutorduo.git
cd tutorduo
python3 -m venv .venv
```

macOS / Linux：

```bash
source .venv/bin/activate
python -m pip install -r requirements.txt
python server.py
```

Windows PowerShell：

```powershell
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python server.py
```

打开 **http://127.0.0.1:8766/**。保留终端运行；关闭网页不会关闭服务，停止终端中的服务后网页就无法访问。若 PowerShell 禁止激活脚本，可直接用 `.\.venv\Scripts\python.exe` 执行上述 Python 命令，无需修改系统策略。

第一次打开会显示原创示例。可在材料库导入 `starter-material.json` 体验较长的原创故事；该示例只有段落译文，逐句中文需按下文格式补充。

> 这是个人本机应用，没有账号和身份验证。保持默认的 `127.0.0.1` 监听，不要直接作为公网多人服务部署。GitHub Pages 只能托管静态页面，不能运行这里的 Python 数据保存和语音接口。

## 推荐的学习流程

1. 在 AI 对话中提供自己有权使用的英文文章或字幕，请 AI 整理成下文的材料 JSON。
2. 在材料库导入 JSON；或让能访问本机文件和终端的 AI 助手通过桥接写入。
3. 先听，再阅读；不懂时看句下中文或表达解释，收藏真正想会用的表达。
4. 进入词库，隐藏中文自测。需要加强的设为“重点”，熟悉的设为“已掌握”。
5. 选择表达，点击“准备 REPHRASE”，再在对话中要求生成新的复习短文或对话。

没有勾选表达时，REPHRASE 默认取最多 10 个未掌握表达，重点优先、较久未更新优先；手动选择最多 20 个。默认生成要求为六级 / IELTS 6.5 难度、400—600 词的心理学、脑科学或个人成长短文，可在对话中改变主题和长度。

**不会自动从 YouTube 抓字幕，也不会自动翻译或生成释义。** 只导入字幕或 TXT 时，需要另外准备中文与标注。YouTube 嵌入可能受来源限制、登录要求或网络影响。

## 安装可选本地词典

标注释义无需词典。要查询任意选中的单词，先从 [ECDICT](https://github.com/skywind3000/ECDICT) 下载并解压 `ecdict.csv`，放在 `dictionaries/ecdict.csv`，然后运行：

```bash
python scripts/build_dictionary.py
```

索引生成到 `dictionaries/ecdict.sqlite`。之后查词不联网；词典仅给出基本义，不保证符合当前语境。大型 CSV 和 SQLite 文件不随仓库发布。第三方许可见 [ECDICT-LICENSE](dictionaries/ECDICT-LICENSE)。

## 给 AI 的材料格式

保存为 UTF-8 JSON，再从材料库导入。`annotations[].text` 必须逐字出现在该段英文里；逐句译文必须依次覆盖英文原段，不能把整段中文复制到每句话。

```json
{
  "id": "example-small-steps",
  "title": "Small steps count",
  "topic": "个人成长",
  "sourceNote": "原创练习，非研究结论",
  "prompt": "用自己的话说说你会采取什么小行动。",
  "paragraphs": [
    {
      "text": "Take a step back. You do not have to solve everything today.",
      "zh": "先退一步。你不必今天解决所有事情。",
      "sentenceTranslations": [
        {"text": "Take a step back.", "zh": "先退一步。"},
        {"text": "You do not have to solve everything today.", "zh": "你不必今天解决所有事情。"}
      ],
      "annotations": [
        {
          "text": "Take a step back",
          "term": "take a step back",
          "type": "地道表达",
          "meaning": "暂时抽离，重新审视情况",
          "usage": "事情太复杂或情绪上来时使用。",
          "example": "Let's take a step back and look at our options.",
          "zh": "我们先退一步，看看有哪些选择。",
          "tip": "想象后退一步，看到更完整的画面。"
        }
      ]
    }
  ]
}
```

可选字段包括 `sourceUrl`、段落 `start` / `end`（秒）、标注 `form` / `context`。更多校验规则见 `core.mjs`。不要让 AI 编造字幕、出处或研究结论；生成内容应自行核对。

## 对话桥接：减少复制粘贴

需要 Node.js 22+，且本地 Python 服务已启动。在项目根目录运行：

```bash
node chat_bridge.mjs status
node chat_bridge.mjs review
node chat_bridge.mjs publish ./new-material.json
node chat_bridge.mjs practice ./practice.json
```

- `status`：查看材料、数据版本和选词。
- `review`：读取网页最近一次准备的 REPHRASE 请求。
- `publish`：追加新材料，保留已有词库和阅读选择，拒绝 ID / 数据版本冲突。
- `practice`：替换最近一次 REPHRASE，不改变正常阅读中的材料。

`publish` 和 `practice` 后可追加请求 ID，将对应请求标记完成。网页约每 5 秒或重新聚焦时同步；也可点击“同步最新材料”。

桥接不调用大模型、不存密钥、不主动发消息。**普通聊天网页不能自行读写你电脑的文件**：这种情况下让 AI 返回 JSON，手动导入即可。使用有本地文件和终端权限的助手时，可要求它阅读本 README、读取请求、生成 JSON，再执行桥接。

## 语音、隐私与备份

- 语音由 `edge-tts` 调用微软在线语音服务，无需 API Key；首次生成需要联网，会发送待朗读文本。该服务的可用性、速度可能变化。
- 打开文章会准备所选音色的各句音频，最多两个并发请求。缓存位于 `audio/generated/`；首次准备可能有等待，不保证句间完全无缝。
- 学习状态位于 `data/state.json`，保存使用版本检查和原子写入。上一版为 `data/state.previous.json`；首次迁移会保留备份。
- 完整导出包含材料、词库和最近一次 REPHRASE，**不含音频缓存和词典**。请定期从材料库导出备份。
- 仓库不含作者的个人学习记录、视频转录、生成音频、本机自动启动配置或私人部署凭据。

## 常见问题

**网页打不开？** 确认 `python server.py` 正在运行，访问地址包含端口 `8766`。`127.0.0.1` 代表当前设备，不能把这个地址发给朋友当成线上网址。

**朗读失败？** 确认已激活虚拟环境、安装依赖，终端执行 `edge-tts --help` 能正常响应，并检查网络。已有缓存仍可复用。

**句旁没有中文？** 检查材料有没有完整的 `sentenceTranslations`。只有 `zh` 的旧材料仅支持原段译文，不会自动生成逐句译文。

**关闭网页后记录还在吗？** 在同一项目目录启动服务，数据仍在。换电脑请导出、导入备份；不要删除 `data/`。

**可以开机启动吗？** 可以使用系统的登录启动服务；仓库默认不自动安装后台任务。只在明确需要时配置，并记录用途和停用方法。

**有手机版吗？** 作者另有静态离线阅读部署。这个公开仓库提供电脑版，不包含绑定个人账号的手机版部署目录；电脑材料也不会自动同步到手机。

## 开发与验证

前端是原生 HTML / CSS / JavaScript，后端使用 Python 标准库；`edge-tts` 为语音依赖。

```bash
node --test core.test.mjs reading.test.mjs shadowing.test.mjs
python -m unittest test_state_store.py test_server.py
node --check app.js
node --check shadow-player.js
```

测试覆盖材料校验、句子拆分、字幕时间戳、备份、词汇选择和本地保存 / 桥接。当前没有录音评分、账号同步或间隔复习调度。README 描述的是已实现功能，不代表学习效果承诺。
