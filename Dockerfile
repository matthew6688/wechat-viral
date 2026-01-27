FROM node:18-alpine AS build

WORKDIR /app

# Install backend dependencies
COPY backend/package.json backend/package-lock.json* ./backend/
RUN cd backend && npm install --include=dev

# Copy backend source and build
COPY backend ./backend
RUN cd backend && npm run build

# Copy admin static files
COPY admin ./admin

FROM node:18-alpine AS runtime

WORKDIR /app

# Copy built backend and admin assets
COPY --from=build /app/backend ./backend
COPY --from=build /app/admin ./admin

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "backend/dist/index.js"]
