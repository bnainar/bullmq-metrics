FROM node:18

WORKDIR /app

ENV NODE_ENV=staging

COPY "././package*.json" "./"
COPY "././" "./"

RUN npm install

EXPOSE 3000

ENTRYPOINT [ "node" , "index.mjs" ]