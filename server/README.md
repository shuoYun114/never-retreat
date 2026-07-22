# Steel Front dedicated server

Deploy this `server/` directory to a Linux VPS with Node.js 18+.

```bash
cd server
PORT=18080 node server.js
```

Persistent account data is stored in `data/accounts.json`. Back it up regularly; it contains password hashes and account credits.

The game client must be hosted separately and configured with this server's HTTP/WebSocket address.
