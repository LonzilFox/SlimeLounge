# 腾讯云香港轻量服务器：SlimeLounge HTTPS / WSS / 语音部署

适用于当前 SlimeLounge v0.3.8 的 Node.js + systemd 部署。Node 继续监听 8090，公网只开放 80/443，由 Caddy 负责 HTTPS/WSS。

## 结论

- 腾讯云中国香港服务器不需要中国大陆 ICP 备案；域名本身按注册商要求完成实名认证即可。
- WebSocket 不需要购买独立“WebSocket 服务”。SlimeLounge Node 已经提供 WebSocket 服务。
- 手机浏览器麦克风需要 HTTPS 安全上下文，因此正式语音应使用 `https://你的域名`，WebSocket 会自动变为 `wss://你的域名/api/ws`。
- Caddy 会自动申请/续期 TLS 证书，并自动透传 WebSocket Upgrade。
- TURN 不是 WebSocket。当前工程先使用 STUN 做 WebRTC 直连；只有某些严格 NAT/公司防火墙环境语音仍连不上时，再增加 TURN。

## 1. 准备域名

可以购买一个便宜的普通域名，也可以使用你已有域名的子域名，例如：

```text
slime.example.com
```

在域名 DNS 管理中添加：

```text
记录类型: A
主机记录: slime
记录值: 你的腾讯云香港服务器公网 IPv4
TTL: 默认
```

如果直接使用根域名，则主机记录通常填写 `@`。

刚配置 DNS 后可以在自己的电脑检查：

```bash
nslookup slime.example.com
```

返回 IP 应该等于服务器公网 IP。

## 2. 腾讯云轻量应用服务器防火墙

腾讯云控制台 → 轻量应用服务器 → 当前香港实例 → 防火墙。

至少允许：

```text
TCP 80   来源 0.0.0.0/0   允许
TCP 443  来源 0.0.0.0/0   允许
```

SSH 22 建议只允许你自己的公网 IP，而不是长期对全网开放。

在 HTTPS/WSS 验证成功后，建议删除/拒绝公网 TCP 8090。Node 仍然运行 8090，但只让 Caddy 从本机访问。

如果 Ubuntu 开启了 UFW：

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw status
```

不要再为公网开放 8090。

## 3. 安装 Caddy

### Ubuntu / Debian

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo chmod o+r /usr/share/keyrings/caddy-stable-archive-keyring.gpg
sudo chmod o+r /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install caddy
```

### TencentOS / CentOS / RHEL

```bash
sudo dnf install -y dnf-plugins-core
sudo dnf copr enable @caddy/caddy
sudo dnf install -y caddy
sudo systemctl enable --now caddy
```

确认：

```bash
caddy version
sudo systemctl status caddy --no-pager
```

## 4. 配置 Caddy

编辑：

```bash
sudo nano /etc/caddy/Caddyfile
```

只需要：

```caddyfile
slime.example.com {
    encode zstd gzip
    reverse_proxy 127.0.0.1:8090
}
```

把 `slime.example.com` 换成你的真实域名。

验证并重新加载：

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
sudo systemctl status caddy --no-pager
```

只要 DNS 已经指向该服务器并且 80/443 可从公网访问，Caddy 会自动申请 HTTPS 证书。

## 5. 修改 SlimeLounge 生产环境变量

编辑：

```bash
cd /opt/SlimeLounge
nano .dev.vars
```

至少建议：

```text
PORT=8090
AUTO_OPEN=0
SLIMELOUNGE_TIME_ZONE=Asia/Shanghai
SLIMELOUNGE_TRUST_PROXY=1
SLIMELOUNGE_COOKIE_SECURE=1
SLIMELOUNGE_PUBLIC_ORIGIN=https://slime.example.com
SLIMELOUNGE_DISCONNECT_GRACE_MS=15000
```

把域名改成你的真实域名，不要在末尾添加 `/`。

生产环境的两个秘密建议分别生成不同随机值：

```bash
openssl rand -hex 32
openssl rand -hex 32
```

然后填入：

```text
EMPLOYEE_HASH_SECRET=第一条随机字符串
NETEASE_COOKIE_SECRET=第二条随机字符串
```

`OWNER_EMPLOYEE_ID` 保留你当前正在使用的配置。

## 6. 重启服务

```bash
sudo systemctl daemon-reload
sudo systemctl restart slimelounge
sudo systemctl reload caddy
sudo systemctl status slimelounge --no-pager
sudo systemctl status caddy --no-pager
```

## 7. 验证

服务器本机：

```bash
curl http://127.0.0.1:8090/api/health
```

应返回 SlimeLounge v0.3.8。

再测试公网 HTTPS：

```bash
curl -I https://slime.example.com
```

然后电脑和手机都只使用：

```text
https://slime.example.com
```

不要再使用：

```text
http://公网IP:8090
```

进入任意房间后，连接状态应该显示：

```text
房间已连接 · WebSocket
```

而不是：

```text
房间已连接 · HTTP兼容
```

点击“开麦”时，浏览器应该弹出麦克风权限请求。网页麦克风在公网 HTTP 下通常不可用，HTTPS 是正式部署的正确方式。

## 8. HTTPS 正常但仍是 HTTP兼容时

依次检查：

```bash
sudo journalctl -u caddy -n 100 --no-pager
sudo journalctl -u slimelounge -n 100 --no-pager
sudo ss -lntp | grep -E ':80|:443|:8090'
```

确认：

- Caddy 正在监听 80/443；
- Node 正在监听 8090；
- `SLIMELOUNGE_PUBLIC_ORIGIN` 与浏览器地址完全一致；
- 浏览器使用的是 `https://域名`，不是旧 IP 地址；
- 如果域名前面又套了 CDN/代理，先关闭代理，仅用普通 DNS A 记录验证 WSS。

Caddy 的 `reverse_proxy` 本身支持 WebSocket Upgrade，不需要额外写 `Upgrade` / `Connection` 头。

## 9. TURN 要不要买？

先不要买。

当前语音结构：

```text
WSS: 房间成员状态 + WebRTC 信令
STUN: 尝试让浏览器之间直接建立语音连接
WebRTC: 实际语音数据
TURN: 只有无法直连时才作为中继
```

你的 2 核 / 2 GB 服务器承担 SlimeLounge HTTP/WSS 信令没有问题。正常 STUN 直连时，语音流不会经过 Node 服务器，所以也不会消耗服务器 20Mbps 去中继所有语音。

如果之后出现这种现象：

- HTTPS/WSS 已经正常；
- 麦克风权限也正常；
- 同一个 Wi-Fi 能说话；
- 但某些公司网络 / 校园网 / 蜂窝网络之间始终听不到；

这时再配置 TURN。可以自建 `coturn`，也可以使用托管 TURN。无需在第一阶段购买。
