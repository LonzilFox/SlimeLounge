# SlimeLounge v0.3.4

SlimeLounge 是一个自建的多人休闲网页空间，整合 Discord 式文字/语音频道、同步听歌、好友、个人筹码、排行榜与多种小游戏。正式服务器推荐使用 Node.js + systemd；公网入口可以使用 Tailscale Funnel 提供 HTTPS/WSS，无需单独购买 WebSocket 服务。

## 主要功能

### 聊天室与语音

- Discord 式文字频道、语音频道与成员目录。
- 普通成员可编辑/删除自己的消息并回复指定消息；发送时 Enter 发送、Ctrl+Enter 换行，编辑时 Enter 直接换行。Owner / Admin 可管理公共内容。
- 公告和更新日志仅 Owner / Admin 可以新增、编辑、删除。
- 语音支持游戏房和聊天语音频道，按 `V` 或麦克风按钮开关麦。
- 声音检测会高亮当前正在讲话的人；进入语音频道时状态显示“语音中”。
- WebRTC 默认使用 STUN；严格 NAT / 企业网络无法互听时可配置 TURN/coturn。

### 听歌室

- 网易云 / QQ 音乐搜索、点播与房间时间轴同步；新增“其他风格”自由点歌房。
- 播放、暂停、Seek、换歌/跳歌同步给房间成员。
- 音乐 Cookie 绑定保存在 SlimeLounge 用户账号上：同一 Lounge 账号在不同设备登录时共用该绑定，但不会共享给其他 Lounge 用户。
- 音量按设备 / 浏览器本地保存，新设备默认 25%；听歌室主页面和可拖动悬浮播放器均提供进度与音量控制。
- 音乐账号状态读取带超时重试；某台设备到 SlimeLounge 服务器的网络/代理请求超时时不会把浏览器内部 `AbortSignal` 英文错误直接显示给用户，也不会因此删除 Cookie。

### 游戏

联机游戏包括：

- 摇骰子：5 个酒桌大话骰房，每人 5 骰，支持普通、斋、飞、开盅；骰面使用实体骰子点数样式。
- 五子棋
- 中国象棋：增加长将/重复局面限制，AI 也会规避第三次相同局面的连续将军。
- 国际象棋
- 围棋
- 21 点
- 德州扑克：最多 8 人，自选带入筹码，支持弃牌亮/不亮；全下后可选择公共牌发 1 次或 2 次，按仍在牌局玩家选择的较少次数执行。
- UNO：完整一/二/三/四位排名。
- 四人日麻：立直、鸣牌、振听、宝牌、途中流局、包牌、自动和牌/摸切等。

单机游戏包括数独和扫雷。

### 筹码经济

- 新用户/低保默认值、每小时恢复速度、每日签到奖励均由管理页配置。
- 低于低保值时按服务器时间差恢复，离线期间同样计算；达到低保值后停止回血，资产没有低保上限截断。
- 管理页先显示系统总设置，再按游戏分别配置真人每局费用、AI 每局费用与胜负/下注参数。
- 入场费按“每一局真正开始”扣除，而不是入座时扣除；AI 练习费低于真人对局。真人竞技尽量采用零和转移，入场费直接从系统销毁，用于抵消签到和低保带来的长期通胀。
- AI 练习不允许通过胜负无限制造真实筹码。
- 管理员可以调整个人筹码，所有服务器侧修改进入筹码流水。

### 排行榜

- 独立筹码榜。
- 各游戏分别维护“与真人对战 / 与 AI 对战”统计。
- UNO 和日麻展示一位、二位、三位、四位数据。

### 身份与设备

- Lounge ID 是公开社交 ID；工号仅用于内部认证。
- 工号规则：6–9 位 ASCII 英文字母或数字，不支持空格和其他符号。
- 旧用户如曾使用 `00XXXXXX` 形式的 8 位工号，可去掉开头 `00`，使用后 6 位重新注册/核验。
- Device ID 与公网 IP 解耦。IPv4/IPv6 只用于安全审计和限流，不作为账号身份依据。
- 同一浏览器使用 localStorage、IndexedDB 与长期恢复 Cookie 多层恢复身份。
- 管理员可针对历史 Device ID 生成恢复码，避免用户因浏览器身份丢失而重复注册。
- 账号合并时筹码取两边最高值，不相加制造筹码。

## 管理页

Owner / Admin 可管理：

- 用户、设备、身份恢复码和工号审核。
- 每个玩家当前筹码，默认按余额从高到低排行后修改。
- 默认/低保筹码、签到奖励、每小时恢复速度。
- 每个游戏入场费与胜负/下注参数。
- 排行榜结构校验与历史修正。
- 公告和更新日志频道内容。

## 自动发布更新说明

项目更新说明使用 `release_notes/*.json` 独立维护，不写在 README 中。服务器第一次识别到新的 release id 时，会向聊天室“更新日志”频道**追加**一条记录并标记为已发布：

- 不覆盖已有更新日志。
- Owner / Admin 后续手工编辑后不会被服务器改回。
- 手工删除后，服务器重启也不会重复发布同一个 release id。
- 后续版本只需要新增新的 release 文件，即可继续向频道末尾追加。

## 公网 HTTPS / WebSocket

当前可直接使用 Tailscale Funnel：

```bash
sudo tailscale funnel --bg http://127.0.0.1:8090
sudo tailscale funnel status
```

生产环境建议在 `.dev.vars` 设置：

```env
PORT=8090
AUTO_OPEN=0
SLIMELOUNGE_TIME_ZONE=Asia/Shanghai
SLIMELOUNGE_TRUST_PROXY=1
SLIMELOUNGE_COOKIE_SECURE=1
SLIMELOUNGE_PUBLIC_ORIGIN=https://你的正式入口.ts.net
SLIMELOUNGE_DISCONNECT_GRACE_MS=15000
```

如果 WebSocket、麦克风和说话状态都正常，但部分网络仍互相听不到，可给 WebRTC 增加 TURN：

```env
SLIMELOUNGE_TURN_URLS=turn:你的TURN服务器:3478
SLIMELOUNGE_TURN_USERNAME=用户名
SLIMELOUNGE_TURN_CREDENTIAL=密码
```

不要把 TURN 密码、音乐 Cookie、`.dev.vars` 或运行时 `data.json` 提交到 GitHub。

## 运行

```bash
npm install
npm run check
node local_server.js
```

Linux 正式服务器建议始终使用 systemd 启动，避免 systemd 与手工 `node local_server.js` 使用不同 `SLIMELOUNGE_DATA_DIR` 而造成“账号像丢失”的假象。

## 数据与安全

- 游戏胜负、筹码、签到、买入、入场费等关键数据由服务器权威校验，不能通过修改网页直接伪造。
- 支持 CSP、HSTS（HTTPS 环境）、Same-Origin 校验、代理信任边界、请求限流、WebSocket 大小/频率限制和安全响应头。
- 可信反向代理链优先记录真实 IPv4；没有可用 IPv4 时才回退 IPv6。
- `data.json` 建议权限 `0600` 并定期备份。

## 项目检查

提交或部署前执行：

```bash
npm run check
```

工程检查同时限制上传敏感文本源码单文件小于 90,000 bytes，以兼容当前代码上传环境。

## v0.3.4 网络与日志

v0.3.4 默认启用安全的本机反向代理识别；只有显式设置 `SLIMELOUNGE_TRUST_PROXY=0` 才关闭。当前只默认信任来自 `127.0.0.1` / `::1` 的反向代理转发头；如代理不在本机，可通过 `SLIMELOUNGE_TRUSTED_PROXY_IPS` 显式列出代理源 IP。

管理员可在「管理 → 服务器诊断」直接查看最近请求、429/4xx/5xx、慢请求、WebSocket / HTTP 兼容连接、Node 内存与事件循环延迟。systemd 部署继续使用 journald，无需额外写应用日志文件：

```bash
sudo journalctl -u slimelounge --since "30 minutes ago" --no-pager
sudo journalctl -u slimelounge -f
```

正常情况下每分钟会有一条 `[METRICS]` 汇总；只有 HTTP 4xx/5xx、429、≥1 秒慢请求、WebSocket 拒绝和 HTTP fallback 才额外记录，避免高频访问日志本身造成磁盘压力。

### v0.3.4 暂离 / 离线语义

`visibilitychange` 进入后台只标记为“暂离”，游戏和音乐房间连接保持；隐藏页面会获得更长的 tab lease，避免手机切到别的应用后因为浏览器暂停定时器而误判离线。非 BFCache 的真实页面关闭/离开会尽力发送 `/api/presence/offline` 关闭信号；浏览器或系统来不及发送时，再由租约过期兜底。

服务器诊断的“最近60秒请求”现在是滚动 60 秒窗口，不再使用可能覆盖接近两分钟的分钟桶近似值。单用户日志会记录 WebSocket 首帧认证、断开 close code、HTTP 长轮询 fallback、429 和具体设备/IP，适合定位“只有某一个同事连不上”的情况。

## v0.3.4 社交 / 日麻 / 斗地主 / 成长系统

- 点击用户史莱姆头像会打开个人名片，可从名片直接发起好友申请。
- 日麻使用“当前玩家永远在下方”的相对座次视角；四边暗牌、副露和结果公开牌共用各自的桌边轨道。半庄正常打东一到南四，必要时西入，并设置终局保护避免无限连庄。
- 游戏室新增 3 个斗地主房间，支持 3 人叫分制、完整常见牌型、炸弹/王炸、春天/反春和真人/AI 对局。
- 新增商城、宠物、成就、头衔。聊天、听歌、游戏活跃会推进账号和宠物成长；商城按配饰、食物、头衔分类，使用筹码购买。
- Owner/Admin 可在“管理 → 头衔管理”发放或撤销自定义头衔。
- 服务器诊断的全局异常列表只显示 5xx、429 和 ≥1 秒慢请求；普通快速 400/401/403/409 仍保留在单用户请求明细中。
