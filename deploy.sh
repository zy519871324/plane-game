#!/bin/bash

# 雷电战机 VPS 部署脚本
# 支持 Python http.server 和 Nginx 两种部署方式

set -e

REPO_URL="${1:-https://github.com/你的用户名/plane-game.git}"
DEPLOY_DIR="/var/www/plane-game"
PORT="${PORT:-8080}"
USE_NGINX="${USE_NGINX:-false}"

echo "🚀 开始部署雷电战机游戏..."

# 检测系统
if command -v apt-get &> /dev/null; then
    PKG_MANAGER="apt-get"
    INSTALL_CMD="apt-get install -y"
elif command -v yum &> /dev/null; then
    PKG_MANAGER="yum"
    INSTALL_CMD="yum install -y"
elif command -v apk &> /dev/null; then
    PKG_MANAGER="apk"
    INSTALL_CMD="apk add"
else
    echo "⚠️ 未检测到支持的包管理器，假设已安装必要软件"
    PKG_MANAGER="none"
fi

# 安装必要软件
if [ "$PKG_MANAGER" != "none" ]; then
    echo "📦 检查并安装必要软件..."
    if ! command -v git &> /dev/null; then
        sudo $INSTALL_CMD git
    fi
    if ! command -v python3 &> /dev/null; then
        sudo $INSTALL_CMD python3
    fi
    if [ "$USE_NGINX" = "true" ] && ! command -v nginx &> /dev/null; then
        sudo $INSTALL_CMD nginx
    fi
fi

# 克隆/更新代码
if [ -d "$DEPLOY_DIR" ]; then
    echo "🔄 更新代码..."
    cd "$DEPLOY_DIR"
    git pull
else
    echo "📥 克隆代码仓库..."
    sudo mkdir -p "$(dirname "$DEPLOY_DIR")"
    if [ "$REPO_URL" != "https://github.com/你的用户名/plane-game.git" ]; then
        sudo git clone "$REPO_URL" "$DEPLOY_DIR"
    else
        echo "❌ 请先修改 REPO_URL 为你的 GitHub 仓库地址"
        echo "用法: ./deploy.sh https://github.com/用户名/仓库名.git"
        exit 1
    fi
fi

# 部署方式选择
if [ "$USE_NGINX" = "true" ]; then
    echo "🌐 使用 Nginx 部署..."
    
    # 配置 Nginx
    NGINX_CONF="/etc/nginx/sites-available/plane-game"
    sudo tee "$NGINX_CONF" > /dev/null <<EOF
server {
    listen 80;
    server_name _;
    root $DEPLOY_DIR;
    index index.html;
    
    location / {
        try_files \$uri \$uri/ =404;
    }
}
EOF
    
    # 启用配置
    if [ -d /etc/nginx/sites-enabled ]; then
        sudo ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/plane-game
        sudo rm -f /etc/nginx/sites-enabled/default
    fi
    
    # 测试并重启 Nginx
    sudo nginx -t
    sudo systemctl restart nginx || sudo service nginx restart
    
    echo "✅ Nginx 部署完成！"
    echo "🌐 访问: http://你的VPS_IP"
else
    echo "🐍 使用 Python HTTP 服务器部署在端口 $PORT ..."
    
    cd "$DEPLOY_DIR"
    
    # 创建 systemd 服务
    SERVICE_FILE="/etc/systemd/system/plane-game.service"
    if command -v systemctl &> /dev/null; then
        echo "📝 创建 systemd 服务..."
        sudo tee "$SERVICE_FILE" > /dev/null <<EOF
[Unit]
Description=Plane Game HTTP Server
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=$DEPLOY_DIR
ExecStart=/usr/bin/python3 -m http.server $PORT
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
        
        # 如果没有 www-data 用户，使用当前用户
        if ! id www-data &> /dev/null; then
            sudo sed -i "s/User=www-data/User=$USER/" "$SERVICE_FILE"
        fi
        
        sudo systemctl daemon-reload
        sudo systemctl enable plane-game
        sudo systemctl restart plane-game
        
        echo "✅ 服务已启动并设置为开机自启"
    else
        # 无 systemd，使用 nohup
        echo "📝 使用 nohup 启动..."
        pkill -f "python3 -m http.server $PORT" || true
        nohup python3 -m http.server "$PORT" > /dev/null 2>&1 &
        echo "✅ 后台启动完成"
    fi
    
    echo "🌐 访问: http://你的VPS_IP:$PORT"
fi

# 防火墙提示
echo ""
echo "📋 部署信息:"
echo "  部署目录: $DEPLOY_DIR"
if [ "$USE_NGINX" = "true" ]; then
    echo "  访问地址: http://你的VPS_IP"
    echo "  服务: Nginx"
else
    echo "  访问地址: http://你的VPS_IP:$PORT"
    echo "  服务: Python HTTP Server"
fi
echo ""
echo "🔥 如果无法访问，请检查防火墙/安全组是否放行了相应端口"
