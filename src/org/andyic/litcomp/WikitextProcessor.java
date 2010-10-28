package org.andyic.litcomp;

import java.io.*;
import java.nio.*;
import java.util.*;

import org.jsoup.*;
import org.jsoup.nodes.*;
import org.jsoup.select.*;
import org.json.simple.*;

public class WikitextProcessor {
	@SuppressWarnings("unchecked")
	public static void main(String[] args) {

		System.err.println("WikitextProcessor started");

		(new WikitextStream() {
			public String filter(String title, String wikitext, Document doc) {
				// init meta
				JSONObject meta = new JSONObject();
				// default to hash of empty string in order to handle new page case
				String hash = "da39a3ee5e6b4b0d3255bfef95601890afd80709";
				StringBuilder outStringBuilder = new StringBuilder();
				outStringBuilder.append("<div id=\"article_src\">");
				outStringBuilder.append(wikitext);

				try {
					hash = new StringHash(wikitext).hash();
				} catch (Exception  e) {
					System.err.println("Error while calculating page hash: " + e.toString());
				}

				// build page metadata
				meta.put("title", title);
				meta.put("hash", hash);
				outStringBuilder.append("</div>");
				outStringBuilder.append("<script>");
				outStringBuilder.append("var pageMeta = ");
				outStringBuilder.append(meta.toString());
				outStringBuilder.append(";");
				outStringBuilder.append("</script>");

				return outStringBuilder.toString();
			}
		}).read(System.in, System.out);
	}
}
