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

		int wikitextLength;
		String pageTitle;
		int bufLen = 4096;
		byte[] lenBuf = new byte[bufLen];
		int lenBufIdx = 0;
		byte[] titleBuf = new byte[bufLen];
		int titleBufIdx = 0;

		try {
			int b;

			while (true) {
				lenBufIdx = 0;
				titleBufIdx = 0;

				while ((b = System.in.read()) != 0x0a) {

					if (b == -1) {
						System.err.println("Input ended");
						return;
					}

					lenBuf[lenBufIdx] = (byte)b;
					lenBufIdx++;
				}

				wikitextLength = Integer.parseInt(new String(lenBuf, 0, lenBufIdx, "UTF-8"));

				// init meta
				JSONObject meta = new JSONObject();
				String title = "";
				// default to hash of empty string in order to handle new page case
				String hash = "da39a3ee5e6b4b0d3255bfef95601890afd80709";

				while ((b = System.in.read()) != 0x0a) {

					if (b == -1) {
						System.err.println("Input ended");
						return;
					}

					titleBuf[titleBufIdx] = (byte)b;
					titleBufIdx++;
				}

				title = new String(titleBuf, 0, titleBufIdx, "UTF-8");

				byte[] wikitextBuf = new byte[wikitextLength];

				for (int i = 0; i < wikitextLength; i++) {
					b = System.in.read();

					if (b == -1) {
						System.err.println("Input ended");
						return;
					}

					wikitextBuf[i] = (byte)b;
				}
				
				String wikitext = new String(wikitextBuf,0,wikitextLength,"UTF-8");
				Vector<Integer> runIndexes = new Vector<Integer>();
				String output = wikitextToXhtml(wikitext, runIndexes);
				byte[] outBytes = output.getBytes("UTF-8");

				// calculate hash of page
				try {
					MessageDigest digest = MessageDigest.getInstance("SHA-1");
					digest.update(outBytes);
					byte[] digestBytes = digest.digest();

					for (int i = 0; i < digestBytes.length; i++) {
						String hex = Integer.toHexString(0xFF & digestBytes[i]);

						if (hex.length() == 1) {
							hash += "0";
						}

						hash += hex;
					}

				} catch (NoSuchAlgorithmException e) {
					System.err.println("Error while calculating page hash: " + e.toString());
				}

				// build page metadata
				meta.put("title", title);
				meta.put("hash", hash);
				meta.put("runIndexes", runIndexes);
				StringBuilder pageMetaStringBuilder = new StringBuilder();
				pageMetaStringBuilder.append("<script>");
				pageMetaStringBuilder.append("var pageMeta = ");
				pageMetaStringBuilder.append(meta.toString());
				pageMetaStringBuilder.append(";");
				pageMetaStringBuilder.append("</script>");
				String pageMeta = pageMetaStringBuilder.toString();
				
				// write output
				byte[] pageMetaBytes = pageMeta.getBytes("UTF-8");
				System.out.println(outBytes.length + pageMetaBytes.length);
				System.out.write(outBytes);
				System.out.write(pageMetaBytes);
			}
		} catch (IOException e) {
			System.err.println(e.toString());
		}
	}

	protected static String wikitextToXhtml(final String inputHTML, final Vector<Integer> runIndexes) throws IOException {

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
					System.err.println("HEADER");
					System.err.println(el.toString());
					runIndex++;
				} else if (tagName.equals("pre")) {
					String className = el.attr("class");
					if (className.equals("source")) {
						System.err.println("INDEX: " + runIndex);
						runIndexes.add(new Integer(runIndex));
					}
				}

				for (Element child : children) {
					runIndex = (new Walker(runIndex)).walk(child);
				}

				return runIndex;
			}
		}

		Document doc = Jsoup.parseBodyFragment(inputHTML);
		(new Walker(0)).walk(doc.body());

		// serialize DOM to XHTML and write to os
		Element body = doc.body();
		return body.html();
	}
}
