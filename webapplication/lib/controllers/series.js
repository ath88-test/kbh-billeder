const es = require('../services/elasticsearch');
const config = require('../config');

module.exports.get = (req, res, next) => {
  const {seriesUrl} = req.params;

  es.get({
    index: config.es.index,
    type: 'series',
    id: `series/${seriesUrl}`
  })
    .then((seriesDoc) => {
      res.render('series.pug', {
        req,
        series: seriesDoc._source,
      });
    })
    .catch((error) => {
      if(error.status === 404) {
        return next();
      }
      next(error);
    });
};
