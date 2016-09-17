FROM node:6.1
EXPOSE 9000
COPY . /tmp/
WORKDIR /tmp/
# --no-color is needed to prevent strange chars in the CI logs
# --no-spin is needed to prevent duplicated lines in the CI logs
# --unsafe-perm is needed for the lifecycle scripts to run
RUN npm install --no-color --no-spin --unsafe-perm
CMD node server.js