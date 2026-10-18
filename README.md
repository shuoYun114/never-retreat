# 钢铁前线 / Never Retreat

<div align="center">

[English](README_EN.md) · **简体中文**

> **Never Retreat** — 一款浏览器原生运行的二战低多边形 3D 第一人称战场射击游戏。

[![License: MIT](https://img.shields.io/badge/License-MIT-brightgreen.svg?style=flat-square)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?style=flat-square&logo=node.js)](https://nodejs.org/)
[![Three.js](https://img.shields.io/badge/Three.js-WebGL-black?style=flat-square&logo=three.js)](https://threejs.org/)
[![Multiplayer](https://img.shields.io/badge/Multiplayer-Room_Based-orange?style=flat-square)](https://github.com/shuoYun114/never-retreat)

<p align="center">
  <b>无需安装独立客户端，纯现代浏览器畅玩；支持单人 BOT 战役、房间多端联机、账号战功结算、战地商店与手机横屏双摇杆触控。</b>
</p>

</div>

---

## 📸 游戏实机与演示 (Screenshots & Demo)

<div align="center">
  <img src="https://img.shields.io/badge/Battlefield-WWII_Low--Poly-blue?style=for-the-badge" alt="Cover" />
  <p><i>⚔️ 二战全要素沙盒战场：步兵、重装坦克、战机俯冲与野战火炮协同</i></p>
</div>

> [!NOTE]
> 🎮 **原作者致谢**：原作者 [@stupid_scout](https://b23.tv/KibKesr) (UID: 517637254)。  
> 本仓库在原作优秀底层基础上，持续推进 Web 端深度移植、WebSocket 房间联机、账号资产持久化、移动端陀螺仪触控与全要素玩法演进。

---

## ✨ 核心玩法特性 (Features)

- **全要素二战沙盒战局**：操纵步兵、重型坦克、战机、运兵卡车、野战火炮、高平两用机枪与迫击炮协同作战。
- **动态战术夺旗征服**：非线性据点争夺体系，无固定推进限制，全战场据点自由机动占领。
- **双模体验**：
  - **单人战役**：高拟真智能 BOT 战术包抄与火力压制。
  - **房主制多人联机**：通过 6 位房号快速集结，房主自主把控战役规模、兵力上限与阵营分配。
- **服务端权威裁定 (Authoritative Server)**：枪械弹道、爆头修正、爆炸冲击波衰减及战功发放全量由服务端裁决，严防本地修改作弊。
- **小队动态战术部署**：支持在存活小队成员身边切入战场（周边处于敌火交战区时动态封锁）。
- **局内全域通信**：队伍与全局双频道即时战术文字沟通。
- **战绩与装备成长体系**：胜率、场次、K/D 服务端安全记账；用战功在战地商店换购枪械配件并进行多兵种个性化配装。
- **全端跨平台触控适配**：手机与平板横屏专属虚拟双摇杆、HUD 动态排布及原生陀螺仪辅助瞄准微调。

---

## 🏗️ 系统架构设计 (Architecture)

游戏采用客户端轻量化渲染 + 服务端权威状态判定的架构体系：

```mermaid
graph TD
    subgraph Client ["前端客户端 (Browser / Mobile)"]
        UI[HUD 仪表盘 / 触控 / 键鼠输入] --> Controller[玩家移动与视线控制器]
        Controller --> RenderEngine[Three.js WebGL 3D 渲染主循环]
        NetClient[WebSocket 客户端网络层] <--> ServerSync[预测回放与插值平滑]
    end

    subgraph Server ["权威服务端 (Node.js Service)"]
        WS[WebSocket 连接分发网关] --> RoomMgr[战役房间与实例调度]
        RoomMgr --> Physics[服务端物理判定 & 弹道伤害计算]
        RoomMgr --> AccountDB[账号资产、结算与战功持久化 (JSON/DB)]
    end

    NetClient <==> |TCP/WSS 状态帧同步| WS
```

---

## 🛠️ 安装指南 (Installation)

### 1. 运行环境准备 (Prerequisites)
- [Node.js](https://nodejs.org/) (推荐 v18.0 或更高版本)
- Python 3（用于本地轻量静态网页托管，或任意 Web 服务器如 Nginx / Caddy）

### 2. 克隆项目

```bash
git clone https://github.com/shuoYun114/never-retreat.git
cd never-retreat
```

---

## 🚀 使用指南 (Usage)

### 1. 启动联机服务端 (Game Server)

```bash
cd server
node server.js
```
*服务端默认监听本地 `http://127.0.0.1:18080`。*

### 2. 启动客户端网页 (Web Client)

另起终端窗口：

```bash
cd client
python -m http.server 18081
```

在现代浏览器中直接访问：
```text
http://127.0.0.1:18081
```

### 3. 操作按键指南 (Keybindings)

| 核心动作 | 键盘 / 鼠标按键 | 手机触控交互 |
| :--- | :--- | :--- |
| **机动 / 战术冲刺** | `W` `A` `S` `D` / `Shift` | 左侧虚拟操纵摇杆 |
| **开火 / 机械瞄准** | 鼠标左键 / 鼠标右键 | 右侧射击按键 / 陀螺仪微调 |
| **战术换弹 / 切枪** | `R` / 数字键 `1` `2` | 屏幕专用 HUD 快捷图标 |
| **手雷 / 烟雾弹 / 地雷** | `G` / `4` / `3` | 右侧投掷物专属浮层 |
| **载具乘降与交互** | `F` | 场景准星交互感知弹窗 |
| **暂停 / 战役结算** | `Esc` | 顶部汉堡菜单按钮 `≡` |

---

## 🧪 自动化测试 (Testing)

服务端包含严谨的账号资产结算与比赛状态流转自动化测试：

```bash
cd server
node --test test/account-assets.test.js test/match-settlement.test.js
```

---

## 🚢 部署说明 (Deployment)

### 远程私有化联机部署

若需公网多人联机，请按如下步骤配置：
1. 将 `server/` 部署至具备公网 IP 的 VPS，并使用 PM2 或 Docker 进行守护。
2. 编辑 `client/js/35_server_config.js`，指定你的公网服务网关：
   ```javascript
   window.STEEL_FRONT_SERVER = 'https://game.your-domain.com:18080';
   ```
3. 强烈推荐前置 Nginx 配置 SSL/TLS 证书以开启 WSS 安全长连接。

---

## 📡 通信协议规范 (API & Protocol)

客户端与服务端通过标准化 JSON WebSocket 报文进行帧状态交互：

```typescript
// 战局结算通知报文结构
interface MatchSettlementPayload {
  roomId: string;
  matchDuration: number;
  winnerFaction: 'Allies' | 'Axis';
  personalStats: {
    kills: number;
    headshots: number;
    deaths: number;
    scoreGained: number;
  };
}
```

---

## 📄 开源许可证 (License)

本项目基于 [MIT License](LICENSE) 开源。二次开发请务必遵循并保留原作者与后续贡献者版权声明。
