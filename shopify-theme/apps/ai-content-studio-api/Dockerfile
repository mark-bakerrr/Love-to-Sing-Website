FROM node:20-alpine
WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY src ./src
COPY .env.example ./.env.example

EXPOSE 8787
CMD ["npm", "start"]
