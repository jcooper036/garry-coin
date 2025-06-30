FROM node:18

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install

COPY . .

RUN node src/register-commands.js

CMD ["npm", "run", "start"]
