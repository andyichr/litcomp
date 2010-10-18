/**
 * defines an object which encapsulates communication with an external
 * wikitext indexer
 *
 * the protocol by which this class will communicate with wikitext processors is as follows:
 * writing a document: SIZE\nTITLE\nDOCUMENT
 *
 * @param os stream to which wikitext documents will be written
 */
exports.Indexer = function(os, is) {

	if (!os) {
		throw new Exception("os parameter must not resolve to false");
	}

	this.os = os;
};

/**
 * invoke indexing of a wikitext document
 *
 * @param title of document
 * @param size of wikitext
 * @param streamReady function applied to output stream when processing stream becomes available
 */
exports.Indexer.prototype.index = function(argv) {
	//FIXME add code to queue overlapping index requests
	var title = argv.title;
	var size = argv.size;
	var streamReady = argv.streamReady;

	if (size <= 0) {
		throw new Exception("size parameter must be greater than zero");
	}

	// write wikitext to stream
	var wpOs = this.os;
	wpOs.write(size);
	wpOs.write("\n");
	wpOs.write(title);
	wpOs.write("\n");
	streamReady(wpOs);
};
