/**
 * node.js implementation of wiki server
 *
 * USAGE: node server.js
 *     --res-dir=[RES DIR]
 *     --wiki-dir=[WIKI DIR]
 *     --wiki-src-out=[file descriptor to which literal wikitext is written]
 *     --wiki-html-in=[file descriptor from which processed wikitext (HTML) is read]
 */

var http = require("http");
var url = require("url");
var fs = require("fs");
var WikitextProcessor = require("./WikitextProcessor").WikitextProcessor;
var argv = require("../../lib/optimist/optimist")
		.demand(["res-dir", "wiki-dir", "wiki-src-out", "wiki-html-in"])
		.argv;

var RES_DIR = argv["res-dir"];
var WIKI_DIR = argv["wiki-dir"];
var WIKITEXT_OUT = argv["wiki-src-out"];
var WIKITEXT_IN = argv["wiki-html-in"];

(function() {
	/**
	 * define WikitextProcessor instance to be used for duration of server process
	 */
	var wp = new WikitextProcessor(
			fs.createWriteStream(WIKITEXT_OUT),
			fs.createReadStream(WIKITEXT_IN, {
				"flags": "r",
				"encoding": null,
				"mode": 0666,
				"bufferSize": 1}));

	var pathToPageTitle = function(path) {
		return path.substring(1).replace(/[^a-zA-Z0-9.-]/, "_");
	};

	var mimeTable = {
		"html": "text/html",
		"css": "text/css",
		"png": "image/png",
		"jpg": "image/jpeg",
		"jpeg": "image/jpg",
		"ico": "image/ico",
		"js": "text/javascript",
		"*": "application/octet-stream"
	};

	/**
	 * @param int set size
	 * @return array of random integers
	 */
	var entropy = (function() {
		var is = fs.createReadStream("/dev/random");
		//is.pause();
		var req = [];

		is.on("data", function(data) {

			// stop reading when all requests are satisfied
			if (!req.length) {
				is.pause();
				return;
			}

			// dump buffer contents into current request
			var curReq = req[req.length-1];
			var i = 0;

			while (curReq.set.length < curReq.setSize && i < data.length) {
				curReq.set.push(data[i]%10);
				i++;
			}

			// request satisfied
			if (curReq.set.length == curReq.setSize) {
				curReq.success(curReq.set);
				req.pop();
			}

		});

		return function(setSize, success) {
			req.push({
				"setSize": setSize,
				"success": success,
				"set": []
			});
			is.resume();
		};
	}());

	/**
	 * temporary file name
	 */
	var tmpWikiFileName = function(success) {
		entropy(64, function(set) {
			success(WIKI_DIR + "/.tmp." + set.join(""));
		});
	};

	// define behavior to be invoked as changes in files occur
	var updateFile = function() {};
	var readFile = (function() {
		var fileCache = {};

		/**
		 * invalidate the cache of a file
		 */
		updateFile = function(fileName) {
			fileCache[fileName] = null;
		};
		
		/**
		 * read file @ fileName into writable stream @ os
		 */
		return function(fileName, os, cb) {
				var cache = fileCache[fileName];

				console.log("Loading file: '" + fileName + "'");

				if (cache) {
					return cache(os, cb);
				}

				// cache behavior is not defined yet for this file, therefore definition is necessary
				console.log("Reading file from disk: '" + fileName + "'");

				// ensure file exists & is readable
				fs.stat(fileName, function(err, stats) {

					if (err) {
						if (cb.unreadable) {
							console.log("Unreadable file was requested: '" + fileName + "'");
							cb.unreadable();
						}

						return;
					}

					var buffer = [];
					var rs = fs.createReadStream(fileName);
					rs.on("data", function(data) {
						buffer.push(data)
					});
					rs.on("error", function() {
						if (buffer.length) {
							if (cb.unreadable) {
								cb.unreadable();
							}
						} else {
							if (cb.error) {
								cb.error();
							}
						}
					});
					rs.on("end", function() {
						fileCache[fileName] = function(os, cb) {
							if (cb.readable) {
								cb.readable(stats);
							}
						};

						var lastFn = fileCache[fileName];

						for (var i = 0; i < buffer.length; i++) {
							(function() {
								var bufferIndex = i;
								var innerLastFn = lastFn;
								fileCache[fileName] = function(os, cb) {
									innerLastFn(os, cb);
									os().write(buffer[bufferIndex]);
								};
							}());

							lastFn = fileCache[fileName];
						}

						fileCache[fileName] = function(os, cb) {
							lastFn(os, cb);
							
							if (cb.success) {
								cb.success();
							}
						};

						fileCache[fileName](os, cb);
					});
				});
		}
	}());

	var dispatchTable = {
		"GET": {

			/**
			 * serve static resources
			 */
			"res": function(req, res) {
				var reqUrl = url.parse(req.url);
				var reqPath = reqUrl.pathname;

				console.log("Serving resource: '" + reqPath + "'");

				// resolve mimetype
				var mimeType = mimeTable[reqPath.substring(reqPath.lastIndexOf(".")+1)];

				if (!mimeType) {
					mimeType = mimeTable["*"];
					console.log("Defaulting to default mimetype of '" + mimeType + "' for resource: '" + reqPath + "'");
				}

				// read entire resource from disk
				readFile(RES_DIR + "/www/" + reqPath.substring(5), function() { return res }, {
					"readable": function() {
						res.writeHead(200, {"Content-type": mimeType});
					},
					"success": function() {
						res.end();
					},
					"unreadable": function() {
						notFoundHandler(req, res);
					}
				});
			},

			/**
			 * serve literal contents of wiki pages
			 */
			"literal": function(req, res) {
				var reqUrl = url.parse(req.url)
				var reqPath = reqUrl.pathname;
				var title = pathToPageTitle(reqPath.substring("literal".length));
				var wikiFile = pathToPageTitle(title) + ".wiki";
				console.log("Serving wiki page: " + wikiFile);
				readFile(WIKI_DIR + "/" + wikiFile, function() { return res }, {
					"readable": function() {
						res.writeHead(200, {"Content-type": "text/plain; charset=utf-8"});
					},
					"success": function() {
						res.end();
					},
					"unreadable": function() {
						notFoundHandler(req, res);
					}
				});
			},

			/**
			 * serve wiki pages
			 */
			"*": (function() {
				var headerMarkup = "<html><body>";
				var footerMarkup = "</body></html>";

				fs.readFile(RES_DIR  + "/header.html", "utf8", function(err, data) {

					if (err) {
						console.log("Error reading header: '" + RES_DIR + "/header.html'");
						return;
					}

					headerMarkup = data;
				});

				fs.readFile(RES_DIR + "/footer.html", "utf8", function(err, data) {

					if (err) {
						console.log("Error reading footer: '" + RES_DIR + "/footer.html'");
						return;
					}

					footerMarkup = data;
				})

				return function(req, res) {
					var reqUrl = url.parse(req.url)
					var reqPath = reqUrl.pathname;
					var title = pathToPageTitle(reqPath);
					var wikiFile = title + ".wiki";
					var wpOut = null;

					readFile(WIKI_DIR + "/" + wikiFile, function() { return wpOut }, {
						"readable": function(fileStats) {
							res.writeHead(200, {"Content-type": "text/html; charset=utf-8"});
							res.write(headerMarkup);
							wp.process({
								"os": res,
								"title": title,
								"size": fileStats.size,
								"streamReady": function(os) {
									wpOut = os;
								},
								"success": function() {
									res.write(footerMarkup);
									res.end();
								}
							});
						},
						"unreadable": function() {
							notFoundHandler(req, res);
						}
					});
				}

			}())
		},

		"PUT": {

			/**
			 * serve requests to subtitute contents of wiki pages
			 */
			"*": function(req, res) {
				var reqUrl = url.parse(req.url)
				var reqPath = reqUrl.pathname;
				var title = pathToPageTitle(reqPath);
				var wikiFile = WIKI_DIR + "/" + title + ".wiki";
				var dataBuf = [];
				var ended = false;

				console.log("Attempting to write new contents to '" + wikiFile + "'");

				var onData = function(chunk) {
					dataBuf.push(chunk);
				};

				var onEnd = function() {
					ended = true;
				};

				req.on("data", function(chunk) { onData(chunk) });
				req.on("end", function() { onEnd() });

				tmpWikiFileName(function(wikiTmpFile) {
					var os = fs.createWriteStream(wikiTmpFile);

					// write buffered data
					while (dataBuf.length) {
						os.write(dataBuf.shift());
					}

					// append req body to temp file over series of chunks
					var wrote = false;
					onData = function(chunk) {
						wrote = os.write(chunk);
					};

					//TODO replace target file with tmp file
					onEnd = function() {

						var onDrain = function() {
							os.end();
							fs.rename(wikiTmpFile, wikiFile, function(err) {
								if (err) {
									res.writeHead(500);
									res.end();
									console.log("Error writing wiki file '" + wikiFile + "': '" + err + "'");
									return;
								}

								console.log("Wrote new contents to wiki file: " + wikiFile);
								updateFile(wikiFile);
								res.writeHead(200);
								res.end();
							});
						};

						if (wrote) {
							onDrain();
						} else {
							os.on("drain", function() { onDrain() });
						}
					};

					if (ended) {
						onEnd();
					}
				});
			}
		}
	};

	var pathRewriteTable = {
		"/": "/Index",
		"/literal/": "/literal/Index",
		"/favicon.ico": "/res/favicon.ico"
	};

	// define behavior to be invoked in cases request cannot be handled
	var notFoundHandler = function(req, res) {
		res.writeHead(404, {"Content-type": "text/plain"});
		res.write("Not Found");
		res.end();
	};

	/**
	 * the HTTP server created as a result of the following procedure is the primary function of this program
	 */
	http.createServer(function (req, res) {
		var reqUrl = url.parse(req.url);
		var reqPath = reqUrl.pathname;

		// important: never allow ".." to appear in path in order to prevent directory traversal
		reqPath = reqPath.replace("..", "");

		// rewrite path
		var reqRewrite = pathRewriteTable[reqPath];

		if (reqRewrite) {
			reqPath = reqRewrite;
			req.url = reqPath;
		}

		// make an attempt to map the request to the appropriate request handler
		var pathDispatchTable = dispatchTable[req.method];

		if (!pathDispatchTable) {
			console.log("No path dispatch table available for request method: '" + req.method + "'");
			notFoundHandler(req, res);
			return;
		}

		var reqPathParts = reqPath.split("/");
		var pathHandler = pathDispatchTable[reqPathParts[1]];

		if (!pathHandler) {
			pathHandler = pathDispatchTable["*"];
		}

		if (!pathHandler) {
			console.log("No path handler available for request path: '" + reqPathParts[1] + "'");
			notFoundHandler(req, res);
			return;
		}

		// a handler has been resolved for the request, so request processing may continue
		pathHandler(req, res);
	}).listen(8070, "127.0.0.1");
}());

console.log("Server running at http://127.0.0.1:8070/");
