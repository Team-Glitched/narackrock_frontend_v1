FROM node:22-alpine AS build

WORKDIR /app
COPY package.json package-lock.json .npmrc ./
COPY scripts/install-ci.mjs ./scripts/install-ci.mjs
RUN npm run install:ci

COPY . .
ARG VITE_API_BASE_URL=https://api.narackrock.com
ARG VITE_GOOGLE_CLIENT_ID
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL} \
    VITE_GOOGLE_CLIENT_ID=${VITE_GOOGLE_CLIENT_ID}
RUN test -n "$VITE_API_BASE_URL" && test -n "$VITE_GOOGLE_CLIENT_ID" && npm run build

FROM nginx:1.28-alpine AS runtime

RUN addgroup -g 10001 app && adduser -D -H -u 10001 -G app app
COPY nginx.conf /etc/nginx/nginx.conf
COPY --from=build /app/dist/ /usr/share/nginx/html/
USER 10001:10001
EXPOSE 8080
ENTRYPOINT ["nginx"]
CMD ["-g", "daemon off;"]
