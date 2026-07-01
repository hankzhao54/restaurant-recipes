#!/bin/bash
# 双击这个文件即可初始化本地环境（Mac）。
# 作用：重装依赖 → 校验能否正常构建。跑完就能 npm run dev。

cd "$(dirname "$0")" || exit 1
echo "==============================================="
echo "  restaurant-recipes 本地环境初始化"
echo "  目录: $(pwd)"
echo "==============================================="
echo

# 1) 检查 Node
if ! command -v node >/dev/null 2>&1; then
  echo "❌ 没检测到 Node.js。"
  echo "   请先安装（二选一）："
  echo "   · 官网下载 LTS 版: https://nodejs.org"
  echo "   · 或用 Homebrew:  brew install node"
  echo
  echo "   装完后再双击本文件一次。"
  read -n 1 -s -r -p "按任意键关闭…"
  exit 1
fi
echo "✅ Node 版本: $(node -v)   npm: $(npm -v)"
echo

# 2) 检查 .env.local
if [ ! -f .env.local ]; then
  echo "⚠️  缺少 .env.local（Supabase 密钥）。"
  echo "   复制 .env.example 为 .env.local 并填入真实值后再运行。"
  read -n 1 -s -r -p "按任意键关闭…"
  exit 1
fi
echo "✅ .env.local 已就位"
echo

# 3) 删掉从别处复制来的 node_modules（平台不兼容），重装
echo "🧹 清理旧的 node_modules 和锁文件缓存…"
rm -rf node_modules
echo "📦 正在安装依赖（npm install）…"
if ! npm install --no-audit --no-fund; then
  echo "❌ 依赖安装失败，请把上面的报错发给 Claude。"
  read -n 1 -s -r -p "按任意键关闭…"
  exit 1
fi
echo

# 4) 校验构建
echo "🔨 测试构建（npm run build）…"
if npm run build >/dev/null 2>&1; then
  echo "✅ 构建通过，环境没问题！"
else
  echo "⚠️  构建有报错，但依赖已装好，dev 一般仍可用。有问题把报错发给 Claude。"
fi
echo
echo "==============================================="
echo "  完成！日常开发命令："
echo "    npm run dev      # 本地预览（浏览器打开提示的网址）"
echo "  改完提交部署："
echo "    git add -A && git commit -m \"说明\" && git push"
echo "  （push 后 Vercel 会自动部署）"
echo "==============================================="
echo
read -n 1 -s -r -p "按任意键关闭…"
