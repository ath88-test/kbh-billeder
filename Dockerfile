FROM node:14.17.6

RUN apt-get update && apt-get install -y \
    libcairo2-dev \
    libpango1.0-dev \
    libgif-dev \
    && rm -rf /var/lib/apt/lists/* # Keeps the image size down

WORKDIR /app

COPY package*.json ./
RUN npm install

# build frontend bundle
COPY config config
COPY config.js .
COPY shared shared
COPY assets-pipeline assets-pipeline

# Would prefer to not copy in webapplication before gulpfile run, but
# webapplication/lib/config is used in assets-pipeline - should probably
# be extracted to shared or something
COPY webapplication webapplication

RUN node node_modules/.bin/gulp build -f assets-pipeline/gulpfile.js

# TODO - dont inject env during build time
COPY .env .

EXPOSE 9000

CMD node webapplication/start.js
