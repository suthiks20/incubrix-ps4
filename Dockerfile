# The API runs on the Node version required by the project.
# Dependencies are installed before source so Docker can reuse the layer.
FROM node:22-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY --chown=node:node . .
USER node
EXPOSE 8000
CMD ["node", "src/server.js"]
