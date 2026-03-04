#!/bin/bash
# PaperStudio Pro License Server — 一键部署脚本
# 使用方式: bash deploy.sh
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

BUN="$HOME/.bun/bin/bun"
WRANGLER="$BUN x wrangler"

echo ""
echo "================================================"
echo "  PaperStudio Pro License Server 部署"
echo "================================================"
echo ""

# ── Step 1: 登录 Cloudflare ──────────────────────────────
echo "📡 Step 1: 登录 Cloudflare..."
echo "   (如果已登录会自动跳过)"
echo ""
$WRANGLER whoami 2>/dev/null || $WRANGLER login
echo ""

# ── Step 2: 创建 KV Namespaces ──────────────────────────
echo "📦 Step 2: 创建 KV 存储空间..."
echo ""

# 创建 LICENSES KV
echo "  创建 LICENSES namespace..."
LICENSES_OUTPUT=$($WRANGLER kv namespace create LICENSES 2>&1) || true
echo "$LICENSES_OUTPUT"
LICENSES_ID=$(echo "$LICENSES_OUTPUT" | grep -oP 'id = "\K[^"]+' || echo "")

echo ""
echo "  创建 LICENSES preview namespace..."
LICENSES_PREVIEW_OUTPUT=$($WRANGLER kv namespace create LICENSES --preview 2>&1) || true
echo "$LICENSES_PREVIEW_OUTPUT"
LICENSES_PREVIEW_ID=$(echo "$LICENSES_PREVIEW_OUTPUT" | grep -oP 'id = "\K[^"]+' || echo "")

echo ""

# 创建 ACTIVATION_CODES KV
echo "  创建 ACTIVATION_CODES namespace..."
ACTIVATION_OUTPUT=$($WRANGLER kv namespace create ACTIVATION_CODES 2>&1) || true
echo "$ACTIVATION_OUTPUT"
ACTIVATION_ID=$(echo "$ACTIVATION_OUTPUT" | grep -oP 'id = "\K[^"]+' || echo "")

echo ""
echo "  创建 ACTIVATION_CODES preview namespace..."
ACTIVATION_PREVIEW_OUTPUT=$($WRANGLER kv namespace create ACTIVATION_CODES --preview 2>&1) || true
echo "$ACTIVATION_PREVIEW_OUTPUT"
ACTIVATION_PREVIEW_ID=$(echo "$ACTIVATION_PREVIEW_OUTPUT" | grep -oP 'id = "\K[^"]+' || echo "")

echo ""

# 如果获取到了 ID，自动更新 wrangler.toml
if [ -n "$LICENSES_ID" ] && [ -n "$ACTIVATION_ID" ]; then
    echo "✅ KV namespaces 创建成功，自动更新 wrangler.toml..."

    cat > wrangler.toml << EOF
name = "paperstudio-license"
main = "src/index.ts"
compatibility_date = "2024-12-01"

[vars]
APP_DEEP_LINK_SCHEME = "paperstudio"

# Secrets (set via: wrangler secret put <name>)
# GOOGLE_CLIENT_ID
# GOOGLE_CLIENT_SECRET
# LICENSE_HMAC_SECRET

[[kv_namespaces]]
binding = "LICENSES"
id = "$LICENSES_ID"
preview_id = "${LICENSES_PREVIEW_ID:-$LICENSES_ID}"

[[kv_namespaces]]
binding = "ACTIVATION_CODES"
id = "$ACTIVATION_ID"
preview_id = "${ACTIVATION_PREVIEW_ID:-$ACTIVATION_ID}"
EOF
    echo "   wrangler.toml 已更新"
else
    echo "⚠️  无法自动提取 KV ID，请手动查看上方输出并更新 wrangler.toml"
    echo "   运行: $WRANGLER kv namespace list  查看所有 namespace"
fi

echo ""

# ── Step 3: 设置 Secrets ─────────────────────────────────
echo "🔐 Step 3: 设置 Secrets..."
echo ""

echo "  请输入 Google OAuth Client ID:"
read -r GOOGLE_CLIENT_ID
echo "$GOOGLE_CLIENT_ID" | $WRANGLER secret put GOOGLE_CLIENT_ID

echo ""
echo "  请输入 Google OAuth Client Secret:"
read -r GOOGLE_CLIENT_SECRET
echo "$GOOGLE_CLIENT_SECRET" | $WRANGLER secret put GOOGLE_CLIENT_SECRET

echo ""
echo "  生成 LICENSE_HMAC_SECRET (自动生成随机密钥)..."
HMAC_SECRET=$(openssl rand -hex 32)
echo "$HMAC_SECRET" | $WRANGLER secret put LICENSE_HMAC_SECRET
echo "   HMAC Secret: $HMAC_SECRET"
echo "   (请保存此密钥以备将来使用)"

echo ""

# ── Step 4: 部署 Worker ──────────────────────────────────
echo "🚀 Step 4: 部署 Worker..."
echo ""
$WRANGLER deploy

echo ""
echo "================================================"
echo "  ✅ 部署完成！"
echo "================================================"
echo ""
echo "  Worker URL: https://paperstudio-license.<你的子域名>.workers.dev"
echo ""
echo "  下一步: 配置自定义域名"
echo "  1. 登录 Cloudflare Dashboard"
echo "  2. 选择 paperstudio.cc 域名"
echo "  3. Workers Routes → Add route"
echo "     Pattern: license.paperstudio.cc/*"
echo "     Worker: paperstudio-license"
echo ""
echo "  或者用 wrangler 命令添加自定义域名:"
echo "     cd $(pwd)"
echo "     bunx wrangler domains add license.paperstudio.cc"
echo ""
