# 腾讯云香港 + Tailscale Funnel（免购买域名）

SlimeLounge 可以直接使用 Tailscale Funnel 提供的 `https://<机器名>.<tailnet>.ts.net` 作为唯一正式入口。它提供 HTTPS/WSS，Node 仍只监听 `127.0.0.1:8090` 对应的服务。

## 启用

```bash
sudo tailscale set --hostname=slimelounge
sudo tailscale funnel --bg http://127.0.0.1:8090
sudo tailscale funnel status
```

记下输出中的 HTTPS 地址，例如：

```text
https://slimelounge.xxxxx.ts.net
```

`.dev.vars`：

```env
PORT=8090
AUTO_OPEN=0
SLIMELOUNGE_TIME_ZONE=Asia/Shanghai
SLIMELOUNGE_TRUST_PROXY=1
SLIMELOUNGE_COOKIE_SECURE=1
SLIMELOUNGE_PUBLIC_ORIGIN=https://slimelounge.xxxxx.ts.net
SLIMELOUNGE_DISCONNECT_GRACE_MS=15000
```

重启：

```bash
sudo systemctl restart slimelounge
sudo tailscale funnel status
```

以后只使用 `SLIMELOUNGE_PUBLIC_ORIGIN` 指定的 HTTPS 地址。v0.2.5 起，访问旧 IP/旧 Funnel 主机名时会先迁移已有浏览器设备凭证，再转到正式地址，成功迁移时保持原 Device ID。

## Device ID 与 IP

Device ID 是服务器为浏览器设备生成的随机 UUID。公网 IP、内网 IP、`X-Forwarded-For`、Tailscale 出口地址仅记录为安全审计信息并用于限流，不参与 Device ID 生成或认证。

如果同一台设备突然要求注册，优先检查：

1. 是否打开了不同 Origin（IP、旧 Funnel、新 Funnel）。
2. 是否清除了浏览器站点数据或使用无痕模式。
3. systemd 与手工启动是否使用了不同 `data.json`。

```bash
systemctl cat slimelounge | grep SLIMELOUNGE_DATA_DIR
ls -l /var/lib/slimelounge/data.json ~/.slimelounge/data.json 2>/dev/null
```

正式环境建议始终由 `slimelounge.service` 启动，并固定 `SLIMELOUNGE_DATA_DIR=/var/lib/slimelounge`。

## 换 Funnel 主机名时的设备迁移

如果从旧地址（例如 `vm-0-3-ubuntu....ts.net`）改成 `slimelounge....ts.net`，建议先让旧 Funnel 与新 Funnel 并存一段时间。v0.2.5+ 会让旧入口先运行 `/origin-migrate.html`，把原 Device ID 一次性迁移到正式入口，再跳转。

如果旧 Funnel 已经关闭，浏览器就无法从旧 Origin 读取原 Cookie/localStorage。这不是 IP 改变造成的。v0.2.6 起可由 Owner/Admin 在「管理 → 用户与设备」找到该用户的旧设备，点击「生成恢复码」，用户在新 HTTPS 地址登录页输入后会恢复到该条旧 Device ID，而不是重新注册或新增设备。
