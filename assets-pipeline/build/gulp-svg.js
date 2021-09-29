const rename = require('gulp-rename');
const svgmin = require('gulp-svgmin');
const svgstore = require('gulp-svgstore');
const uniqueFiles = require('gulp-unique-files');

module.exports = (gulp) => {
  gulp.task('svg', () => {
    return gulp.src('./app/images/icons/*.svg')
      .pipe(uniqueFiles())
      .pipe(svgmin())
      .pipe(rename({prefix: 'icon-'}))
      .pipe(svgstore())
      .pipe(gulp.dest('./generated/images'));
  });
};
