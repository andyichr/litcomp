package org.andyic.litcomp.index;

import org.andyic.litcomp.StringHash;

import java.util.*;

import org.jsoup.*;
import org.jsoup.nodes.*;
import org.jsoup.select.*;

public class SectionTitleIndexer implements TypeIndexer {
	private IndexDataStore dataStore;
	
	public SectionTitleIndexer(IndexDataStore dataStore) {
		this.dataStore = dataStore;
	}

	public void index(final String title, String wikitext, Document doc) {

		try {
			final String hash = new StringHash(wikitext).hash();

			// parse input with JSOUP
			class Walker {
				private int secIndex;

				Walker(int secIndex) {
					this.secIndex = secIndex;
				}

				public int walk(Element el) {
					Elements children = el.children();
					String tagName = el.tagName().toLowerCase();

					if (tagName.matches("h[1-6]")) {
						secIndex++;
						String secName = el.text();
						String key = "SectionTitle"
								+ "/" + title
								+ "/" + hash
								+ "/" + new Integer(secIndex).toString();
						String value = secNameFilter(secName);
						dataStore.put(key, value);
					}

					for (Element child : children) {
						secIndex = (new Walker(secIndex)).walk(child);
					}

					return secIndex;
				}
			}

			(new Walker(0)).walk(doc.body());
		} catch (Exception e) {
			System.err.println("SectionTitleIndexer.index failed due to exception: '" + e.toString() + "'");
		}
	}

	//FIXME deduplicate redundant code
	private String secNameFilter(String secName) {
		return secName.replaceAll("[^a-zA-Z0-9.-]", "_");
	}
}
