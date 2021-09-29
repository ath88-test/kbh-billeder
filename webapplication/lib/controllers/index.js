'use strict';

const keystone = require('keystone');
const ds = require('../services/elasticsearch');
const config = require('../config');

var helpers = {
  thousandsSeparator: function(number) {
    return number.toString().replace(/(\d)(?=(\d\d\d)+(?!\d))/g, '$1.');
  }
};

exports.frontpage = function(req, res, next) {
  if ('q' in req.query) {
    next();
  } else {
    keystone.list('Frontpage item').model.find()
    .populate('tagCloud')
    .populate({
      path: 'gallery',
      populate: {
        path: 'items',
        model: 'Gallery item'
      }
    })
    .populate('jumbo')
    .populate('map')
    .sort('order')
    .exec(function(err, frontpageItems) {
      if(!err) {
        ds.count({
          body: {
            query: config.search.baseQuery
          }
        }).then(function(response) {
          res.render('frontpage', {
            frontpageItems,
            frontpage: true,
            totalAssets: helpers.thousandsSeparator(response.count),
            req: req
          });
        }, next);
      } else {
        next(err);
      }
    });
  }
};
