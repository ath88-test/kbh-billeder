const autoprefixer = require('gulp-autoprefixer');
const cleanCSS = require('gulp-clean-css');
const sass = require('gulp-sass');

module.exports = (gulp) => {
  gulp.task('css', () => {
    return gulp.src('./app/styles/main.scss', {sourcemaps: true})
      .pipe(sass().on('error', sass.logError))
      .pipe(cleanCSS())
      .pipe(autoprefixer())
      .pipe(gulp.dest('./generated/styles', {sourcemaps: '.'}));
  });
};
