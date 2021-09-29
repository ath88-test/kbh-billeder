// TODO: Config must have customization set as very first because some modules depend on config being complete at require time (bad, shouldfix)
require('dotenv').config({silent: true});
const config = require('../webapplication/lib/config');
config.setCustomizationPath(__dirname + '/..');

var isDevelopment = process.env.NODE_ENV === 'development';

const gulp = require('gulp');
const bower = require('gulp-bower');
const del = require('del');
const gulpCss = require('./build/gulp-css');
const gulpPug = require('./build/gulp-pug');
const gulpSvg = require('./build/gulp-svg');
const gulpJs = require('./build/gulp-js');

// ------------------------------------------
// If possible, remove these tasks completely:
// ------------------------------------------
gulp.task('reload-config', function(done) {
  config.reload();
  done();
});

gulp.task('bower', () => {
  return bower();
});

// ------------------------------------------
// Get the gulp content from the main
// ------------------------------------------
// Add bower scripts
var BOWER_SCRIPTS = [
  '/jquery/dist/jquery.js',
  '/typeahead.js/dist/typeahead.bundle.js',
  '/slick-carousel/slick/slick.min.js',
  '/formatter.js/dist/jquery.formatter.min.js',
].map((script) => {
  return './bower_components' + script;
});

var SCRIPTS_ALL = [
  ...BOWER_SCRIPTS,
  './app/scripts/*.js'
];

gulpCss(gulp);
gulpPug(gulp, config, isDevelopment);
gulpSvg(gulp);
gulpJs(gulp, config, isDevelopment, SCRIPTS_ALL);

gulp.task('clean', () => {
  return del('./generated');
});

gulp.task('build', gulp.series(
  gulp.parallel('clean', 'bower'),
  gulp.parallel('css', 'js', 'svg')
));

gulp.task('watch', (done) => {
  gulp.watch('./app/styles/**/*.scss', {interval: 500}, gulp.task('css'));
  gulp.watch('./app/images/icons/*.svg', {interval: 500}, gulp.task('svg'));
  gulp.watch('./app/views/**/*.pug', {interval: 500}, gulp.task('js'));
  gulp.watch([
    ...SCRIPTS_ALL,
    './app/scripts-browserify/**/*.js',
    './config/**/*',
    './shared/*.js'
  ], {interval: 500}, gulp.series('reload-config', 'js'));

  done();
});

gulp.task('default',
  isDevelopment ?
    gulp.series('build', 'watch') :
    gulp.task('build')
);
