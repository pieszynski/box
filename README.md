# BOX

Angular PWA with a circular countdown timer, theming support, and system notifications.

## Docker

The image exposes two ports:

| Port | Protocol | Active when |
|------|----------|-------------|
| **80** | HTTPS | `tls.crt` and `tls.key` are mounted |
| **81** | HTTP | Always |

### Run without TLS (HTTP only)

```bash
docker run -d -p 3001:81 ghcr.io/pieszynski/box:latest
```

App is available at `http://localhost:3001`.

---

### Run with TLS (HTTPS on port 80, HTTP on port 81)

The container reads the certificate from the directory mounted at `/etc/nginx/certs/`.
The directory **must** contain exactly these two files:

```
/etc/nginx/certs/tls.crt   ← full certificate chain (PEM)
/etc/nginx/certs/tls.key   ← private key (PEM)
```

#### Option A — mount a directory

Prepare a directory on the host that contains `tls.crt` and `tls.key`:

```
/path/to/certs/
├── tls.crt
└── tls.key
```

Then run:

```bash
docker run -d \
  -p 3005:80 \
  -p 3001:81 \
  -v /path/to/certs:/etc/nginx/certs:ro \
  ghcr.io/pieszynski/box:latest
```

App is available at `https://localhost:3005` (HTTPS) and `http://localhost:3001` (HTTP).

#### Option B — mount individual files

Useful when your cert manager places files in different locations (e.g. Let's Encrypt):

```bash
docker run -d \
  -p 443:80 \
  -p 80:81 \
  -v /etc/letsencrypt/live/example.com/fullchain.pem:/etc/nginx/certs/tls.crt:ro \
  -v /etc/letsencrypt/live/example.com/privkey.pem:/etc/nginx/certs/tls.key:ro \
  ghcr.io/pieszynski/box:latest
```

> **Note:** Let's Encrypt uses symlinks that change on renewal. Mount the files directly (not the symlinks) or mount the parent `live/` directory and adjust the paths accordingly.

---

### Certificate rotation (Let's Encrypt / auto-renew)

No container restart is needed. The container runs a background process that issues `nginx -s reload` every **6 hours**, which picks up any new certificate files from the mounted volume without dropping existing connections.

If you need an immediate reload after renewal (e.g. from a Certbot deploy hook), run:

```bash
docker exec <container_name> nginx -s reload
```

---

### Icon regeneration

To regenerate `favicon.ico` and all PWA icons after editing `public/icon.svg`:

```bash
cd src
node generate-icons.mjs
```
