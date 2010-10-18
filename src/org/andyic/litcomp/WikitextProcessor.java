package org.andyic.litcomp;

import java.io.*;
import java.nio.*;
import java.util.*;

import org.jsoup.*;
import org.jsoup.nodes.*;
import org.jsoup.select.*;
import java.security.*;
import org.json.simple.*;

public class WikitextProcessor {
	@SuppressWarnings("unchecked")
	public static void main(String[] args) {

		(new WikitextStream() {
			public String filter(String title, String wikitext, Document doc) {
				// init meta
				JSONObject meta = new JSONObject();
				// default to hash of empty string in order to handle new page case
				String hash = "da39a3ee5e6b4b0d3255bfef95601890afd80709";
				Vector<Integer> runIndexes = new Vector<Integer>();
				StringBuilder outStringBuilder = new StringBuilder();
				String xhtml = wikitextToXhtml(doc, runIndexes);
				outStringBuilder.append(xhtml);

				// calculate hash of page
				try {
					byte[] hashBytes = xhtml.getBytes("UTF-8");
					MessageDigest digest = MessageDigest.getInstance("SHA-1");
					digest.update(hashBytes);
					byte[] digestBytes = digest.digest();

					for (int i = 0; i < digestBytes.length; i++) {
						String hex = Integer.toHexString(0xFF & digestBytes[i]);

						if (hex.length() == 1) {
							hash += "0";
						}

						hash += hex;
					}

				} catch (UnsupportedEncodingException  e) {
					System.err.println("Error while calculating page hash: " + e.toString());
				} catch (NoSuchAlgorithmException e) {
					System.err.println("Error while calculating page hash: " + e.toString());
				}

				// build page metadata
				meta.put("title", title);
				meta.put("hash", hash);
				meta.put("runIndexes", runIndexes);
				outStringBuilder.append("<script>");
				outStringBuilder.append("var pageMeta = ");
				outStringBuilder.append(meta.toString());
				outStringBuilder.append(";");
				outStringBuilder.append("</script>");

				return outStringBuilder.toString();
			}
		}).read(System.in, System.out);
	}

	protected static String wikitextToXhtml(final Document doc, final Vector<Integer> runIndexes) {

		// parse input with JSOUP
		class Walker {
			private int runIndex;

			Walker(int runIndex) {
				this.runIndex = runIndex;
			}

			public int walk(Element el) {
				Elements children = el.children();
				String tagName = el.tagName().toLowerCase();

				if (tagName.matches("h[1-6]")) {
					runIndex++;
				} else if (tagName.equals("pre")) {
					String className = el.attr("class");
					if (className.equals("source")) {
						runIndexes.add(new Integer(runIndex));
					}
				}

				for (Element child : children) {
					runIndex = (new Walker(runIndex)).walk(child);
				}

				return runIndex;
			}
		}

		(new Walker(0)).walk(doc.body());

		// serialize DOM to XHTML and write to os
		Element body = doc.body();
		return body.html();
	}
}
