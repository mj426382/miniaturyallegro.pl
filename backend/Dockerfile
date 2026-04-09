FROM node:24-slim

WORKDIR /usr/src/app

COPY package*.json ./

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

RUN npm install -g pnpm

RUN pnpm install

COPY ./ ./

RUN npx prisma generate
RUN pnpm build

EXPOSE 3000

CMD [ "pnpm", "start:prod" ]
