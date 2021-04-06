FROM node:14-alpine

ENV HOME=/home/node/app
ENV NODE_ENV=production

RUN mkdir -p $HOME && chown -R node:node $HOME

WORKDIR $HOME
USER node

COPY --chown=node:node package*.json $HOME/
RUN npm i && npm cache clean --force

COPY --chown=node:node . .

CMD [ "npm", "test" ];
