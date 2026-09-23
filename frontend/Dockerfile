FROM node:20-slim AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
# Bake the production API/Firebase config into the static bundle at build time —
# Vite env vars are compiled in, not read at container runtime.
ARG VITE_API_BASE_URL
ARG VITE_FIREBASE_API_KEY
ARG VITE_FIREBASE_AUTH_DOMAIN
ARG VITE_FIREBASE_PROJECT_ID
ARG VITE_FIREBASE_APP_ID
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
