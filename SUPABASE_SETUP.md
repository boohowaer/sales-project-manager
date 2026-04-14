# Supabase设置指南

这个项目使用Supabase作为后端数据库。请按照以下步骤设置你的Supabase项目。

## 1. 创建Supabase项目

1. 访问 [https://supabase.com](https://supabase.com)
2. 注册一个新账户（如果还没有的话）
3. 点击"New Project"创建新项目
4. 选择组织（或创建新组织）
5. 填写项目信息：
   - 项目名称：例如 `sales-project-manager`
   - 数据库密码：设置一个强密码并保存好
   - 区域：选择离你最近的区域
6. 等待项目创建完成（通常需要1-2分钟）

## 2. 获取项目凭据

1. 在项目仪表板中，点击左侧菜单的"Settings" -> "API"
2. 复制以下信息：
   - Project URL
   - `anon` public key

## 3. 配置环境变量

1. 在项目根目录创建 `.env.local` 文件
2. 复制以下内容并填入你的凭据：

```bash
NEXT_PUBLIC_SUPABASE_URL=你的项目URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=你的anon密钥
```

## 4. 运行数据库迁移

1. 在Supabase项目仪表板中，点击左侧菜单的"SQL Editor"
2. 点击"New Query"
3. 复制 `lib/supabase/migrations.sql` 文件的内容
4. 粘贴到SQL编辑器中
5. 点击"Run"执行SQL脚本

这个脚本会创建：
- `customers` 表（客户信息）
- `projects` 表（项目信息）
- `tasks` 表（任务信息）
- `user_settings` 表（用户设置）
- 所有必要的索引和约束
- 行级安全策略（RLS）
- 自动触发器

## 5. 配置认证

1. 在Supabase项目仪表板中，点击左侧菜单的"Authentication"
2. 在"Settings"标签中：
   - 确保"Email Auth"已启用
   - 可以选择"Enable email confirmations"（建议关闭以便开发测试）
3. 在"Providers"标签中，确保"Email"提供商已启用

## 6. 测试连接

运行开发服务器：

```bash
npm run dev
```

访问 `http://localhost:3000`，你应该能看到应用正在运行。

## 故障排除

### 问题：数据库连接失败

- 检查 `.env.local` 文件中的URL和密钥是否正确
- 确保Supabase项目没有暂停（免费项目会在一段时间不活动后自动暂停）

### 问题：认证错误

- 确保你已经运行了数据库迁移脚本
- 检查Supabase项目的认证设置是否正确

### 问题：查询返回空结果

- 确保你已登录（RLS策略要求用户认证）
- 检查数据库中是否有数据

## 下一步

设置完成后，你可以：
1. 注册一个新账户
2. 开始添加客户和项目
3. 创建任务并设置提醒
4. 自定义你的设置（字体、主题等）

## 数据安全

- 这个项目使用了行级安全策略（RLS），确保每个用户只能访问自己的数据
- 所有敏感操作都经过认证
- 密码使用Supabase的安全加密存储

## 免费额度

Supabase免费计划包括：
- 500MB数据库存储
- 1GB文件存储
- 50,000月活跃用户
- 2GB带宽/月

对于个人使用来说，这完全足够了。
