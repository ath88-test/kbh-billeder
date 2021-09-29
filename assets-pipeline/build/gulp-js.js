const browserify = require('browserify');
const concat = require('gulp-concat');
const gulpif = require('gulp-if');
const source = require('vinyl-source-stream');
const uglify = require('gulp-uglify');
const uniqueFiles = require('gulp-unique-files');

module.exports = (gulp, config, isDevelopment, SCRIPTS_ALL) => {
  var SCRIPTS_DEST = './generated/scripts';

  //TODO: Can we avoid writing browserify to some destination then reading again in js step, and instead just returning a stream to continue work on?
  //TODO: Everything is built into main.js which is the only script included anywhere...
  gulp.task('js-browserify', gulp.series('pug', () => {
    return browserify({
      debug: isDevelopment,
      entries: './app/scripts-browserify/index.js',
      insertGlobalVars: {
        clientSideConfig: function(file, dir) {
          const clientSideConfig = config.getClientSideConfig();
          return JSON.stringify(clientSideConfig);
        }
      }
    })
      .transform('babelify', {
        'env': {
          'production': {
            'presets': [
              'babel-preset-latest',
              //'babel-preset-babili'
            ]
          },
          'beta': {
            'presets': [
              'babel-preset-latest',
              //'babel-preset-babili'
            ]
          }
        },
        plugins: [
          [
            'babel-plugin-module-resolver',
            {'alias': {
              '@shared': '../shared',
              '@views': './generated/views',
            }}
          ],
        ],
      })
      .bundle()
      .on('error', function(err){
        console.log(err.stack);
      })
      .pipe(source('browserify-index.js'))
      .pipe(gulp.dest(SCRIPTS_DEST));
  }));

  gulp.task('js', gulp.series('js-browserify', () => {
    var scriptPaths = [
      ...SCRIPTS_ALL,
      SCRIPTS_DEST + '/browserify-index.js'
    ];
    return gulp.src(scriptPaths)
      .pipe(uniqueFiles())
      .pipe(concat('main.js'))
      .pipe(gulp.dest(SCRIPTS_DEST))
      .pipe(gulpif(!isDevelopment, uglify().on('error', console.error)))
      .pipe(gulp.dest(SCRIPTS_DEST))
      .on('error', function(err){
        console.log(err.stack);
      });
  }));
};
