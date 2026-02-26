# ClickPawPay Backend Dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install ALL dependencies (prisma CLI needed for generate + db push)
RUN npm install

# Copy source code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Remove devDependencies after prisma generate to keep image small
# Keep prisma CLI since we need it at runtime for db push
RUN npm prune --production && npm install prisma@$(node -e "console.log(require('./package.json').devDependencies.prisma)")

# Create logs directory
RUN mkdir -p logs

# Make entrypoint executable
RUN chmod +x /app/docker-entrypoint.sh

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Entrypoint: auto-generates missing secrets, then runs CMD
ENTRYPOINT ["/app/docker-entrypoint.sh"]

# Push DB schema (safe on first boot and re-deploys) then start server
CMD ["sh", "-c", "npx prisma db push --skip-generate && node server.js"]
