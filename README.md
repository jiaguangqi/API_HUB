# AI API Hub V2

A unified LLM API management and billing platform, similar to One-API / New-API.

English | [简体中文](./README_zh.md)

## 🎯 Features

- ✅ **Multi-channel Load Balancing** - Support multiple upstream channels with automatic fallback
- ✅ **Model Management** - Auto-sync models from upstream channels
- ✅ **User Quota & Billing** - Token-based usage tracking and billing
- ✅ **API Key Management** - Personal API keys for users
- ✅ **Model Playground** - Online testing experience center
- ✅ **OpenAI-compatible API** - Drop-in replacement for OpenAI API
- ✅ **Dynamic IP Configuration** - Auto-detect server IP during deployment

## 🏗️ Architecture

```
Frontend: HTML5 + Tailwind CSS (Port 3000)
Backend:  Node.js + Express + SQLite (Port 8080)
Config:   .env file (SERVER_IP auto-configured)
```

## 📦 File Structure

```
api-hub-v2-final/
├── index.html          # Frontend SPA
├── server.js           # Backend API server
├── package.json        # Node.js dependencies
├── .env                # Environment variables (auto-generated)
├── .env.example        # Environment template
├── deploy.sh           # One-click deployment script ⭐
├── update-ip.sh        # Update IP configuration
├── database.sql        # Database schema
├── config.js           # Frontend dynamic config (auto-generated)
└── README.md           # This file
```

## ⚡ Quick Start

### Prerequisites

- Node.js 18+ and npm
- Python 3 (for frontend static server, optional)
- Linux/macOS/Windows

### 🚀 Method 0: One-Click Deployment (Recommended)

```bash
# 1. Clone or extract project
cd api-hub-v2-final

# 2. Run deployment script
./deploy.sh
```

The script will automatically:
- Detect server IP address
- Configure `.env` with SERVER_IP
- Install npm dependencies
- Initialize database
- Create systemd service (Linux)
- Generate frontend config

**Access URLs:**
- Frontend: `http://<SERVER_IP>:3000`
- Backend API: `http://<SERVER_IP>:8080`
- Health Check: `http://<SERVER_IP>:8080/health`

### 🔄 Update IP (When Server IP Changes)

```bash
./update-ip.sh
```

### 🚀 Method 1: Manual Deployment

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env: Set SERVER_IP to your server IP or localhost

# 3. Start backend
node server.js

# 4. Start frontend (another terminal)
python3 -m http.server 3000
# Or use nginx, caddy, etc.
```

## ⚙️ Configuration

### Environment Variables (.env)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `JWT_SECRET` | Yes | - | JWT signing secret (change in production!) |
| `SERVER_IP` | Auto | localhost | Server IP address (auto-detected by deploy.sh) |
| `API_PORT` | No | 8080 | Backend API port |
| `FRONTEND_PORT` | No | 3000 | Frontend port |

**Example .env:**
```bash
JWT_SECRET=your-random-secret-key-here
SERVER_IP=192.168.1.100
API_PORT=8080
FRONTEND_PORT=3000
```

### Systemd Service (Linux)

The `deploy.sh` script automatically creates a systemd service:

```bash
# Start service
sudo systemctl start api-hub-v2

# Stop service
sudo systemctl stop api-hub-v2

# View logs
sudo journalctl -u api-hub-v2 -f

# Enable auto-start
sudo systemctl enable api-hub-v2
```

## 🔑 Default Credentials

- **Username:** `admin`
- **Password:** `password`

⚠️ **Change the default password immediately after first login!**

## 🛠️ API Endpoints

### OpenAI Compatible
```
GET  /v1/models              # List available models
POST /v1/chat/completions   # Chat completions (OpenAI format)
```

### Management API
```
POST /api/auth/login        # User login
GET  /api/admin/channels    # List channels (admin)
POST /api/admin/channels    # Create channel (admin)
GET  /api/user/api-keys     # List API keys
POST /api/user/api-keys     # Create API key
```

## 🐛 Troubleshooting

### Port Already in Use
```bash
# Find process using port 8080
sudo lsof -i :8080
# Or change port in .env
```

### Permission Denied
```bash
chmod +x deploy.sh update-ip.sh
```

### Database Locked
```bash
# Stop the service first
sudo systemctl stop api-hub-v2
# Then check/restart
```

### Frontend Shows "Connection Error"
- Check if backend is running: `curl http://localhost:8080/health`
- Verify `SERVER_IP` in `.env` matches your access URL
- Check browser console for CORS errors

## 🔒 Security Notes

1. **Change JWT_SECRET** immediately after deployment
2. **Change default admin password** after first login
3. **Use HTTPS** in production (configure reverse proxy)
4. **Firewall**: Only expose necessary ports (3000, 8080)
5. **Never commit .env file** (already in .gitignore)

## 📝 Changelog

| Date | Changes |
|------|---------|
| 2026-03-02 | Dynamic IP configuration, one-click deploy script |
| 2026-02-16 | Added server fixes (CORS, rate column, logging) |
| 2026-02-15 | Fixed JWT_SECRET persistence issue |
| 2026-02-12 | Added personal center (API Key, billing) |
| 2026-02-07 | Added playground, model marketplace |

## 📄 License

MIT License - See LICENSE file for details

## 🤝 Contributing

Issues and PRs are welcome!

---

**Version:** 2.0  
**Maintainer:** Jia Guang Qi
