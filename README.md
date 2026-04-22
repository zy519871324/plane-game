# ⚡ 雷电战机 - 打飞机升级游戏

一个基于 HTML5 Canvas 的雷电类型打飞机升级游戏，支持电脑和移动端游玩。

## 🎮 操作说明

| 按键 | 功能 |
|------|------|
| WASD / 方向键 | 移动战机 |
| 空格 / 鼠标左键 / 触摸 | 发射子弹 |
| B | 使用炸弹（清屏） |
| P / Esc | 暂停游戏 |

## 🆙 升级系统

每关消灭 Boss 后可以选择一项升级：
- **🔥 火力强化**：子弹数量 +1，伤害提升
- **⚡ 速度提升**：移动速度 +15%，射速 +10%
- **🛡️ 护盾强化**：获得护盾，可抵挡 1 次伤害
- **💣 炸弹补充**：炸弹 +2，清屏并造成大量伤害

## 🚀 本地运行

```bash
# 使用 Python
python3 -m http.server 8080

# 或使用 Node.js
npx serve .
```

然后打开浏览器访问 `http://localhost:8080`

## 🌐 VPS 部署

在 VPS 上执行：

```bash
# 1. 克隆代码
git clone https://github.com/你的用户名/plane-game.git

# 2. 进入目录
cd plane-game

# 3. 运行部署脚本
chmod +x deploy.sh
./deploy.sh
```

默认使用 Python HTTP 服务器运行在 8080 端口，也可选择 Nginx 部署。

## 📁 文件结构

```
plane-game/
├── index.html    # 游戏主页面
├── style.css     # 样式文件
├── game.js       # 游戏核心逻辑
├── deploy.sh     # VPS 部署脚本
└── README.md     # 说明文档
```

## 📝 技术特性

- HTML5 Canvas 渲染
- Web Audio API 音效
- 响应式设计，支持移动端触摸操作
- 粒子爆炸特效
- 屏幕震动效果
- 关卡与 Boss 系统
