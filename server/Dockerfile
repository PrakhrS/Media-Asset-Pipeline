# syntax=docker/dockerfile:1

# ---- Base image ----
FROM node:20-alpine AS base

# Install FFmpeg
RUN apk update && apk add --no-cache ffmpeg

WORKDIR /app

# ---- Dependencies ----
FROM base AS deps

# Copy manifests first for better layer caching
COPY package*.json ./
RUN npm install

# ---- Builder ----
FROM deps AS builder

# Copy all source files
COPY . .

# Create ephemeral staging folders so FFmpeg doesn't crash at runtime
RUN mkdir -p uploads/temp uploads/processed

# Compile TypeScript → dist/
RUN npm run build

# ---- Production image ----
FROM base AS runner

WORKDIR /app

# Only bring in production node_modules and compiled output
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./

# Create the ephemeral staging folders in the final image as well
RUN mkdir -p uploads/temp uploads/processed

EXPOSE 5001

CMD ["npm", "start"]
