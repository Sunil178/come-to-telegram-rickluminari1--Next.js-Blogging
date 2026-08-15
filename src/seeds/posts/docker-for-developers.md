---
title: "Docker for Developers: From Zero to Production"
titleDescription: "Containers, images, and the Dockerfile patterns that actually matter"
categorySlug: "technology"
tags: ["Docker", "DevOps", "Containers"]
bannerImage: "https://images.unsplash.com/photo-1607799279861-4dd421887fb3"
summary: "Docker's core idea is simple — package an app with everything it needs to run — but getting a Dockerfile right takes a bit more care."
published: true
publishedAt: "2026-04-08"
approval: "Approved"
approvedAt: "2026-04-09"
visitorCount: 1750
---

"Works on my machine" is a joke because it's true so often — an app that runs fine locally can fail in production because of a different Node version, a missing system library, or an environment variable nobody wrote down. Docker's answer is to package the application together with its entire runtime environment — language runtime, OS libraries, dependencies — into a single, portable **image** that runs identically anywhere Docker itself runs.

## Images vs. containers

These two terms get used interchangeably, but they're not the same thing. An **image** is a read-only template — a snapshot of a filesystem plus metadata about how to run it. A **container** is a running instance of that image, with its own writable layer on top. The relationship is the same as a class and an object: you build one image, then run as many containers from it as you want, and each one starts from exactly the same known-good state.

## A Dockerfile, annotated

```dockerfile
# Start from a small, official base image — not a full OS you don't need
FROM node:22-alpine AS base

WORKDIR /app

# Copy only the manifest first — Docker caches layers, so dependencies only
# reinstall when package.json actually changes, not on every source edit
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Now copy the rest of the source
COPY . .
RUN npm run build

EXPOSE 3000
CMD ["node", "server.js"]
```

The layer-caching comment matters more than it looks: Docker builds an image layer by layer, and caches each one. If `package.json` hasn't changed since the last build, `npm ci` doesn't re-run at all — Docker just reuses the cached layer. Copying source code *after* installing dependencies, rather than before, is the single most common Dockerfile optimization, because it means editing a `.tsx` file doesn't force a full dependency reinstall on every rebuild.

## Multi-stage builds: don't ship your build tools

A naive Dockerfile ships the same image you built with — including the TypeScript compiler, dev dependencies, and source maps nobody in production needs. Multi-stage builds fix this by using one stage to build the app and a separate, minimal stage to actually run it:

```dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
EXPOSE 3000
CMD ["npm", "start"]
```

Only the `runner` stage ends up in the final image. The `builder` stage — with its compiler, dev dependencies, and intermediate build artifacts — is discarded entirely, which routinely cuts image size by more than half and shrinks the attack surface along with it.

## Volumes: making state survive a container's death

A container's writable layer disappears the moment the container is removed — which is exactly what you want for a stateless web server, and exactly wrong for a database. Volumes give a container a persistent place to write that survives independently of the container's own lifecycle:

```yaml
# docker-compose.yml
services:
  app:
    build: .
    ports:
      - "3000:3000"
    depends_on:
      - mongo
  mongo:
    image: mongo:7
    volumes:
      - mongo-data:/data/db

volumes:
  mongo-data:
```

Delete and recreate the `mongo` container as many times as you like — as long as the `mongo-data` volume isn't also removed, the actual data persists across every one of those restarts.

## Practical habits that matter more than clever tricks

| Habit | Why |
|---|---|
| Use a specific image tag, not `latest` | `latest` silently changes over time — a rebuild six months from now pulls a different image than the one you tested |
| Add a `.dockerignore` | Without one, `COPY . .` happily includes `node_modules`, `.git`, and `.env` in the build context |
| Run as a non-root user | The container's default root user is more privilege than a web server ever needs |
| Keep one process per container | A container running a web server *and* a cron job *and* a log shipper is three separate failure modes tangled into one restart policy |

None of this is exotic — it's the same discipline as writing clean code, applied to how an app gets packaged. The payoff is the same too: an image that behaves identically on a laptop, in CI, and in production, because it genuinely is the same artifact running in all three places, not three separate approximations of "the app."
