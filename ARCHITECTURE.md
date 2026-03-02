# AI API Hub V2 - 架构文档

## 📋 项目概述

**AI API Hub V2** 是一个大语言模型 API 聚合与计费管理平台，类似 new-api、one-api。

- **前端**: HTML5 + Vanilla JS + Tailwind CSS (无框架)
- **后端**: Node.js + Express + SQLite
- **部署**: 单机部署，Python http.server + Node.js

---

## 🏗️ 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                        用户层                                │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │ 管理员    │  │ 普通用户  │  │ API 调用 │  │ 模型测试 │    │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘    │
└───────┼─────────────┼─────────────┼─────────────┼──────────┘
        │             │             │             │
        └─────────────┴──────┬──────┴─────────────┘
                             │
┌────────────────────────────▼───────────────────────────────┐
│                      前端层 (3000端口)                       │
│  ┌────────────────────────────────────────────────────┐    │
│  │  index.html - 单页应用                              │    │
│  │  - 纯 HTML/JS/CSS，无框架依赖                      │    │
│  │  - Tailwind CSS CDN                                │    │
│  │  - Iconify 图标                                    │    │
│  └────────────────────────────────────────────────────┘    │
└────────────────────────────┬───────────────────────────────┘
                             │ HTTP API
┌────────────────────────────▼───────────────────────────────┐
│                      后端层 (8080端口)                       │
│  ┌────────────────────────────────────────────────────┐    │
│  │  server.js - Express API 服务                       │    │
│  │  - JWT 认证                                        │    │
│  │  - SQLite 数据库                                   │    │
│  │  - 渠道路由/负载均衡                                │    │
│  └────────────────────────────────────────────────────┘    │
└────────────────────────────┬───────────────────────────────┘
                             │
┌────────────────────────────▼───────────────────────────────┐
│                      数据层                                  │
│  ┌────────────────────────────────────────────────────┐    │
│  │  SQLite (/tmp/api-hub-v2.db)                        │    │
│  │  - inf_users: 用户表                               │    │
│  │  - inf_channels: 渠道表                            │    │
│  │  - inf_models: 模型表                              │    │
│  │  - inf_abilities: 渠道能力表                        │    │
│  │  - user_api_keys: 用户 API Key 表                  │    │
│  └────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

---

## 📁 项目结构

```
api-hub-v2-final/
├── index.html          # 前端单页应用 (213KB)
├── server.js           # 后端 API 服务 (73KB)
├── package.json        # Node.js 依赖
├── .env                # 环境变量 (JWT_SECRET)
├── database.sql        # 数据库初始化脚本
└── ARCHITECTURE.md     # 本文档
```

---

## 🔐 认证体系

### 登录认证流程

```
用户登录
    → POST /api/auth/login
    → 验证账号密码
    → 签发 JWT Token (有效期24小时)
    → 前端存储到 localStorage
    
API 请求
    → Header: Authorization: Bearer <token>
    → 后端验证 JWT
    → 返回数据
```

### Token 过期处理

前端已添加全局拦截器，当收到 401 错误时：
1. 自动清除 localStorage 中的 token
2. 跳转回登录页面
3. 提示用户重新登录

### JWT 配置

```bash
# .env 文件
JWT_SECRET=api-hub-v2-jiaguangqi-jwt-secret-2025
```

⚠️ **重要**: JWT_SECRET 必须固定，否则服务器重启后所有 token 失效

---

## 🗄️ 数据库设计

### 核心表结构

#### 1. inf_users - 用户表
```sql
CREATE TABLE inf_users (
  id TEXT PRIMARY KEY,           -- UUID
  account TEXT UNIQUE,           -- 登录账号
  name TEXT,                     -- 显示名称
  email TEXT,                    -- 邮箱
  password_hash TEXT,            -- bcrypt 加密密码
  external_user_key TEXT,        -- 外部用户标识
  role_code TEXT DEFAULT 'user', -- 角色: admin/user
  status TEXT DEFAULT 'ENABLED', -- 状态: ENABLED/DISABLED
  group_name TEXT DEFAULT 'default', -- 分组
  quota INTEGER DEFAULT 0,       -- 配额
  used_quota INTEGER DEFAULT 0,  -- 已使用配额
  created_at DATETIME
);
```

#### 2. inf_channels - 渠道表
```sql
CREATE TABLE inf_channels (
  id TEXT PRIMARY KEY,
  name TEXT,                     -- 渠道名称
  type INTEGER DEFAULT 0,        -- 渠道类型
  key TEXT,                      -- API Key (主)
  keys TEXT,                     -- API Key 列表 (JSON)
  base_url TEXT,                 -- 上游 API 地址
  models TEXT,                   -- 支持的模型 (JSON)
  weight INTEGER DEFAULT 1,      -- 权重 (负载均衡)
  priority INTEGER DEFAULT 0,    -- 优先级
  status INTEGER DEFAULT 1,      -- 状态: 1启用/0禁用
  response_time INTEGER,         -- 响应时间
  balance REAL,                  -- 余额
  created_at DATETIME
);
```

#### 3. inf_models - 模型表
```sql
CREATE TABLE inf_models (
  id TEXT PRIMARY KEY,
  model_id TEXT UNIQUE,          -- 模型ID (如 gpt-4o)
  name TEXT,                     -- 显示名称
  source_channel TEXT,           -- 来源渠道
  input_price REAL DEFAULT 0,    -- Input 价格 (¥/M tokens)
  output_price REAL DEFAULT 0,   -- Output 价格 (¥/M tokens)
  enabled_status TEXT,           -- 启用状态
  tags TEXT,                     -- 标签 (JSON)
  created_at DATETIME
);
```

#### 4. inf_abilities - 渠道能力表
```sql
CREATE TABLE inf_abilities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  channel_id TEXT,               -- 渠道ID
  model TEXT,                    -- 模型ID
  enabled INTEGER DEFAULT 1,     -- 是否启用
  priority INTEGER DEFAULT 0,    -- 优先级
  weight INTEGER DEFAULT 1,      -- 权重
  UNIQUE(channel_id, model)
);
```

#### 5. user_api_keys - 用户 API Key 表
```sql
CREATE TABLE user_api_keys (
  id TEXT PRIMARY KEY,
  user_id TEXT,                  -- 所属用户
  name TEXT,                     -- Key 名称
  api_key TEXT UNIQUE,           -- Key 值 (sk-xxx)
  quota INTEGER,                 -- 配额限制
  used_quota INTEGER DEFAULT 0,  -- 已使用配额
  expires_at DATETIME,           -- 过期时间
  allowed_models TEXT,           -- 允许的模型 (JSON)
  status TEXT DEFAULT 'ACTIVE',
  created_at DATETIME
);
```

---

## 🎨 前端页面结构

### 页面模块

| 页面 | ID | 功能 |
|------|-----|------|
| 登录页 | loginPage | 账号密码登录 |
| 概览页 | dashboardPage | 统计数据展示 |
| 渠道管理 | channelsPage | 渠道 CRUD |
| 模型管理 | modelsPage | 模型 CRUD |
| 用户管理 | usersPage | 用户 CRUD |
| 日志中心 | logsCenterPage | 多类型日志 |
| 系统设置 | settingsPage | 站点/支付设置 |
| 模型广场 | marketplacePage | 模型展示 |
| 体验中心 | playgroundPage | 模型测试 |
| 个人中心 | profilePage | API Key/用量/钱包 |

### 关键前端变量

```javascript
// API_URL 现在支持动态配置
// 1. 优先使用 window.API_HUB_CONFIG.apiUrl
// 2. 其次自动推断为 window.location.hostname:8080
// 3. 本地开发时默认使用 localhost:8080
const API_URL = (typeof window.API_HUB_CONFIG !== 'undefined' && window.API_HUB_CONFIG.apiUrl) 
    ? window.API_HUB_CONFIG.apiUrl 
    : `http://${window.location.hostname}:8080`;
    
let token = localStorage.getItem('token') || '';  // JWT Token
```

前端配置可通过 `config.js` 文件动态注入：
```javascript
// config.js (由部署脚本自动生成)
window.API_HUB_CONFIG = {
    apiUrl: 'http://<YOUR_SERVER_IP>:8080',
    serverIp: '<YOUR_SERVER_IP>',
    version: '2.0'
};
```

### 全局拦截器

```javascript
// 拦截所有 fetch 请求，处理 401 错误
const originalFetch = window.fetch;
window.fetch = async function(...args) {
    const res = await originalFetch.apply(this, args);
    if (res.status === 401 && args[0].includes(API_URL)) {
        // 清除 token 并跳转登录页
    }
    return res;
};
```

---

## 🔌 核心 API 列表

### 认证相关
- `POST /api/auth/login` - 登录
- `GET /api/auth/me` - 获取当前用户信息

### 管理员接口 (需要 admin 角色)
- `GET /api/admin/channels` - 获取渠道列表
- `POST /api/admin/channels` - 创建渠道
- `PUT /api/admin/channels/:id` - 更新渠道
- `DELETE /api/admin/channels/:id` - 删除渠道
- `POST /api/admin/channels/:id/test` - 测试渠道
- `GET /api/admin/models` - 获取模型列表
- `POST /api/admin/models` - 创建模型
- `PUT /api/admin/models/:id` - 更新模型
- `DELETE /api/admin/models/:id` - 删除模型
- `GET /api/admin/users` - 获取用户列表
- `POST /api/admin/users` - 创建用户

### 用户接口
- `GET /api/user/profile` - 获取个人信息
- `GET /api/user/api-keys` - 获取 API Key 列表
- `POST /api/user/api-keys` - 创建 API Key
- `DELETE /api/user/api-keys/:id` - 删除 API Key

### 体验中心
- `GET /api/playground/key` - 获取体验中心临时 Key
- `POST /api/playground/record` - 记录使用情况

### OpenAI 兼容接口
- `GET /v1/models` - 获取模型列表 (SSE)
- `POST /v1/chat/completions` - 聊天补全

### 系统
- `GET /health` - 健康检查

---

## 🚀 部署指南

### 环境要求
- Node.js 16+
- Python 3 (用于静态文件服务)

### 安装步骤

```bash
# 1. 进入项目目录
cd /opt/api-hub-v2

# 2. 安装依赖
npm install

# 3. 配置环境变量
cat > .env << 'EOF'
JWT_SECRET=your-fixed-secret-key
EOF

# 4. 启动后端服务
node server.js

# 5. 启动前端服务 (另开终端)
python3 -m http.server 3000
```

### 服务端口
- **3000**: 前端页面 (Python http.server)
- **8080**: 后端 API (Node.js)

### 访问地址
执行 `./deploy.sh` 后，可通过以下地址访问（<SERVER_IP> 为实际服务器IP）：
- 前端: http://<SERVER_IP>:3000
- 后端 API: http://<SERVER_IP>:8080
- 健康检查: http://<SERVER_IP>:8080/health

### 默认账号
- 账号: admin
- 密码: password

---

## ⚠️ 已知问题与解决方案

### 问题 1: Token 过期导致 401
**原因**: JWT_SECRET 未固定，服务器重启后 token 失效  
**解决**: 使用 .env 文件固定 JWT_SECRET

### 问题 2: Python http.server 缓存
**原因**: Python 的 http.server 会缓存静态文件  
**解决**: 修改 index.html 后重启 Python 服务
```bash
pkill -f 'python3 -m http.server 3000'
python3 -m http.server 3000
```

### 问题 3: 浏览器缓存
**解决**: 强制刷新 (Ctrl+Shift+R 或 Cmd+Shift+R)

---

## 📝 修改记录

| 日期 | 修改内容 |
|------|----------|
| 2026-02-12 | 完成个人中心功能 (API Key/用量统计/钱包) |
| 2026-02-15 | 修复 JWT_SECRET 固定问题，添加 401 自动处理 |
| 2026-02-16 | 价格单位改为人民币 (¥)，添加 dotenv 支持 |

---

## 📞 维护信息

### 部署配置
- **部署脚本**: `./deploy.sh` - 自动检测IP并配置
- **IP更新**: `./update-ip.sh` - 重新检测并更新IP配置
- **环境变量**: `.env` 文件

### 文件位置（默认）
- **项目路径**: ./api-hub-v2/
- **数据库**: ./data/api-hub-v2.db (SQLite)
- **日志**: ./logs/

### Systemd 服务（Linux）
```bash
# 启动服务
sudo systemctl start api-hub-v2

# 查看状态
sudo systemctl status api-hub-v2

# 查看日志
sudo journalctl -u api-hub-v2 -f
```

---

*文档生成时间: 2026-02-16*
*版本: v2.0*
