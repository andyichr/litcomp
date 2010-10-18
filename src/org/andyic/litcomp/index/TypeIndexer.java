package org.andyic.litcomp.index;

import org.jsoup.*;
import org.jsoup.nodes.*;

/**
 * generic indexer interface
 */
public interface TypeIndexer {
	public void index(String title, Document doc);
}
