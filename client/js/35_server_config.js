'use strict';
// 联机服务端地址。留空即自动推导：
//   · 客户端与服务端同域同端口 → 直接用当前地址
//   · 客户端在 18081、服务端在 18080 → 自动取同主机的 18080（局域网/公网部署都适用）
// 只有服务端在另一台主机/域名时才需要写死，例如 'https://api.example.com'。
// 注意：页面走 https 时这里也必须是 https，否则浏览器会按混合内容拦掉 fetch 与 WebSocket。
window.STEEL_FRONT_SERVER='';
