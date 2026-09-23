FROM node:20
WORKDIR /app
COPY package.json .
RUN npm install
CMD ["npm", "run", "build"]
COPY . .
EXPOSE 4173
CMD ["npm", "run", "preview"]