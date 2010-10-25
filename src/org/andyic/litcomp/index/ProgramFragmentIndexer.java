package org.andyic.litcomp.index;

import org.andyic.litcomp.StringHash;

import java.util.*;

import org.jsoup.*;
import org.jsoup.nodes.*;
import org.jsoup.select.*;

import org.json.simple.*;

public class ProgramFragmentIndexer implements TypeIndexer {
	private IndexDataStore dataStore;
	
	public ProgramFragmentIndexer(IndexDataStore dataStore) {
		this.dataStore = dataStore;
	}

	@SuppressWarnings("unchecked")
	public void index(final String title, String wikitext, Document doc) {

		try {
			final String hash = new StringHash(wikitext).hash();
			final JSONArray runIndexes = new JSONArray();

			class WalkerState {
				private String lastSecName = "";
				private int lastSourceIndex = 0;
				private int lastSectionIndex = 0;

				public String getLastSecName() {
					return lastSecName;
				}

				public void setLastSecName(String newLastSecName) {
					if (newLastSecName == null) {
						System.err.println("Error: setLastSecName was applied to null value");
						return;
					}

					this.lastSecName = newLastSecName;
				}

				public int getLastSourceIndex() {
					return lastSourceIndex;
				}

				public void setLastSourceIndex(int newLastSourceIndex) {
					this.lastSourceIndex = newLastSourceIndex;
				}

				public int getLastSectionIndex() {
					return lastSectionIndex;
				}

				public void setLastSectionIndex(int newLastSectionIndex) {
					this.lastSectionIndex = newLastSectionIndex;
				}
			}

			class Walker {
				private WalkerState state;

				Walker(WalkerState state) {
					this.state = state;
				}

				public void walk(Element el) {
					Elements children = el.children();
					String tagName = el.tagName().toLowerCase();

					if (tagName.matches("h[1-6]")) {
						state.setLastSectionIndex(state.getLastSectionIndex() + 1);
						state.setLastSecName(el.text());
					} else if (tagName.equals("pre")) {
						String className = el.attr("class");
						String langName = el.attr("data-lang");

						if (className.equals("source")) {
							runIndexes.add(new Integer(state.getLastSectionIndex()));
							state.setLastSourceIndex(state.getLastSourceIndex() + 1);
							String filteredSecName = secNameFilter(state.getLastSecName());
							String key = "ProgramFragment" + "/" + title + "/" +  filteredSecName;
							dataStore.put(key, el.text());
							String langKey = "ProgramFragmentLang" + "/" + title + "/" + filteredSecName;
							dataStore.put(langKey, langName);
							String preIndexKey = "ProgramFragmentPreIndex" + "/" + title + "/" + hash + "/" + state.getLastSectionIndex();
							dataStore.put(preIndexKey, new Integer(state.getLastSourceIndex()).toString());
						}
					}

					for (Element child : children) {
						(new Walker(state)).walk(child);
					}
				}
			}

			(new Walker(new WalkerState())).walk(doc.body());

			String runIndexesKey = "ProgramFragmentRunIndexes/" + title + "/" + hash;
			dataStore.put(runIndexesKey, runIndexes.toString());
		} catch (Exception e) {
			System.err.println("SectionTitleIndexer.index failed due to exception: '" + e.toString() + "'");
		}
	}

	//FIXME deduplicate redundant code
	private String secNameFilter(String secName) {
		return secName.replaceAll("[^a-zA-Z0-9.-]", "_");
	}
}
