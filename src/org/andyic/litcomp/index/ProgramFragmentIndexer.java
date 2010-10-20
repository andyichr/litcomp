package org.andyic.litcomp.index;

import java.util.*;

import org.jsoup.*;
import org.jsoup.nodes.*;
import org.jsoup.select.*;

public class ProgramFragmentIndexer implements TypeIndexer {
	private IndexDataStore dataStore;
	
	public ProgramFragmentIndexer(IndexDataStore dataStore) {
		this.dataStore = dataStore;
	}

	public void index(final String title, String wikitext, Document doc) {

		// parse input with JSOUP
		class Walker {
			private String secName;

			Walker(String secName) {
				this.secName = secName;
			}

			public String walk(Element el) {
				Elements children = el.children();
				String tagName = el.tagName().toLowerCase();

				if (tagName.matches("h[1-6]")) {
					secName = el.text();
				} else if (tagName.equals("pre")) {
					String className = el.attr("class");
					String langName = el.attr("data-lang");

					if (className.equals("source")) {
						String key = "ProgramFragment" + "/" + title + "/" + secNameFilter(secName);
						StringBuilder valueBuilder = new StringBuilder();

						if (langName.length() > 0) {
							valueBuilder.append("#!/usr/bin/env " + langName + "\n");
						}

						valueBuilder.append(el.text());
						String value = valueBuilder.toString();

						dataStore.put(key, value);
					}
				}

				for (Element child : children) {
					secName = (new Walker(secName)).walk(child);
				}

				return secName;
			}
		}

		(new Walker("")).walk(doc.body());
	}

	//FIXME deduplicate redundant code
	private String secNameFilter(String secName) {
		return secName.replaceAll("[^a-zA-Z0-9.-]", "_");
	}
}
