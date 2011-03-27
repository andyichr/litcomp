/**
 * node.js implementation of wiki server
 *
 * USAGE: node server.js
 *     --res-dir=[RES DIR]
 *     --wiki-dir=[WIKI DIR]
 *     --wiki-index-dir=[WIKI INDEX DIR]
 *     --wiki-src-out=[file descriptor to which literal wikitext is written]
 *     --wiki-html-in=[file descriptor from which processed wikitext (HTML) is read]
 *     --indexer-out=[file descriptor to which literal wikitext is written]
 *     --index-rpc-out=[file descriptor to which index RPC requests are written]
 *     --index-rpc-in=[file descriptor from which index RPC responses are read]
 */

var http = require( "http" );
var url = require( "url" );
var querystring = require( "querystring" );
var fs = require( "fs" );
var spawn = require( "child_process" ).spawn;
var WikitextProcessor = require( "./WikitextProcessor" ).WikitextProcessor;
var Indexer = require( "./Indexer" ).Indexer;
var File = require( "./File" );
var UserDispatch = require( "./UserDispatch" );
var ModelRPC = require( "./ModelRPC" );
var Entropy = require( "./Entropy" );
var StreamRPC = require( "./StreamRPC" ).StreamRPC;
var argv = require( "../../lib/optimist/optimist" )
		.demand( [ "res-dir", "wiki-dir", "wiki-src-out", "wiki-html-in", "indexer-out", "index-rpc-out", "index-rpc-in" ] )
		.argv;
var io = require( "../../lib/Socket.IO" );

var RES_DIR = argv[ "res-dir" ];
var WIKI_DIR = argv[ "wiki-dir" ];
var WIKI_INDEX_DIR = argv[ "wiki-index-dir" ];
var WIKITEXT_OUT = argv[ "wiki-src-out" ];
var WIKITEXT_IN = argv[ "wiki-html-in" ];
var INDEX_RPC_OUT = argv[ "index-rpc-out" ];
var INDEX_RPC_IN = argv[ "index-rpc-in" ];
var INDEXER_OUT = argv[ "indexer-out" ];

(function() {
	/**
	 * define WikitextProcessor instance to be used for duration of server process
	 */
	var wp = new WikitextProcessor(
			fs.createWriteStream( WIKITEXT_OUT ),
			fs.createReadStream( WIKITEXT_IN, {
				"flags": "r",
				"encoding": null,
				"mode": 0666,
				"bufferSize": 1} ) );
	
	var indexRPC = new StreamRPC(
			fs.createWriteStream( INDEX_RPC_OUT ),
			fs.createReadStream( INDEX_RPC_IN, {
				"flags": "r",
				"encoding": null,
				"mode": 0666,
				"bufferSize": 1} ) );

	var modelRPC = ModelRPC.makeModelRPC( {
	} );

	var indexer = new Indexer( fs.createWriteStream( INDEXER_OUT ) );

	var pathToPageTitle = function( path ) {
		return path.substring( 1 ).replace( /[^a-zA-Z0-9.-]/, "_" );
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
	 * temporary file name
	 */
	var tmpWikiFileName = function( success ) {
		Entropy.makeEntropy( 64, function( set ) {
			success( WIKI_DIR + "/.tmp." + set.join( "" ) );
		} );
	};

	// define behavior to be invoked as changes in files occur
	var fileInterface = File.makeFileInterface();

	var dispatchTable = UserDispatch.makeDispatchTable( {
		RES_DIR: RES_DIR,
		WIKI_DIR: WIKI_DIR,
		mimeTable: mimeTable,
		readFile: fileInterface.readFile,
		notFoundHandler: notFoundHandler,
		pathToPageTitle: pathToPageTitle,
		index: function( args ) { indexer.index( args ); },
		tmpWikiFileName: tmpWikiFileName,
		updateFile: fileInterface.updateFile,
		wikitestProcessor: wp
	} );

	var pathRewriteTable = {
		"/": "/Index",
		"/literal/": "/literal/Index",
		"/favicon.ico": "/res/favicon.ico"
	};

	// define behavior to be invoked in cases request cannot be handled
	var notFoundHandler = function( req, res ) {
		res.writeHead( 404, { "Content-type": "text/plain" } );
		res.write( "Not Found" );
		res.end();
	};

	/**
	 * the HTTP server created as a result of the following procedure is the primary function of this program
	 */
	var server = http.createServer( function (req, res ) {
		var reqUrl = url.parse( req.url );
		var reqPath = reqUrl.pathname;

		// important: never allow ".." to appear in path in order to prevent directory traversal
		reqPath = reqPath.replace( "..", "" );

		// rewrite path
		var reqRewrite = pathRewriteTable[ reqPath ];

		if ( reqRewrite ) {
			reqPath = reqRewrite;
			req.url = reqPath;
		}

		// make an attempt to map the request to the appropriate request handler
		var pathDispatchTable = dispatchTable[ req.method ];

		if ( !pathDispatchTable ) {
			console.log( "No path dispatch table available for request method: '" + req.method + "'" );
			notFoundHandler( req, res );
			return;
		}

		var reqPathParts = reqPath.split( "/" );
		var pathHandler = pathDispatchTable[ reqPathParts[ 1 ] ];

		if ( !pathHandler ) {
			pathHandler = pathDispatchTable[ "*" ];
		}

		if ( !pathHandler ) {
			console.log( "No path handler available for request path: '" + reqPathParts[ 1 ] + "'" );
			notFoundHandler( req, res );
			return;
		}

		// a handler has been resolved for the request, so request processing may continue
		pathHandler( req, res );
	} );
	server.listen( 8070, "127.0.0.1" );

	// handle realtime communication
	var socket = io.listen( server );
	//FIXME create unique client ID per connection and combine this with client request id
	socket.on( "connection", function( client ) {
		var reqMethodTable = {
			/**
			 * realize a value in the model
			 */
			take: function( req ) {
				// interface index data store
				var rpcReq = {
					"take": req.params
				};
				modelRPC.realize( rpcReq, function( res ) {
					client.send( JSON.stringify( {
						id: req.id,
						result: {
							value: res.result.value
						}
					} ) );
				} );
			},

			/**
			 * serve contents of an index key
			 */
			index: function( req ) {
				// interface index data store
				req.method = "get";
				indexRPC.invoke( req, function( res ) {
					client.send( JSON.stringify( {
						id: req.id,
						result: {
								value: res.result.value
							}
					} ) );
				} );
			},

			/**
			 * execute a program fragment
			 */
			exec: function( req ) {
				// resolve section
				//FIXME use index data store rather than interfacing index directly
				var indexKey = "SectionTitle/" + req.params.title.replace( "..", "" ) + "/" + req.params.pageHash.replace( "..", "" ) + "/" + parseInt( req.params.index );
				fs.readFile( WIKI_INDEX_DIR + "/" + indexKey, function( err, sectionTitle ) {
					if ( err ) {
						console.log( "Error looking up title for section index: " + err );
						return;
					}

					var child = spawn( "bash", [ "-c", "See: " + req.params.title + "#" + sectionTitle ], {
						cwd: WIKI_DIR + "/.cache"
					} );
					child.stdout.on( "data", function( data ) {
						var res = {
							id: req.id,
							result: {
								stdout: data.toString()
							}
						};
						client.send( JSON.stringify( res ) );
					} );
					child.stderr.on( "data", function( data ) {
						var res = {
							id: req.id,
							result: {
								stderr: data.toString()
							}
						};
						client.send( JSON.stringify( res ) );
					} );
					child.on( "exit", function( code ) {
						var res = {
							id: req.id,
							result: {
								exit: true
							}
						};
						client.send( JSON.stringify( res ) );
					} );
				} );
			}
		};

		client.on( "message", function( data ) {
			data = JSON.parse( data );
			if ( reqMethodTable[ data.method ] ) {
				console.log( "Invoking JSON-RPC method: '" + data.method + "'" );
				reqMethodTable[ data.method ]( data );
			} else {
				console.log( "Invalid JSON-RPC method: '" + data.method + "'" );
			}
		} );

		client.on( "disconnect", function() {
			console.log( "client disconnected" );
			//TODO implement
		} );

	} );
}());

console.log( "Server running at http://127.0.0.1:8070/" );
