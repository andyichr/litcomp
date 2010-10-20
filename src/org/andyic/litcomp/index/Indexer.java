package org.andyic.litcomp.index;

import org.andyic.litcomp.WikitextStream;

import java.io.*;
import java.nio.*;
import java.util.*;

import org.jsoup.*;
import org.jsoup.nodes.*;
import org.jsoup.select.*;

/**
 * reads wikitext from stdin and writes index data to data store
 *
 * usage: Indexer INDEX_DIR TYPE
 */
public class Indexer {
	@SuppressWarnings("unchecked")
	public static void main(String[] args) {

		if (args.length != 2) {
			System.err.println("usage: Indexer INDEX_DIR TYPE");
			return;
		}

		Hashtable<String, TypeIndexer> typeHash = new Hashtable<String, TypeIndexer>();
		IndexDataStore dataStore = new IndexDataStore(args[0]);
		typeHash.put("ProgramFragment", new ProgramFragmentIndexer(dataStore));
		typeHash.put("SectionTitle", new SectionTitleIndexer(dataStore));
		final TypeIndexer indexer = typeHash.get(args[1]);

		if (indexer == null) {
			System.err.println("Invalid indexer");
			return;
		}

		(new WikitextStream() {
			public String filter(String title, String wikitext, Document doc) {
				indexer.index(title, wikitext, doc);
				return "\"OK\"";
			}
		}).read(System.in, System.out);
	}
}
