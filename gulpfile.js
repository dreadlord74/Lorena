"use strict";

const $ = require("gulp-load-plugins")(),
	gulp = require("gulp"),
	browserSync = require("browser-sync").create(),
	gutil = require("gulp-util"),
	sourcemap = require("gulp-sourcemaps"),
	ftp = require("vinyl-ftp");

let process = require("child_process"),
	connectionSettings = require("./accesses/accesses.js");

const templatePath = connectionSettings.server.path;
const remotePathCss = templatePath+"css",
	remotePathJs = templatePath+"js",
	remotePathImg = templatePath+"img";

const xpager_conn = ftp.create({
	host:      connectionSettings.xpager.host,
	user:      connectionSettings.xpager.user,
	password:  connectionSettings.xpager.password,
	parallel: 4,
	log: gutil.log
});

const server_conn = ftp.create({
	host:      connectionSettings.server.host,
	user:      connectionSettings.server.user,
	password:  connectionSettings.server.password,
	parallel: 4,
	log: gutil.log
});

gulp.task('browser-sync', () =>  {
	browserSync.init({
		server: {
			baseDir: 'dist'
		},
		notify: false
	});

	browserSync.watch([
		"dist/css/*.css",
		"dist/js/*.js",
		"dist/*.html",
	]).on("change", browserSync.reload);
})

gulp.task("svg", e => 
	gulp.src("./src/img/ico-*.svg")
		.pipe($.svgmin({
			js2svg: {
				pretty: true
			}
		}))
		.pipe($.cheerio({
			run($){
				//$("[fill]").removeAttr("fill")

				//$("[stroke]").removeAttr("stroke")

				//$("[style]").removeAttr("style")
				//$("[width]").removeAttr("width")
				//$("[height]").removeAttr("height")
			},
			parserOptions: {
				xmlMode: true
			}
		}))
		.pipe($.replace("^gt;", ">"))
		.pipe(require("gulp-svg-sprite")({
			mode: {
				symbol: {
					sprite: "sprite.svg"
				}
			}
		}))
		.pipe(gulp.dest("src/pug/"))
)

gulp.task("postcss", _ => 
	gulp.src([
			"src/sss/*.sss", 
			"!src/sss/_*.sss"
		])
		.pipe(sourcemap.init())
		.pipe($.postcss([
			require("postcss-import"),
			require('postcss-functions')({
				functions: require("./config/functions.js")
			}),
			require("postcss-short"),
			require("postcss-preset-env"),
			require("postcss-assets"),
			require("postcss-flexbugs-fixes"),
			require("postcss-nesting"),
			require("postcss-nested"),
			require("postcss-font-magician")(require("./config/fonts.js")),
			require("autoprefixer"),
			require("cssnano"),
			// require("precss"),
		], {parser: require("sugarss")})).on("error", $.notify.onError())
		.pipe($.rename(path => {
			path.extname = path.extname == ".sss" ? ".css" : path.extname;
		}))
		.pipe(sourcemap.write("."))
		.pipe(gulp.dest("dist/css"))
);

gulp.task("pug", _ => 
	gulp.src("src/pug/*.pug")
		.pipe($.plumber({
			errorHandler: $.notify.onError()
		}))
		.pipe($.pug({
			plugins: [$.pugbem]
		}))
		.pipe(require("gulp-html-beautify")({
			indentSize: 4,
			indent_with_tabs: true,
		}))
		.pipe(gulp.dest("dist"))
);

gulp.task("move:fonts", _ => 
	gulp.src("src/fonts/**/*")
		.pipe(gulp.dest("dist/fonts"))
);

gulp.task('imagemin', () =>  
	gulp.src('src/img/**/*', {since: gulp.lastRun("imagemin")})
		 .pipe($.cache($.imagemin([
			$.imagemin.gifsicle({
				interlaced: true,
			}),
			$.imagemin.jpegtran({
				progressive: true,
			}),
			require("imagemin-jpeg-recompress")({
				loops: 1,
				min: 80,
				max: 95,
				quality: "high"
			}),
			// $.imagemin.svgo(),
			$.imagemin.optipng({optimizationLevel: 3}),
      		require("imagemin-pngquant")({quality: '75-85', speed: 5})
		],{
     		verbose: true
    	})))
		.pipe(gulp.dest('dist/img'))
);


gulp.task("remove:base64", callback => {del.sync("dist/css/base64.css"); callback()});

gulp.task("deploy:css", () => 
	gulp.src("dist/css/*.*", {since: gulp.lastRun("postcss")})
		.pipe(server_conn.dest(remotePathCss))
);

gulp.task("deploy:js", () => 
	gulp.src("dist/js/*.js", {since: gulp.lastRun("deploy:js")})
		.pipe(server_conn.dest(remotePathJs))
);

gulp.task("deploy:img", () => 
	gulp.src("dist/img/**/*", {since: gulp.lastRun("deploy:img")})
		.pipe(server_conn.dest(remotePathImg))
);

gulp.task("deploy:dist", _ => 
	gulp.src("dist/**/*.*", {buffer: false})
		.pipe(xpager_conn.dest(connectionSettings.xpager.dirName))
);

gulp.task("deploy", gulp.series(gulp.parallel("postcss", "pug", "imagemin"), "deploy:dist"));



const local = _ => {
	var WP = process.exec("npm run watch");
	gulp.watch('src/pug/**/*', gulp.series("pug"))
	gulp.watch('src/sss/**/*.sss', gulp.series("postcss"))
	gulp.watch("src/img/**/*", gulp.series("imagemin"))
	gulp.watch("src/img/**/*.svg", gulp.series("svg"))
},
watch = _ => {
	gulp.watch("dist/css/**/*", gulp.series("deploy:css"))
	gulp.watch("dist/js/*.js", gulp.series("deploy:js"))
	gulp.watch("dist/img/**/*", gulp.series("deploy:img"))
};

gulp.task("deploy-to-server", gulp.series(gulp.parallel( "postcss", "pug", "imagemin"), gulp.parallel(local, watch)));

gulp.task("finish:him", gulp.series(gulp.parallel("postcss", "imagemin"), gulp.parallel("deploy:css", "deploy:js")));

gulp.task("default", gulp.series(gulp.parallel("postcss", "pug", "imagemin", "move:fonts", "svg"), gulp.parallel(local, "browser-sync")))

gulp.task('clearcache', (callback) => { $.cache.clearAll(); callback();});