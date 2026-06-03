# 101 Kitchen Recipes — Production Setup Guide

完整步骤将这个 app 部署到云端，所有员工通过手机浏览器就能访问。

## 你将需要

- 一个免费的 Supabase 账号（数据库 + 用户认证 + 图片存储）
- 一个免费的 Vercel 账号（网页托管）
- 一个 GitHub 账号（连接 Vercel 用）
- 大约 30-45 分钟

预计费用：**0 元**（小餐厅完全在免费额度内）

---

## 第一步：创建 Supabase 项目

1. 打开 https://supabase.com → Sign up（用 GitHub 登录最方便）
2. 点 **New project**
   - **Name**: `restaurant-recipes`
   - **Database password**: 生成一个强密码并保存好
   - **Region**: 选 `Europe (Frankfurt)` 或 `Europe (London)`，欧洲访问最快
   - 点 **Create new project**，等待 1-2 分钟初始化
3. 项目创建好后，左边栏点 **Settings → API**
4. 复制下面两个值，等下要用：
   - **Project URL**（形如 `https://xxxx.supabase.co`）
   - **anon public** key（一串很长的字符串）

---

## 第二步：初始化数据库表

1. Supabase 左边栏点 **SQL Editor → New query**
2. 把 `supabase-setup.sql` 的全部内容复制粘贴进去
3. 点右下角 **Run**
4. 看到 "Success. No rows returned" 就行了

接着导入菜谱种子数据：

5. 再点 **New query**
6. 复制 `supabase-seed.sql` 全部内容粘贴
7. 点 **Run**
8. 看到 "Success" 即可（导入 82 个菜谱）

---

## 第三步：创建图片存储桶

1. 左边栏点 **Storage → New bucket**
2. **Name**: `recipe-images`
3. **Public bucket**: ✅ 勾上（这样图片可以直接通过 URL 访问）
4. 点 **Save**

接着设置访问权限：

5. 点击刚创建的 `recipe-images` bucket
6. 右上角 **Policies** → **New policy** → **For full customization**
7. 创建一个 SELECT 策略（允许任何人查看）：
   - Policy name: `Allow public read`
   - Allowed operation: `SELECT`
   - Target roles: 留空（应用于所有）
   - USING expression: `true`
   - 点 **Save policy**
8. 再创建一个 INSERT 策略（允许登录用户上传）：
   - Policy name: `Allow authenticated upload`
   - Allowed operation: `INSERT`
   - Target roles: `authenticated`
   - WITH CHECK expression: `true`
   - 点 **Save policy**

---

## 第四步：创建第一个管理员账号

由于使用了 Supabase 真实认证系统，第一次需要手动创建一个 admin 账号。

1. 左边栏点 **Authentication → Users → Add user → Create new user**
2. 填写：
   - **Email**: `admin@restaurant.local`（这是一个虚拟邮箱，登录时只用 username）
   - **Password**: `admin123`（之后可以在 app 内改）
   - **Auto Confirm Email**: ✅ 勾上
3. 点 **Create user**

然后给这个用户分配 admin 角色：

4. 左边栏 **SQL Editor → New query**
5. 运行（先找到这个用户的 UUID）：
   ```sql
   SELECT id, email FROM auth.users WHERE email = 'admin@restaurant.local';
   ```
6. 复制返回的 `id`（一串 UUID）
7. 再运行（把 `YOUR-UUID-HERE` 换成上面复制的）：
   ```sql
   INSERT INTO profiles (id, username, display_name, role)
   VALUES ('YOUR-UUID-HERE', 'admin', 'Head Chef', 'admin');
   ```

之后所有其他账号都可以通过 app 内的 Admin Panel → Users 创建，不用再回 Supabase 操作。

---

## 第五步：本地测试运行

1. 安装 Node.js（如果还没有）：https://nodejs.org （选 LTS 版本）

2. 在项目目录（解压本目录后）打开终端，运行：
   ```bash
   npm install
   ```

3. 创建 `.env.local` 文件，把第一步里复制的两个值填进去：
   ```
   VITE_SUPABASE_URL=https://你的项目id.supabase.co
   VITE_SUPABASE_ANON_KEY=你的anon key
   ```

4. 启动本地开发服务器：
   ```bash
   npm run dev
   ```

5. 打开浏览器访问 http://localhost:5173
   - 用户名: `admin`
   - 密码: `admin123`

如果能登录看到菜谱列表，说明本地一切正常 ✅

---

## 第六步：部署到 Vercel

1. 在 GitHub 创建一个新仓库，把项目文件 push 上去（如果你不熟悉 Git，可以让我帮你写步骤）

2. 打开 https://vercel.com → Sign up（用 GitHub 登录）

3. 点 **Add New → Project** → 选择你刚创建的 GitHub 仓库 → **Import**

4. **Environment Variables** 添加两条（和 `.env.local` 一样）：
   - `VITE_SUPABASE_URL` = `https://你的项目id.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = 你的 anon key

5. 点 **Deploy**，等 1-2 分钟

6. 完成后会得到一个网址，形如 `restaurant-recipes-xxx.vercel.app`

把这个网址发给员工就行了！

---

## 第七步：员工手机使用

**iPhone (Safari):**
1. 在 Safari 打开网址
2. 点底部分享按钮 ⬆
3. 选 **"Add to Home Screen"** / 添加到主屏幕
4. 命名，确认。桌面就会出现一个图标，点开就像 App 一样

**Android (Chrome):**
1. 在 Chrome 打开网址
2. 浏览器会弹出 **"Add 101 Kitchen Recipes to Home screen"** 提示
3. 或者点右上角菜单 → **"Install app"**
4. 桌面就会出现图标

---

## 常见问题

**Q: 员工需要 Supabase 账号吗？**
A: 不需要。员工只用你给他们的用户名和密码登录 app。

**Q: 自定义域名怎么办？**
A: Vercel 项目 → Settings → Domains → 添加你的域名，按提示改 DNS 即可。

**Q: 图片上传慢？**
A: 默认压缩到 maxDim=1200, quality=0.8。可以在 `src/utils/image.js` 里调整。

**Q: 我想从员工 app 删数据怎么办？**
A: 数据保存在 Supabase 上的，员工删除手机上的图标不影响数据。

**Q: 备份呢？**
A: Supabase 自动每天备份。要手动导出，去 Supabase → Database → Backups。

---

## 项目文件结构

```
restaurant-app-supabase/
├── README.md              ← 本文件
├── supabase-setup.sql     ← Step 2 用
├── supabase-seed.sql      ← Step 2 用（82 个菜谱数据）
├── package.json           ← Node 依赖配置
├── vite.config.js         ← 构建配置
├── index.html             ← 入口 HTML
├── .env.example           ← 环境变量模板
├── public/
│   └── manifest.json      ← PWA 配置
└── src/
    ├── main.jsx           ← React 入口
    ├── App.jsx            ← 主应用代码
    ├── supabase.js        ← Supabase 客户端
    └── utils/
        └── image.js       ← 图片压缩上传工具
```

---

如有任何步骤卡住，把错误信息发给我，我会帮你诊断。

---

## 功能升级记录（批次）

### 第三批新功能需要的步骤

如果你是从旧版本升级，按顺序做：

**1. 数据库迁移**（Supabase SQL Editor 依次运行）
- `supabase-batch2.sql` — 草稿状态 + 版本历史
- `supabase-batch3.sql` — 过敏原 + 自定义分类

**2. 安装新依赖**（QR 码功能需要）
```
cd D:\restaurant-app-supabase
npm install
```
（package.json 新增了 `qrcode` 包，必须重新 npm install 一次）

**3. 替换源码**：覆盖 `src/App.jsx`、`src/supabase.js`、`package.json`、`vite.config.js`

**4. 测试 + 部署**
```
npm run dev          # 本地测试
git add . ; git commit -m "batch 3 features" ; git push   # 部署
```

### 第三批功能清单
- 🏷 **自定义分类**：Admin → Categories 标签，可增删改分类名和颜色
- ⚠ **过敏原标记**：编辑菜谱时勾选过敏原，详情页显示红色标签
- ⊞ **二维码**：每个菜谱详情页有二维码按钮，可打印贴料盒，扫码登录后直达该菜谱
- 🧾 **今日备料清单**：卡片上 🧾 加入清单，自动按倍数汇总所有食材
- 🕘 **最近查看** / **排序** / **复制菜谱** / **图片放大** / **食材反查** / **统计面板** / **数据导出**
