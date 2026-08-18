#!/usr/bin/env bash
set -euo pipefail
PORT="${PORT:-8090}"
URL="http://127.0.0.1:${PORT}/api/local-admin/create-owner-recovery"
RESP="$(curl -fsS -X POST "$URL")" || { echo "[FAIL] 无法连接 SlimeLounge：$URL" >&2; exit 1; }
node - "$RESP" <<'NODE'
const r=JSON.parse(process.argv[2]||'{}');
if(!r.ok){console.error('[FAIL]',r.error||'生成失败');process.exit(1)}
console.log('');
console.log('SlimeLounge Owner 一次性恢复码');
console.log('--------------------------------');
console.log(r.code);
console.log('--------------------------------');
console.log('Owner:',r.ownerName||'');
console.log('工号:',r.employeeMasked||'');
console.log('有效期至:',new Date(r.expiresAt).toLocaleString());
console.log('该码只能使用一次。不要发给其他人。');
console.log('');
NODE
