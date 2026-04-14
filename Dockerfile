FROM node:22-alpine AS build
WORKDIR /app
COPY src/package.json src/package-lock.json ./
RUN npm ci
COPY src/ .
RUN npx ng build --configuration production

FROM nginx:alpine
COPY --from=build /app/dist/box/browser /usr/share/nginx/html

# Main nginx config with periodic cert reload
COPY <<'MAIN' /etc/nginx/nginx.conf
worker_processes auto;
error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;

events {
    worker_connections 1024;
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;
    sendfile      on;
    keepalive_timeout 65;

    # Trust Kubernetes internal proxies (ingress controller, service mesh)
    set_real_ip_from  10.0.0.0/8;
    set_real_ip_from  172.16.0.0/12;
    set_real_ip_from  192.168.0.0/16;
    real_ip_header    X-Forwarded-For;
    real_ip_recursive on;

    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" '
                    'xff="$http_x_forwarded_for" '
                    'cf_ip="$http_cf_connecting_ip" '
                    'cf_country="$http_cf_ipcountry"';
    access_log /var/log/nginx/access.log main;

    include       /etc/nginx/conf.d/*.conf;
}
MAIN

# HTTP-only server (always active)
COPY <<'HTTP' /etc/nginx/conf.d/default.conf
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?|ttf|eot|webmanifest)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
HTTP

# HTTPS server template (activated only when certs are mounted)
# Stored outside /etc/nginx/templates/ to prevent nginx's
# built-in 20-envsubst-on-templates.sh from auto-enabling it.
COPY <<'SSL' /etc/nginx/ssl.conf.template
server {
    listen 443 ssl;
    http2 on;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    ssl_certificate     /etc/nginx/certs/tls.crt;
    ssl_certificate_key /etc/nginx/certs/tls.key;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache   shared:SSL:10m;
    ssl_session_timeout 10m;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?|ttf|eot|webmanifest)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
SSL

# Entrypoint script: enable SSL if certs exist, reload nginx periodically
COPY <<'ENTRY' /docker-entrypoint.d/90-ssl-and-reload.sh
#!/bin/sh
set -e

# Enable SSL config if certificates are mounted
if [ -f /etc/nginx/certs/tls.crt ] && [ -f /etc/nginx/certs/tls.key ]; then
    cp /etc/nginx/ssl.conf.template /etc/nginx/conf.d/ssl.conf
    echo "SSL certificates found — HTTPS enabled on port 443"
else
    rm -f /etc/nginx/conf.d/ssl.conf
    echo "No SSL certificates found — HTTPS disabled (HTTP-only on port 80)"
fi

# Background process: reload nginx every 6 hours to pick up rotated certs
(
    while true; do
        sleep 21600
        if [ -f /etc/nginx/certs/tls.crt ]; then
            nginx -s reload 2>/dev/null || true
            echo "$(date): nginx reloaded for certificate refresh"
        fi
    done
) &
ENTRY
RUN chmod +x /docker-entrypoint.d/90-ssl-and-reload.sh

EXPOSE 80 443
