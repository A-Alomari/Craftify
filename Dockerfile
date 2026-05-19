FROM node:18-alpine

WORKDIR /usr/src/app

# Allow overriding NODE_ENV at build/run time; default to production
ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}
ENV PORT=3000

# Install dependencies (omit dev by default for smaller image)
COPY package*.json ./
RUN npm ci --omit=dev

# Copy app files
COPY . .

# Add an entrypoint to optionally run seeds before starting
COPY docker-entrypoint.sh /usr/src/app/docker-entrypoint.sh
RUN chmod +x /usr/src/app/docker-entrypoint.sh

# Create non-root user and take ownership
RUN addgroup -S app && adduser -S app -G app && chown -R app:app /usr/src/app
USER app

# Expose the port (informational)
EXPOSE 3000

ENTRYPOINT ["/usr/src/app/docker-entrypoint.sh"]
CMD ["node", "server.js"]
