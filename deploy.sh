#!/bin/bash

# AI API Hub V2 - 一键部署脚本
# 自动检测服务器IP并配置项目

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  AI API Hub V2 - 一键部署脚本${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# 获取脚本所在目录
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# ==================== 函数定义 ====================

# 检测服务器IP
detect_server_ip() {
    echo -e "${YELLOW}[1/5] 检测服务器IP地址...${NC}"
    
    # 尝试多种方式获取IP
    local_ip=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "")
    
    if [ -z "$local_ip" ]; then
        local_ip=$(ip route get 1 2>/dev/null | awk '{print $7;exit}' || echo "")
    fi
    
    if [ -z "$local_ip" ]; then
        local_ip=$(ifconfig 2>/dev/null | grep -E "inet (addr:)?(192|10|172)" | head -1 | awk '{print $2}' | sed 's/addr://' || echo "")
    fi
    
    if [ -z "$local_ip" ]; then
        local_ip=$(ipconfig 2>/dev/null | grep -i "ipv4" | head -1 | awk -F: '{print $2}' | tr -d ' ' || echo "")
    fi
    
    if [ -z "$local_ip" ]; then
        echo -e "${YELLOW}⚠ 无法自动检测IP地址${NC}"
        read -p "请手动输入服务器IP地址 (默认: localhost): " user_ip
        local_ip=${user_ip:-localhost}
    fi
    
    echo -e "${GREEN}✓ 检测到服务器IP: $local_ip${NC}"
}

# 配置环境变量
setup_env() {
    echo -e "${YELLOW}[2/5] 配置环境变量...${NC}"
    
    if [ ! -f ".env" ]; then
        echo -e "${YELLOW}创建 .env 文件...${NC}"
        cat > .env << EOF
JWT_SECRET=api-hub-v2-$(date +%s)-$(openssl rand -hex 8)
SERVER_IP=$local_ip
API_PORT=8080
FRONTEND_PORT=3000
EOF
    else
        # 更新现有 .env 文件
        if grep -q "^SERVER_IP=" .env; then
            sed -i "s/^SERVER_IP=.*/SERVER_IP=$local_ip/" .env 2>/dev/null || \
            sed -i.bak "s/^SERVER_IP=.*/SERVER_IP=$local_ip/" .env && rm -f .env.bak
        else
            echo "SERVER_IP=$local_ip" >> .env
        fi
        
        # 确保其他必要变量存在
        if ! grep -q "^API_PORT=" .env; then
            echo "API_PORT=8080" >> .env
        fi
        if ! grep -q "^FRONTEND_PORT=" .env; then
            echo "FRONTEND_PORT=3000" >> .env
        fi
    fi
    
    echo -e "${GREEN}✓ 环境变量配置完成${NC}"
    echo -e "${BLUE}   SERVER_IP=$local_ip${NC}"
}

# 安装依赖
install_dependencies() {
    echo -e "${YELLOW}[3/5] 检查并安装依赖...${NC}"
    
    # 检查Node.js
    if ! command -v node &> /dev/null; then
        echo -e "${RED}✗ Node.js 未安装${NC}"
        echo "请安装 Node.js 18+ : https://nodejs.org/"
        exit 1
    fi
    
    node_version=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$node_version" -lt 18 ]; then
        echo -e "${RED}✗ Node.js 版本过低 (当前: $(node --version), 需要: 18+)${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✓ Node.js 版本: $(node --version)${NC}"
    
    # 安装npm依赖
    if [ ! -d "node_modules" ]; then
        echo -e "${YELLOW}安装 npm 依赖...${NC}"
        npm install
    else
        echo -e "${GREEN}✓ 依赖已安装${NC}"
    fi
}

# 初始化数据库
init_database() {
    echo -e "${YELLOW}[4/5] 初始化数据库...${NC}"
    
    # 数据库会在首次启动时自动创建
    echo -e "${GREEN}✓ 数据库配置完成 (启动时自动初始化)${NC}"
}

# 创建前端配置
setup_frontend() {
    echo -e "${YELLOW}[5/5] 配置前端...${NC}"
    
    # 创建 config.js 用于前端动态配置
    cat > config.js << EOF
// AI API Hub V2 - 动态配置文件
// 由部署脚本自动生成，请勿手动修改

window.API_HUB_CONFIG = {
    apiUrl: 'http://$local_ip:8080',
    serverIp: '$local_ip',
    version: '2.0'
};
EOF
    
    # 在 index.html 中引入 config.js（如果不存在）
    if ! grep -q "config.js" index.html; then
        # 在第一个 <script> 标签前插入
        sed -i 's|<script src="https://cdn.tailwindcss.com">|<script src="config.js"></script>\n    <script src="https://cdn.tailwindcss.com">|' index.html 2>/dev/null || \
        sed -i.bak 's|<script src="https://cdn.tailwindcss.com">|<script src="config.js"></script>\n    <script src="https://cdn.tailwindcss.com">|' index.html && rm -f index.html.bak
    fi
    
    echo -e "${GREEN}✓ 前端配置完成${NC}"
}

# 创建 Systemd 服务（Linux）
setup_service() {
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        echo -e "${YELLOW}[额外] 创建系统服务...${NC}"
        
        SERVICE_FILE="/etc/systemd/system/api-hub-v2.service"
        
        if [ -w "/etc/systemd/system" ]; then
            sudo tee "$SERVICE_FILE" > /dev/null << EOF
[Unit]
Description=AI API Hub V2 Backend
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$SCRIPT_DIR
ExecStart=$(which node) $SCRIPT_DIR/server.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF
            
            sudo systemctl daemon-reload
            echo -e "${GREEN}✓ 系统服务已创建${NC}"
            echo "   启动: sudo systemctl start api-hub-v2"
            echo "   停止: sudo systemctl stop api-hub-v2"
            echo "   自启: sudo systemctl enable api-hub-v2"
        else
            echo -e "${YELLOW}⚠ 无权限创建系统服务，跳过${NC}"
        fi
    fi
}

# 输出部署信息
show_deployment_info() {
    echo ""
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}  部署完成！${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""
    echo -e "${BLUE}访问地址:${NC}"
    echo -e "  前端界面: ${YELLOW}http://$local_ip:3000${NC}"
    echo -e "  后端API:  ${YELLOW}http://$local_ip:8080${NC}"
    echo -e "  健康检查: ${YELLOW}http://$local_ip:8080/health${NC}"
    echo ""
    echo -e "${BLUE}启动命令:${NC}"
    echo -e "  后端: ${YELLOW}node server.js${NC}"
    echo -e "  前端: ${YELLOW}python3 -m http.server 3000${NC} 或 nginx"
    echo ""
    echo -e "${BLUE}默认账号:${NC}"
    echo -e "  账号: ${YELLOW}admin${NC}"
    echo -e "  密码: ${YELLOW}password${NC}"
    echo ""
    echo -e "${BLUE}配置文件:${NC}"
    echo -e "  .env: $SCRIPT_DIR/.env"
    echo -e "  数据库: ./data/api-hub-v2.db"
    echo ""
}

# ==================== 主流程 ====================

main() {
    detect_server_ip
    setup_env
    install_dependencies
    init_database
    setup_frontend
    setup_service
    show_deployment_info
}

# 处理命令行参数
case "${1:-}" in
    --help|-h)
        echo "用法: $0 [选项]"
        echo ""
        echo "选项:"
        echo "  --help, -h     显示帮助"
        echo "  --local        强制使用 localhost 模式"
        echo ""
        echo "示例:"
        echo "  $0             # 自动检测IP并部署"
        echo "  $0 --local     # 本地开发模式"
        exit 0
        ;;
    --local)
        local_ip="localhost"
        setup_env
        install_dependencies
        init_database
        setup_frontend
        show_deployment_info
        ;;
    *)
        main
        ;;
esac
