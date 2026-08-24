# Image Enhancer Backend — Multi-Stage Dockerfile
#
# WHY multi-stage: sharp compiles native bindings against libvips during
# npm install. The build needs compilers and dev headers that add well
# over 200MB to an image — completely unnecessary at RUNTIME, since sharp
# ships prebuilt binaries once installed. Stage 1 does the heavy lifting;
# Stage 2 ships only the finished result.

# ---------- Stage 1: builder ----------
FROM node:20-slim AS builder

WORKDIR /app

# sharp's install step needs these to build/fetch its native binary cleanly
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
RUN npm install --production

COPY . .

# ---------- Stage 2: final runtime image ----------
FROM node:20-slim

LABEL maintainer="Sujit <trainer@example.com>"
LABEL description="Image Enhancer API - real image processing with sharp"

WORKDIR /app

# Only the finished node_modules (with sharp's compiled binary) and app code
# are copied in — none of the compilers or build tools from Stage 1 exist here.
COPY --from=builder /app /app

ENV PORT=3000
ENV UPLOAD_DIR=/app/uploads

VOLUME ["/app/uploads"]

EXPOSE 3000

USER node

CMD ["node", "server.js"]
