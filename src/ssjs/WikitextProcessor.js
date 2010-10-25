/**
 * defines an object which encapsulates communication with an external
 * wikitext processor
 *
 * the protocol by which this class communicates with wikitext processors is as follows:
 * writing a document: SIZE\nTITLE\nDOCUMENT
 * reading a document: SIZE\nDOCUMENT
 *
 * @param os stream to which wikitext documents will be written
 * @param is stream from which processed wikitext documents will be read
 * @param readFile function which defines behavior for reading a file by name
 */
exports.WikitextProcessor = function(os, is) {

	if (!os) {
		throw new Exception("os parameter must not resolve to false");
	}

	if (!is) {
		throw new Exception("is parameter must not resolve to false");
	}
	
	this.os = os;
	this.is = is;
	this.stack = [];

	var thisWikitextProcessor = this;
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
					thisWikitextProcessor.curOs.write(writeBuf);
					writeBuf = new Buffer(bufSize);
					writeBufIdx = 0;
				}

				if (readSize > targetSize) {
					thisWikitextProcessor.curOs.write(writeBuf.slice(0,targetSize%bufSize+1));
					thisWikitextProcessor.stack[thisWikitextProcessor.stack.length-1].success();
					thisWikitextProcessor.stack.pop();

					if (thisWikitextProcessor.stack.length > 0) {
						thisWikitextProcessor.curOs = thisWikitextProcessor.stack[thisWikitextProcessor.stack.length-1].os;
					} else {
						thisWikitextProcessor.curOs = null;
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
 * invoke processing of a wikitext document
 *
 * @param os stream to which processed wikitext is written
 * @param title of document
 * @param size of wikitext
 * @param streamReady function applied to output stream when processing stream becomes available
 * @param success function to be called when processing is complete
 */
exports.WikitextProcessor.prototype.process = function(argv) {
	var os = argv.os;
	var title = argv.title;
	var size = argv.size;
	var streamReady = argv.streamReady;
	var success = argv.success || function() {};

	if (size <= 0) {
		throw new Exception("size parameter must be greater than zero");
	}

	// push callback to stack
	this.stack.push({
		"os": os,
		"success": success
	});
	this.curOs = os;

	// write wikitext to stream
	var wpOs = this.os;
	wpOs.write(size);
	wpOs.write("\n");
	wpOs.write(title);
	wpOs.write("\n");
	streamReady(wpOs);
};
