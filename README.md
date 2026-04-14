# BOX

Angular PWA with a circular countdown timer, theming support, and system notifications.

## Table of contents

- [Local development](#local-development)
- [Docker](#docker)
  - [Run without TLS](#run-without-tls-http-only)
  - [Run with TLS](#run-with-tls-https-on-port-443-http-on-port-80)
    - [Option A — mount a directory](#option-a--mount-a-directory)
    - [Option B — mount individual files](#option-b--mount-individual-files)
  - [Certificate rotation](#certificate-rotation-lets-encrypt--auto-renew)
  - [Icon regeneration](#icon-regeneration)
- [Logging & real client IP](#logging--real-client-ip)

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

---

## Logging & real client IP

By default Kubernetes pods receive internal cluster IPs (e.g. `10.42.0.8`) in nginx
logs because the Ingress controller is the last TCP hop. The image is configured to
resolve the real client IP automatically.

### How it works

#### 1. `ngx_http_realip_module`

The nginx config trusts all private RFC-1918 ranges as proxies:

```nginx
set_real_ip_from  10.0.0.0/8;
set_real_ip_from  172.16.0.0/12;
set_real_ip_from  192.168.0.0/16;
real_ip_header    X-Forwarded-For;
real_ip_recursive on;
```

With `real_ip_recursive on`, nginx walks the `X-Forwarded-For` chain right-to-left,
skipping every trusted proxy address, and sets `$remote_addr` to the first
non-trusted (= real client) IP it finds.

#### 2. Cloudflare headers (optional)

When the cluster sits behind Cloudflare, two extra headers are available:

| Header | Contents |
|---|---|
| `CF-Connecting-IP` | Single real client IP, most reliable |
| `CF-IPCountry` | ISO 3166-1 alpha-2 country code (`PL`, `DE`, …) |

The nginx config maps these into variables:

```nginx
map $http_cf_connecting_ip $real_client_ip {
    ""      $remote_addr;          # no Cloudflare → fall back to resolved IP
    default $http_cf_connecting_ip; # behind Cloudflare → use CF header
}

map $http_cf_ipcountry $client_country {
    ""      -;                     # no Cloudflare → dash
    default $http_cf_ipcountry;    # behind Cloudflare → country code
}
```

#### 3. Log format

```nginx
log_format main '$real_client_ip $client_country [$time_local] "$request" '
                '$status $body_bytes_sent "$http_referer" '
                '"$http_user_agent"';
```

Resulting log lines:

```
# Behind Cloudflare
203.0.113.45 PL [14/Apr/2026:20:34:17 +0000] "GET / HTTP/1.1" 200 2106 "-" "Mozilla/5.0 ..."

# Direct / no Cloudflare
203.0.113.45 - [14/Apr/2026:20:34:17 +0000] "GET / HTTP/1.1" 200 2106 "-" "Mozilla/5.0 ..."
```

### Required Kubernetes configuration

For this to work the Ingress controller must forward `X-Forwarded-For` to backend pods.

**Traefik (default in K3s/K3d)**

Traefik passes `X-Forwarded-For` by default. If it doesn't, ensure the entrypoint
has `forwardedHeaders.trustedIPs` set to your load balancer / Cloudflare IPs:

**ingress-nginx ConfigMap** (`ingress-nginx` namespace):

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: ingress-nginx-controller
  namespace: ingress-nginx
data:
  use-forwarded-headers: "true"
  compute-full-forwarded-for: "true"
  forwarded-for-header: "X-Forwarded-For"
```

**Ingress controller Service** — preserve source IP at the load-balancer level:

```yaml
spec:
  type: LoadBalancer
  externalTrafficPolicy: Local
```
