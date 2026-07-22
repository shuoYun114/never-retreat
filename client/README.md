# Steel Front client

This directory is the standalone static client. Upload it to a web host (Nginx/Caddy/static hosting) or test locally:

```bash
python -m http.server 8080
```

Before deployment, edit `js/35_server_config.js`:

```js
window.STEEL_FRONT_SERVER='https://api.example.com';
```

The API address must use HTTPS when the client page is HTTPS, otherwise browsers will block the connection.
