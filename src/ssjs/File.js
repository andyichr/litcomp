var fs = require( "fs" );

exports.makeFileInterface = function() {
	var fileCache = {};

	return {
		updateFile: makeUpdateFile( fileCache ),
		readFile: makeReadFile( fileCache )
	};
};

/**
 * invalidate the cache of a file
 */
var makeUpdateFile = function( fileCache ) {
	return function( fileName ) {
		fileCache[ fileName ] = null;
	};
};

/**
 * read file @ fileName into writable stream @ os
 */
var makeReadFile = function( fileCache ) {
	return function( fileName, os, cb ) {
		var cache = fileCache[ fileName ];

		console.log( "Loading file: '" + fileName + "'" );

		if ( cache ) {
			return cache( os, cb );
		}

		// cache behavior is not defined yet for this file, therefore definition is necessary
		console.log( "Reading file from disk: '" + fileName + "'" );

		// ensure file exists & is readable
		fs.stat( fileName, function( err, stats ) {

			if ( err ) {
				if ( cb.unreadable ) {
					console.log( "Unreadable file was requested: '" + fileName + "'" );
					cb.unreadable();
				}

				return;
			}

			var buffer = [];
			var rs = fs.createReadStream( fileName );
			rs.on( "data", function( data ) {
				buffer.push( data )
			} );
			rs.on( "error", function() {
				if ( buffer.length ) {
					if ( cb.unreadable ) {
						cb.unreadable();
					}
				} else {
					if ( cb.error ) {
						cb.error();
					}
				}
			} );
			rs.on( "end", function() {
				fileCache[ fileName ] = function( os, cb ) {
					if ( cb.readable ) {
						cb.readable( stats );
					}
				};

				var lastFn = fileCache[ fileName ];

				for ( var i = 0; i < buffer.length; i++ ) {
					(function() {
						var bufferIndex = i;
						var innerLastFn = lastFn;
						fileCache[ fileName ] = function( os, cb ) {
							innerLastFn( os, cb );
							os().write( buffer[ bufferIndex ] );
						};
					}());

					lastFn = fileCache[ fileName ];
				}

				fileCache[ fileName ] = function( os, cb ) {
					lastFn( os, cb );
					
					if ( cb.success ) {
						cb.success();
					}
				};

				fileCache[ fileName ]( os, cb );
			} );
		} );
	};
};
