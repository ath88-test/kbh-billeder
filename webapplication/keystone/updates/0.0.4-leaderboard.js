'use strict';
var Q = require('q');
var _ = require('lodash');
var keystone = require('keystone');

var Page = keystone.list('Page');
var MenuItem = keystone.list('Menu item');

module.exports = function(done) {
  var pages = [
    new Page.model({
      title: 'Top 10',
      slug: 'top',
      state: 'published',
      content: '<p>Tekst før statistik</p>\n{{STAT}}\n<p>Tekst efter statistik</p>'
    }).save()
  ];

  Q.all(_.values(pages)).then(function(createPages) {
    pages = {};
    createPages.forEach((page) => {
      pages[page.slug] = page;
    });

    if (pages['top']) {
      var menuItems = [
        new MenuItem.model({
          title: 'Top 10',
          page: pages['top']._id,
          placement: 'main',
          order: 6
        }).save()
      ];
      return Q.all(menuItems);
    }
  }).then(function() {
    done();
  }, console.error);
};
