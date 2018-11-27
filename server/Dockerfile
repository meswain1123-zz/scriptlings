
FROM node:9.6.1

ADD . /code
WORKDIR /code

# install and cache app dependencies
COPY package.json /code/package.json
# RUN npm install --silent
# RUN npm install react-scripts@1.1.1 -g --silent
RUN npm install

# run the command
CMD ["npm", "start"]
