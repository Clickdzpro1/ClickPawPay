FROM nginx:alpine

# Copy nginx configuration into the image (avoids host bind-mount issues on managed platforms)
COPY nginx.conf /etc/nginx/nginx.conf

# Create log directory
RUN mkdir -p /var/log/nginx

EXPOSE 80 443

CMD ["nginx", "-g", "daemon off;"]
