# AI API Hub V2

大语言模型 API 聚合与计费管理平台，类似 One-API / New-API。

[English](./README.md) | 简体中文

## 🎯 功能特性

- ✅ **多渠道负载均衡** - 支持多个上游渠道，自动故障转移
- ✅ **模型管理** - 从上游渠道自动同步模型列表
- ✅ **用户配额与计费** - 基于 Token 的用量统计和计费
- ✅ **API Key 管理** - 为用户提供个人 API Key
- ✅ **模型广场** - 在线体验中心，可直接测试模型
- ✅ **OpenAI 兼容接口** - 完美兼容 OpenAI API 格式
- ✅ **动态 IP 配置** - 部署时自动检测服务器 IP

## 🏗️ 技术架构

```
前端：HTML5 + Tailwind CSS (端口 3000)
后端：Node.js + Express + SQLite (端口 8080)
配置：.env 文件 (SERVER_IP 自动配置)
```

## 📦 项目结构

```
api-hub-v2-final/
├── index.html          # 前端单页应用
├── server.js           # 后端 API 服务
├── package.json        # Node.js 依赖
├── .env                # 环境变量 (自动生成)
├── .env.example        # 环境变量模板
├── deploy.sh           # 一键部署脚本 ⭐
├── update-ip.sh        # 更新 IP 配置
├── database.sql        # 数据库结构
├── config.js           # 前端动态配置 (自动生成)
└── README_zh.md        # 本文件
```

## ⚡ 快速开始

### 环境要求

- Node.js 18+ 和 npm
- Python 3 (用于前端静态服务器，可选)
- Linux/macOS/Windows

### 🚀 方式零：一键部署（推荐）

```bash
# 1. 进入项目目录
cd api-hub-v2-final

# 2. 执行部署脚本
./deploy.sh
```

脚本将自动完成：
- 检测服务器 IP 地址
- 配置 `.env` 的 SERVER_IP
- 安装 npm 依赖
- 初始化数据库
- 创建 systemd 服务（Linux）
- 生成前端配置文件

**访问地址：**
- 前端界面：`http://<服务器IP>:3000`
- 后端 API：`http://<服务器IP>:8080`
- 健康检查：`http://<服务器IP>:8080/health`

### 🔄 更新 IP（服务器 IP 变化时）

```bash
./update-ip.sh
```

### 🚀 方式一：手动部署

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env：将 SERVER_IP 设置为服务器 IP 或 localhost

# 3. 启动后端
node server.js

# 4. 启动前端（另一个终端）
python3 -m http.server 3000
# 或使用 nginx、caddy 等
```

## ⚙️ 配置说明

### 环境变量（.env）

| 变量名 | 必填 | 默认值 | 说明 |
|--------|------|--------|------|
| `JWT_SECRET` | 是 | - | JWT 签名密钥（生产环境务必修改！） |
| `SERVER_IP` | 自动 | localhost | 服务器 IP 地址（deploy.sh 自动检测） |
| `API_PORT` | 否 | 8080 | 后端 API 端口 |
| `FRONTEND_PORT` | 否 | 3000 | 前端端口 |

**示例 .env：**
```bash
JWT_SECRET=your-random-secret-key-here
SERVER_IP=192.168.1.100
API_PORT=8080
FRONTEND_PORT=3000
```

### Systemd 服务（Linux）

`deploy.sh` 脚本会自动创建 systemd 服务：

```bash
# 启动服务
sudo systemctl start api-hub-v2

# 停止服务
sudo systemctl stop api-hub-v2

# 查看日志
sudo journalctl -u api-hub-v2 -f

# 设置开机自启
sudo systemctl enable api-hub-v2
```

## 🔑 默认账号

- **用户名：** `admin`
- **密码：** `password`

⚠️ **首次登录后请立即修改默认密码！**

## 🛠️ API 接口

### OpenAI 兼容接口
```
GET  /v1/models              # 获取模型列表
POST /v1/chat/completions   # 对话补全（OpenAI 格式）
```

### 管理接口
```
POST /api/auth/login        # 用户登录
GET  /api/admin/channels    # 获取渠道列表（管理员）
POST /api/admin/channels    # 创建渠道（管理员）
GET  /api/user/api-keys     # 获取 API Key 列表
POST /api/user/api-keys     # 创建 API Key
```

## 🐛 常见问题

### 端口被占用
```bash
# 查找占用 8080 端口的进程
sudo lsof -i :8080
# 或在 .env 中修改端口
```

### 权限不足
```bash
chmod +x deploy.sh update-ip.sh
```

### 数据库锁定
```bash
# 先停止服务
sudo systemctl stop api-hub-v2
# 然后检查/重启
```

### 前端显示"连接错误"
- 检查后端是否运行：`curl http://localhost:8080/health`
- 确认 `.env` 中的 `SERVER_IP` 与访问地址一致
- 查看浏览器控制台是否有 CORS 错误

## 🔒 安全提示

1. **立即修改 JWT_SECRET** 部署后务必更换
2. **修改默认管理员密码** 首次登录后必须修改
3. **生产环境使用 HTTPS** 配置反向代理
4. **防火墙设置** 只暴露必要端口（3000, 8080）
5. **切勿提交 .env 文件** 已在 .gitignore 中排除

## 📝 更新日志

| 日期 | 更新内容 |
|------|----------|
| 2026-03-02 | 动态 IP 配置、一键部署脚本 |
| 2026-02-16 | 修复服务器问题（CORS、rate 字段、日志） |
| 2026-02-15 | 修复 JWT_SECRET 持久化问题 |
| 2026-02-12 | 新增个人中心（API Key、计费） |
| 2026-02-07 | 新增模型广场、体验中心 |

## 📄 许可证

MIT 许可证 - 详见 LICENSE 文件

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

---

**版本：** 2.0  
**维护者：** 郏光QI
