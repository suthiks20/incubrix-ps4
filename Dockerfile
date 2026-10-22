# The API runs on the Node version required by the project.
# Dependencies are installed before source so Docker can reuse the layer.
FROM node:22-slim
WORKDIR /app
RUN mkdir -p /app/data/storage && chown -R node:node /app/data
COPY package*.json ./
RUN npm ci
COPY --chown=node:node . .
RUN mkdir /app/dist && chown node:node /app/dist
USER node
RUN npm run build
EXPOSE 8000
CMD ["node", "dist/src/server.js"]
