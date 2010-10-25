/**
 * defines an object which encapsulates communication with an external
 * JSON RPC process
 *
 * the protocol by which this class communicates with wikitext processors is as follows:
 * writing a document: SIZE\nDOCUMENT
 * reading a document: SIZE\nDOCUMENT
 *
 * @param os stream to which JSON RPC responses will be written
 * @param is stream from which JSON RPC requests will be read
 */
exports.StreamRPC = function(os, is) {

	if (!os) {
		throw new Exception("os parameter must not resolve to false");
	}

	if (!is) {
		throw new Exception("is parameter must not resolve to false");
	}
	
	this.os = os;
	this.is = is;
	this.success = {};

	var thisStreamRPC = this;
	var bufSize = 4096;

	(function() {
		var readSize = 0;
		var targetSize = 0;
		var targetSizeBuf = new Buffer(bufSize);
		var writeBuf;
		var writeBufIdx;

		var onData = function(data) {

			if (targetSize) {

				writeBuf[writeBufIdx] = data[0];
				writeBufIdx++;
				readSize++;

				if (writeBufIdx >= bufSize) {
					var newWriteBuf = new Buffer(writeBuf.length + (bufSize * 8));
					writeBuf.copy(newWriteBuf, 0, 0);
					writeBuf = newWriteBuf;
				}

				if (readSize > targetSize) {
					var res = JSON.parse(writeBuf.toString("utf8",0,writeBufIdx));

					if (thisStreamRPC.success[res.id]) {
						thisStreamRPC.success[res.id](res);
					} else {
						console.log("Got RPC response for unknown request ID: '" + res.id + "'");
					}

					targetSize = 0;
					readSize = 0;
				}
			} else {
				if (data[0] == 0x0a) {
					targetSize = targetSizeBuf.toString("utf8", 0, readSize);
					readSize = 0;
					writeBufIdx = 0;
					writeBuf = new Buffer(bufSize);
					onData(data);
				} else {
					targetSizeBuf[readSize] = data[0];
					readSize++;
				}
			}
		};

		is.on("data", onData);
	}());
};

/**
 * invoke JSON RPC request
 *
 * @param req JSON RPC request
 * @param success applied to JSON RPC response data
 */
exports.StreamRPC.prototype.invoke = function(req, success) {

	this.success[req.id] = success;

	// write wikitext to stream
	var data = JSON.stringify(req);
	this.os.write(data.length);
	this.os.write("\n");
	this.os.write(data);
};
