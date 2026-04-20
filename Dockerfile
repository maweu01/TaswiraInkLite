# ═══════════════════════════════════════════════════════
# Taswira Space Ink v2 — Docker Production Image
# Uses Nginx Alpine for minimal footprint (~25MB)
# ═══════════════════════════════════════════════════════

FROM nginx:1.25-alpine AS production

# Install envsubst (for runtime env vars in nginx.conf)
RUN apk add --no-cache gettext

# Remove default nginx static assets
RUN rm -rf /usr/share/nginx/html/*

# Copy application files
COPY index.html        /usr/share/nginx/html/
COPY styles/           /usr/share/nginx/html/styles/
COPY src/              /usr/share/nginx/html/src/
COPY data/             /usr/share/nginx/html/data/
COPY nginx.conf        /etc/nginx/conf.d/default.conf

# Security: run nginx as non-root
RUN addgroup -g 1001 -S nginx_app && \
    adduser -S -D -H -u 1001 -h /var/cache/nginx -s /sbin/nologin \
    -G nginx_app -g nginx_app nginx_app && \
    chown -R nginx_app:nginx_app /usr/share/nginx/html && \
    chown -R nginx_app:nginx_app /var/cache/nginx && \
    chown -R nginx_app:nginx_app /var/log/nginx && \
    chown -R nginx_app:nginx_app /etc/nginx/conf.d && \
    touch /var/run/nginx.pid && \
    chown -R nginx_app:nginx_app /var/run/nginx.pid

USER nginx_app

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget -q --spider http://localhost:8080/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
