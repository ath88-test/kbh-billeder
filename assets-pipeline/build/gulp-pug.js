const pug = require('gulp-pug');
const CustomPug = require('./custom-pug.js');
const uniqueFiles = require('gulp-unique-files');

module.exports = (gulp, config, isDevelopment) => {
  const customPug = CustomPug(config);

  gulp.task('pug', () => {
    return gulp.src('../shared/views/**/*.pug')
      .pipe(uniqueFiles())
      .pipe(pug({
        client: true,
        compileDebug: isDevelopment,
        pug: customPug
      }))
      .pipe(gulp.dest('./generated/views'));
  });
};
