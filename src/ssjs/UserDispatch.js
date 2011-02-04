var querystring = require( "querystring" );
var url = require( "url" );
var fs = require( "fs" );

exports.makeDispatchTable = function( dispatchArgs ) {
	return dispatchTable = {
		"GET": {

			/**
			 * serve static resources
			 */
			"res": function( req, res ) {
				var reqUrl = url.parse( req.url );
				var reqPath = reqUrl.pathname;

				console.log( "Serving resource: '" + reqPath + "'" );

				// resolve mimetype
				var mimeType = dispatchArgs.mimeTable[ reqPath.substring( reqPath.lastIndexOf( "." ) + 1 ) ];

				if ( !mimeType ) {
					mimeType = dispatchArgs.mimeTable[ "*" ];
					console.log( "Defaulting to default mimetype of '" + mimeType + "' for resource: '" + reqPath + "'" );
				}

				// read entire resource from disk
				dispatchArgs.readFile( dispatchArgs.RES_DIR + "/www/" + reqPath.substring( 5 ), function() { return res }, {
					"readable": function() {
						var expires = new Date();
						expires.setTime( expires.getTime() + 1000 * 60 * 60 * 24 );
						res.writeHead( 200, {
							"Content-type": mimeType,
							"Expires": expires.toGMTString()
						} );
					},
					"success": function() {
						res.end();
					},
					"unreadable": function() {
						dispatchArgs.notFoundHandler( req, res );
					}
				} );
			},

			/**
			 * serve literal contents of wiki pages
			 */
			"literal": function( req, res ) {
				var reqUrl = url.parse( req.url )
				var reqPath = reqUrl.pathname;
				var title = dispatchArgs.pathToPageTitle( reqPath.substring( "literal".length ));
				var wikiFile = dispatchArgs.pathToPageTitle( title ) + ".wiki";
				console.log( "Serving wiki page: " + wikiFile );
				dispatchArgs.readFile( dispatchArgs.WIKI_DIR + "/" + wikiFile, function() { return res }, {
					"readable": function() {
						res.writeHead( 200, { "Content-type": "text/plain; charset=utf-8" } );
					},
					"success": function() {
						res.end();
					},
					"unreadable": function() {
						// send empty content for new pages
						res.writeHead( 200, { "Content-type": "text/plain; charset=utf-8" } );
						res.end();
					}
				} );
			},

			/**
			 * serve wiki pages
			 */
			"*": (function() {
				var headerMarkup = "<html><body>";
				var footerMarkup = "</body></html>";

				fs.readFile( dispatchArgs.RES_DIR  + "/header.html", "utf8", function( err, data ) {

					if ( err ) {
						console.log( "Error reading header: '" + dispatchArgs.RES_DIR + "/header.html'" );
						return;
					}

					headerMarkup = data;
				} );

				fs.readFile( dispatchArgs.RES_DIR + "/footer.html", "utf8", function( err, data ) {

					if ( err ) {
						console.log( "Error reading footer: '" + dispatchArgs.RES_DIR + "/footer.html'" );
						return;
					}

					footerMarkup = data;
				} );

				return function( req, res ) {
					var reqUrl = url.parse( req.url )
					var reqPath = querystring.unescape( reqUrl.pathname );
					var title = dispatchArgs.pathToPageTitle( reqPath );
					var wikiFile = title + ".wiki";
					var wpOut = null;

					console.log( "Transformed title: '" + title + "'" );

					dispatchArgs.readFile( dispatchArgs.WIKI_DIR + "/" + wikiFile, function() { return wpOut }, {
						"readable": function( fileStats ) {
							res.writeHead( 200, { "Content-type": "text/html; charset=utf-8" } );
							res.write( headerMarkup );
							dispatchArgs.wikitestProcessor.process( {
								"os": res,
								"title": title,
								"size": fileStats.size,
								"streamReady": function( os ) {
									wpOut = os;
								},
								"success": function() {
									res.write( footerMarkup );
									res.end();
								}
							} );
						},
						"unreadable": function() {
							// send "blank" wiki page
							res.writeHead( 200, { "Content-type": "text/html; charset=utf-8" } );
							res.write( headerMarkup );
							//FIXME define default content outside of this file
							res.write( "<p><em>There is nothing here yet. Click &quot;Edit&quot; to define the content of this page.</em></p>" );
							res.write( "<script>var pageMeta = { title: \"" + title + "\" };</script>" );
							res.write( footerMarkup );
							res.end();
						}
					} );
				}

			}())
		},

		"PUT": {

			/**
			 * serve requests to subtitute contents of wiki pages
			 */
			"*": function( req, res ) {
				var reqUrl = url.parse( req.url )
				var reqPath = reqUrl.pathname;
				var title = dispatchArgs.pathToPageTitle( reqPath );
				var wikiFile = dispatchArgs.WIKI_DIR + "/" + title + ".wiki";
				var dataBuf = [];
				var ended = false;

				console.log( "Attempting to write new contents to '" + wikiFile + "'" );

				var onData = function( chunk ) {
					dataBuf.push( chunk );
				};

				var onEnd = function() {
					ended = true;
				};

				req.on( "data", function( chunk ) { onData( chunk ) } );
				req.on( "end", function() { onEnd() } );

				//FIXME add timeout so that client cannot halt indexing with bad request
				dispatchArgs.index( {
					"title": title,
					"size": req.headers[ "content-length" ],
					"streamReady": function( indexerOs ) {
						dispatchArgs.tmpWikiFileName( function( wikiTmpFile ) {
							var os = fs.createWriteStream( wikiTmpFile );

							// write buffered data
							while ( dataBuf.length ) {
								var curBuf = dataBuf.shift();
								indexerOs.write( curBuf );
								os.write( curBuf );
							}

							// append req body to temp file over series of chunks
							var wrote = false;
							onData = function( chunk ) {
								indexerOs.write( chunk );
								wrote = os.write( chunk );
							};

							onEnd = function() {

								var onDrain = function() {
									os.end();
									// replace target file with tmp file
									fs.rename( wikiTmpFile, wikiFile, function( err ) {
										if ( err ) {
											res.writeHead( 500 );
											res.end();
											console.log( "Error writing wiki file '" + wikiFile + "': '" + err + "'" );
											return;
										}

										console.log( "Wrote new contents to wiki file: " + wikiFile );
										dispatchArgs.updateFile( wikiFile );
										res.writeHead( 200 );
										res.end();
									} );
								};

								if ( wrote ) {
									onDrain();
								} else {
									os.on( "drain", function() { onDrain() } );
								}
							};

							if ( ended ) {
								onEnd();
							}
						} );
					}
				} );
			}
		}
	};
};
