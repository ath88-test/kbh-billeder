// TODO: Config must have customization set as very first because some modules depend on config being complete at require time (bad, shouldfix)
const config = require('./lib/config');
config.setCustomizationPath(__dirname + '/..');

const co = require('./server');
const express = require('express');

// Creating an express app
const app = express();

co.initialize(app)
  .catch(console.error);
