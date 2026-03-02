#!/bin/bash

# AI API Hub V2 - IP配置更新脚本
# 用于重新检测IP并更新配置

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# 颜色
green() { echo -e "\033[0;32m$1\033[0m"; }
yellow() { echo -e "\033[1;33m$1\033[0m"; }
blue() { echo -e "\033[0;34m$1\033[0m"; }

yellow "[更新IP配置]"

# 检测新IP
new_ip=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "")
if [ -z "$new_ip" ]; then
    new_ip=$(ip route get 1 2>/dev/null | awk '{print $7;exit}' || echo "")
fi

if [ -z "$new_ip" ]; then
    read -p "请输入新的服务器IP: " new_ip
fi

# 更新 .env
if grep -q "^SERVER_IP=" .env; then
    sed -i.bak "s/^SERVER_IP=.*/SERVER_IP=$new_ip/" .env && rm -f .env.bak
else
    echo "SERVER_IP=$new_ip" >> .env
fi

blue "已更新 SERVER_IP=$new_ip"

# 更新 config.js
cat > config.js << EOF
// AI API Hub V2 - 动态配置文件
window.API_HUB_CONFIG = {
    apiUrl: 'http://$new_ip:8080',
    serverIp: '$new_ip',
    version: '2.0'
};
EOF

blue "已更新 config.js"

green "✓ IP配置更新完成！"
echo ""
echo "新访问地址:"
echo "  前端: http://$new_ip:3000"
echo "  后端: http://$new_ip:8080"
echo ""
echo "提示: 如果服务正在运行，请重启以应用新配置"
