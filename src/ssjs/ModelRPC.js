var child_process = require('child_process');

exports.makeModelRPC = function( modelRPCArgs ) {
	return {
		realize: function( req, onData ) {
			var buffer = "";
			var child = child_process.spawn( "modelrpc" );

			child.stdout.on( "data", function( data ) {
				buffer += data;
			} );

			child.stderr.on( "data", function( data ) {
				console.log( "ModelRPC ERROR: " + data );
			} );

			child.on( "exit", function( code ) {
				onData( {
					result: {
						value: JSON.parse( buffer )
					}
				} );
			} );

			child.stdin.end( JSON.stringify( req ) );
		}
	};
};
