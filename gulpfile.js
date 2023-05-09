const settings = require('./gulp-settings.js');
const { src, dest, series, parallel, watch, lastRun } = require('gulp');
const sass = require('gulp-sass')(require('sass'));
const sassImporter = require('node-sass-tilde-importer');
const sourcemaps = require('gulp-sourcemaps');
const imagemin = require('gulp-imagemin');
const pug = require('gulp-pug');
const del = require('del');
const gulpif = require('gulp-if');
const cleanCSS = require('gulp-clean-css');
const rename = require('gulp-rename');
const minify = require('gulp-minify');
const rigger = require('gulp-rigger');
const plumber = require('gulp-plumber');
const count = require('gulp-count');
const cache = require('gulp-cached');
const autoprefixer = require('gulp-autoprefixer');
const sassInheritance = require('gulp-sass-multi-inheritance');
const browserSync = require('browser-sync').create();

let isDevelopment = true;
// https://www.npmjs.com/package/clean-css#level-1-optimizations
let cleanCssLevelOpts = {
    1: {
        all: true,
        normalizeUrls: false,
        optimizeBackground: false,
        removeQuotes: false,
        roundingPrecision: false,
        optimizeFont: false,
        optimizeFontWeight: false,
        selectorsSortingMethod: 'standard', // denotes selector sorting method; can be `'natural'` or `'standard'`, `'none'`, or false (the last two since 4.1.0); defaults to `'standard'`
        specialComments: 'all', // denotes a number of /*! ... */ comments preserved; defaults to `all`
        tidySelectors: false,
        tidyAtRules: true,
        tidyBlockScopes: true,
        semicolonAfterLastProperty: true,
        replaceMultipleZeros: false,
        replaceZeroUnits: false
    },
    2: {
        all: false,
        mergeAdjacentRules: true,
        removeEmpty: true,
        overrideProperties: true,
        removeDuplicateMediaBlocks: true,
        removeDuplicateRules: true,
    }
};

function server(cb) {
    browserSync.init({
        watch: true,
        server: {
            baseDir: settings.publicDir,
            directory: true,
            notify: false,
            port: 3010
        }
    });
    cb()
}

function pug2html() {
    return src([`${settings.pugDir.entry}/**/*.pug`, `!${settings.pugDir.entry}/**/_*.pug`], { allowEmpty: true })
        .pipe(cache('pug2html'))
        .pipe(plumber(function (error) {
            console.log(error.message);
            // util.beep();
            this.emit('end');
        }))
        .pipe(pug({
            pretty: true
        }))
        .pipe(plumber.stop())
        .pipe(dest(settings.publicDir))
        .pipe(browserSync.stream());
}

function copyScripts() {
    return src(`${settings.jsDir.entry}/**/*.js`, { allowEmpty: true })
        .pipe(plumber())
        .pipe(cache('copyScripts'))
        .pipe(gulpif(!isDevelopment, minify({
            ext: {
                min: '.min.js'
            },
            ignoreFiles: ['*.min.js'],
            preserveComments: true
        })))
        .pipe(plumber.stop())
        .pipe(dest(settings.jsDir.output))
        .pipe(browserSync.stream());
}

function wpCopyScripts() {
    return src(`${settings.jsDir.output}/**/*.js`, { allowEmpty: true })
        .pipe(plumber())
        .pipe(plumber.stop())
        .pipe(dest(`${settings.wpDir}/js`))
        .pipe(count('## wp js copied'));
}

function copyFiles() {
    let entry = [`${settings.assetsDir.entry}/**/*`];
    if (!isDevelopment) {
        entry.push(`!${settings.assetsDir.entry}/images/**/*`);
    }
    return src(entry, { allowEmpty: true })
        .pipe(plumber())
        .pipe(cache('copyFiles'))
        .pipe(dest(settings.assetsDir.output))
        .pipe(plumber.stop())
        .pipe(browserSync.stream())
        .pipe(count('## assets copied'));
}

function copyHtml() {
    return src([`${settings.viewsDir.entry}/**/*.html`, `!${settings.viewsDir.entry}/inc/*.html`, `!${settings.viewsDir.entry}/includes/*.html`], { allowEmpty: true })
        .pipe(plumber())
        .pipe(cache('copyHtml'))
        .pipe(rigger())
        .pipe(plumber.stop())
        .pipe(dest(settings.viewsDir.output))
        .pipe(browserSync.stream())
        .pipe(count('## html copied'));
}

function copyHtmlInc() {
    return src(`${settings.viewsDir.entry}/inc/*.html`, { allowEmpty: true })
        .pipe(plumber())
        .pipe(cache('copyHtmlInc'))
        .pipe(rigger())
        .pipe(plumber.stop())
        .pipe(dest(`${settings.viewsDir.output}/inc`))
        .pipe(browserSync.stream())
        .pipe(count('## inc html copied'));
}

function scss() {
    return src(`${settings.scssDir.entry}/**/*.scss`, { allowEmpty: true })
        .pipe(plumber())
        .pipe(cache('scss'))
        .pipe(sassInheritance({ dir: settings.scssDir.entry + '/' }))
        .pipe(gulpif(isDevelopment, sourcemaps.init()))
        .pipe(sass({
            importer: sassImporter
        }).on('error', sass.logError))
        .pipe(autoprefixer())
        .pipe(gulpif(!isDevelopment, cleanCSS({
            format: 'beautify',
            inline: ['local', 'remote', '!fonts.googleapis.com'],
            sourceMap: false,
            level: cleanCssLevelOpts,
            compatibility: {
                colors: {
                    hexAlpha: false, // controls 4- and 8-character hex color support
                    opacity: true // controls `rgba()` / `hsla()` color support
                },
                properties: {
                    backgroundClipMerging: true, // controls background-clip merging into shorthand
                    backgroundOriginMerging: true, // controls background-origin merging into shorthand
                    backgroundSizeMerging: true, // controls background-size merging into shorthand
                    colors: true, // controls color optimizations
                    ieBangHack: false, // controls keeping IE bang hack
                    ieFilters: false, // controls keeping IE `filter` / `-ms-filter`
                    iePrefixHack: false, // controls keeping IE prefix hack
                    ieSuffixHack: false, // controls keeping IE suffix hack
                    merging: true, // controls property merging based on understandability
                    shorterLengthUnits: false, // controls shortening pixel units into `pc`, `pt`, or `in` units
                    spaceAfterClosingBrace: true, // controls keeping space after closing brace - `url() no-repeat` into `url()no-repeat`
                    urlQuotes: true, // controls keeping quoting inside `url()`
                    zeroUnits: false // controls removal of units `0` value
                },
                selectors: {
                    adjacentSpace: false, // controls extra space before `nav` element
                    ie7Hack: true, // controls removal of IE7 selector hacks, e.g. `*+html...`
                    mergeLimit: 8191, // controls maximum number of selectors in a single rule (since 4.1.0)
                    multiplePseudoMerging: true // controls merging of rules with multiple pseudo classes / elements (since 4.1.0)
                },
                units: {
                    ch: true, // controls treating `ch` as a supported unit
                    in: true, // controls treating `in` as a supported unit
                    pc: true, // controls treating `pc` as a supported unit
                    pt: true, // controls treating `pt` as a supported unit
                    rem: true, // controls treating `rem` as a supported unit
                    vh: true, // controls treating `vh` as a supported unit
                    vm: true, // controls treating `vm` as a supported unit
                    vmax: true, // controls treating `vmax` as a supported unit
                    vmin: true // controls treating `vmin` as a supported unit
                }
            }
        })))
        .pipe(gulpif(isDevelopment, sourcemaps.write()))
        .pipe(plumber.stop())
        .pipe(dest(settings.isWP ? settings.scssDir.wpOutput : settings.scssDir.output))
        .pipe(count('## files sass to css compiled', { logFiles: true }))
        .pipe(browserSync.stream({ match: `${settings.scssDir.output}/**/*.css` }));
}

function minCss() {
    return src(`${settings.scssDir.output}/${settings.scssDir.mainFileName}.css`, { allowEmpty: true })
        .pipe(plumber())
        .pipe(rename(`${settings.scssDir.mainFileName}.min.css`))
        .pipe(cleanCSS({
            inline: ['local', 'remote', '!fonts.googleapis.com'],
            level: cleanCssLevelOpts
        }))
        .pipe(plumber.stop())
        .pipe(dest(settings.scssDir.output))
        .pipe(count('## min css copied'));
}

function wpCss() {
    return src(`${settings.scssDir.output}/${settings.scssDir.mainFileName}.css`, { allowEmpty: true })
        .pipe(plumber())
        .pipe(plumber.stop())
        .pipe(dest(settings.wpDir))
        .pipe(count('## wp css copied'));
}

function imagesOptimisation() {
    return src(`${settings.imagesDir.entry}/**/*`, { allowEmpty: true })
        .pipe(plumber())
        .pipe(imagemin([
            imagemin.gifsicle({ interlaced: true }),
            imagemin.mozjpeg({ quality: 85, progressive: true }),
            imagemin.optipng({ optimizationLevel: 3 }),
            imagemin.svgo({
                plugins: [
                    { removeViewBox: true },
                    { cleanupIDs: false }
                ]
            })
        ], {
            verbose: true
        }))
        .pipe(plumber.stop())
        .pipe(dest(settings.imagesDir.output));
}

function cleanDist(cb) {
    del([`${settings.publicDir}/**`, `!${settings.publicDir}`]).then(paths => {
        cb();
    });
}

function cleanCache(cb) {
    cache.caches = {};
    cb();
}

function watching(cb) {
    watch(`${settings.scssDir.entry}/**/*.scss`, scss).on('unlink', function (filePath) {
        delete cache.caches.scss[filePath];
    });
    watch(`${settings.jsDir.entry}/**/*.js`, copyScripts).on('change', function (filePath) {
        delete cache.caches['copyScripts'];
    });
    watch([`${settings.viewsDir.entry}/**/*.html`, `!${settings.viewsDir.entry}/inc/*.html`], copyHtml).on('change', function (filePath) {
        delete cache.caches['copyHtml'];
    });
    watch(`${settings.viewsDir.entry}/inc/*.html`, copyHtmlInc).on('change', function (filePath) {
        delete cache.caches['copyHtmlInc'];
    });
    watch(`${settings.pugDir.entry}/**/*.pug`, pug2html).on('change', function (filePath) {
        delete cache.caches['pug2html'];
    });
    watch(`${settings.assetsDir.entry}/**/*`, copyFiles).on('change', function (filePath) {
        delete cache.caches['copyFiles'];
    });
    cb();
}

exports.default = parallel(
    copyHtml,
    series(
        copyFiles,
        copyHtmlInc,
    ),
    copyScripts,
    scss,
    server,
    watching);

exports.pug = parallel(
    pug2html,
    copyFiles,
    copyScripts,
    scss,
    server,
    watching);

exports.dist = series(
    (cb) => {
        isDevelopment = false;
        cb();
    },
    cleanCache,
    cleanDist,
    parallel(
        copyHtml,
        copyScripts,
        (settings.isWP ? wpCopyScripts : (cb) => { cb(); }),
        series(
            copyFiles,
            copyHtmlInc,
        ),
        series(
            scss,
            minCss,
            (settings.isWP ? wpCss : (cb) => { cb(); })
        ),
        imagesOptimisation,
    )
);

exports.distPug = series(
    (cb) => {
        isDevelopment = false;
        cb();
    },
    cleanCache,
    cleanDist,
    parallel(
        pug2html,
        copyScripts,
        copyFiles,
        (settings.isWP ? wpCopyScripts : (cb) => { cb(); }),
        series(
            scss,
            minCss,
            (settings.isWP ? wpCss : (cb) => { cb(); })
        ),
        imagesOptimisation,
    )
);