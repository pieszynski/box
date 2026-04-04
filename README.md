# BOX

Angular PWA with a circular countdown timer, theming support, and system notifications.

## Local development

```bash
cd src/

# prepare certificates
dotnet dev-certs https -ep .vscode/box.pem --format Pem --trust -np

# run 
npm start
```

## Docker

The image exposes two ports:

| Port | Protocol | Active when |
|------|----------|-------------|
| **80** | HTTP | Always |
| **443** | HTTPS | `tls.crt` and `tls.key` are mounted |

### Run without TLS (HTTP only)

```bash
docker run -d -p 3001:80 ghcr.io/pieszynski/box:latest
```

App is available at `http://localhost:3001`.

---

### Run with TLS (HTTPS on port 443, HTTP on port 80)

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
  -p 3005:443 \
  -p 3001:80 \
  -v /path/to/certs:/etc/nginx/certs:ro \
  ghcr.io/pieszynski/box:latest
```

App is available at `https://localhost:3005` (HTTPS) and `http://localhost:3001` (HTTP).

#### Option B — mount individual files

Useful when your cert manager places files in different locations (e.g. Let's Encrypt):

```bash
docker run -d \
  -p 443:443 \
  -p 80:80 \
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
