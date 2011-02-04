var fs = require( "fs" );

/**
 * @param int set size
 * @return array of random integers
 */
exports.makeEntropy = (function() {
	var is = fs.createReadStream( "/dev/random" );
	var req = [];

	is.on( "data", function( data ) {

		// stop reading when all requests are satisfied
		if ( !req.length ) {
			is.pause();
			return;
		}

		// dump buffer contents into current request
		var curReq = req[ req.length - 1 ];
		var i = 0;

		while ( curReq.set.length < curReq.setSize && i < data.length ) {
			curReq.set.push( data[ i ] % 10 );
			i++;
		}

		// request satisfied
		if ( curReq.set.length == curReq.setSize ) {
			curReq.success( curReq.set );
			req.pop();
		}

	} );

	return function( setSize, success ) {
		req.push( {
			"setSize": setSize,
			"success": success,
			"set": []
		} );
		is.resume();
	};
}());
