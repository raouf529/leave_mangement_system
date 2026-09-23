FROM node:20-alpine
WORKDIR /app
COPY server/package*.json ./
RUN npm ci --omit=dev
COPY server/ ./
COPY "Titre_de_conge (2).docx" ./Titre_de_conge (2).docx
EXPOSE 5000
CMD ["node", "server.js"]