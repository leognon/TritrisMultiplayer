//From https://gist.github.com/lukin0110/47d75c7defad0bf413ab
import yargs from 'yargs';
const { argv } = yargs;
import gulpif from 'gulp-if';
import gulp from 'gulp';
import browserify from 'browserify';
import babelify from 'babelify';
import source from 'vinyl-source-stream';
import uglify from 'gulp-uglify';
import buffer from 'vinyl-buffer';

/**
 * Build an output file. Babelify is used to transform 'jsx' code to JavaScript code.
 **/
gulp.task("build-react", function(){
    var options = {
        entries: "./client/components/app.js",   // Entry point
        extensions: [".js"],            // consider files with these extensions as modules
        debug: argv.production ? false : true,  // add resource map at the end of the file or not
        paths: ["./scripts/"]           // This allows relative imports in require, with './scripts/' as root
    };

    return browserify(options)
        .transform(babelify)
        .bundle()
        .pipe(source("main.min.js"))
        .pipe(gulpif(argv.production, buffer()))    // Stream files
        .pipe(gulpif(argv.production, uglify()))
        .pipe(gulp.dest("./build"));
});
