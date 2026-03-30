FROM node:22-alpine AS build
WORKDIR /app
COPY src/package.json src/package-lock.json ./
RUN npm ci
COPY src/ .
RUN npx ng build --configuration production

FROM nginx:alpine
COPY --from=build /app/dist/box/browser /usr/share/nginx/html
COPY <<'EOF' /etc/nginx/conf.d/default.conf
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
EOF
EXPOSE 80
