# Steel Front / Never Retreat

[中文](README.md)

> **Never Retreat**

A browser-based, low-poly World War II first-person battlefield game. It supports single-player BOT campaigns, room-based multiplayer, account-bound progression, a weapon shop, class loadouts, and landscape mobile controls.

![License](https://img.shields.io/badge/license-MIT-green)
![Node](https://img.shields.io/badge/Node.js-18%2B-339933)

## Credits and Original Author

Original author: [@stupid_scout](https://b23.tv/KibKesr)  
UID: `517637254`

This repository continues development on top of the original work, including browser delivery, multiplayer, account assets, mobile controls, and gameplay features. Please retain this attribution when using, redistributing, or building upon the project.

## Features

- World War II first-person battlefield: infantry, tanks, aircraft, APCs, artillery, machine guns, and mortars
- Assault, conquest, and demolition campaigns; objectives can be captured freely without an A → B → C requirement
- Single-player BOT campaigns and room-based online multiplayer
- Server-side accounts: credits, owned weapons, attachments, and class loadouts persist per account
- Field shop with rifles, sniper rifles, assault weapons, pistols, and attachments
- Per-class loadouts with saved weapon customization
- One active device per account; a new login invalidates the old session
- Landscape mobile controls: virtual stick/buttons, pause menu, and gyroscope aim assist

## Project Layout

```text
client/              Static browser client
  index.html
  css/
  js/
  vendor/
server/              Node.js account, settlement, and multiplayer service
  server.js
  lib/
  test/
```

> `server/data/accounts.json` is runtime account data containing password hashes and player assets. It is intentionally not committed to GitHub.

## Run Locally

### 1. Requirements

- Node.js 18 or newer
- Python 3 (only used here for a quick static client server)

### 2. Start the server

```bash
cd server
node server.js
```

The default API/WebSocket service listens on `http://127.0.0.1:18080`.

### 3. Start the client

Open another terminal:

```bash
cd client
python -m http.server 18081
```

Then open:

```text
http://127.0.0.1:18081
```

### 4. Configure a remote server (optional)

Edit `client/js/35_server_config.js`:

```js
window.STEEL_FRONT_SERVER = 'http://your-server-domain:18080';
```

Use HTTPS/WSS in production. Never expose the account database through the static `client/` directory.

## How to Play

1. Open **Account Login** and register or sign in.
2. In **Start Game**, choose your team, difficulty, and battle size, then enter the battlefield.
3. Select a class and spawn point on the deployment screen, then deploy.
4. Capture objectives, fight enemies, and complete the campaign. The server settles a match once when it ends naturally or when you end it early.
5. Spend credits in the **Field Shop** and save class-specific equipment in **Loadout**.

### Keyboard and Mouse

| Action | Controls |
|---|---|
| Move / Sprint | WASD / Shift |
| Fire / Aim | Left mouse / Right mouse |
| Reload, switch weapon, melee | R, 1/2, V |
| Grenade / smoke / AT grenade | G, 4, 3 |
| Interact | F |
| Class skill | B |
| Pause / end a match early | Esc |

### Mobile

Landscape orientation is recommended. Use the virtual stick on the left to move and buttons on the right for firing, aiming, reloading, and throwing.

- **Gyro**: Tap once and allow the browser's motion/orientation permission. Rotate the phone for fine aim adjustments.
- **≡**: Opens the pause menu, where you can resume or end the current match.

## Tests

```bash
cd server
node --test test/account-assets.test.js test/match-settlement.test.js
```

## Security and Deployment Notes

- Do not commit `server/data/accounts.json`, `.env` files, logs, NAS backups, or passwords.
- The JSON account store is intended for a small single-instance deployment. Migrate to SQLite or PostgreSQL for larger-scale operation.
- Real-player PvP kill rewards are recorded by the server. Browser-local state must not be treated as a trusted asset source.

## License

This repository is available under the [MIT License](LICENSE). Please retain the original-author attribution.
