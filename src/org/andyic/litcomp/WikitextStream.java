package org.andyic.litcomp;

import java.io.*;
import java.nio.*;
import java.util.*;

import org.jsoup.*;
import org.jsoup.nodes.*;
import org.jsoup.select.*;

abstract public class WikitextStream {

	abstract public String filter(String title, String wikitext, Document doc);

	@SuppressWarnings("unchecked")
	public void read(InputStream is, OutputStream os) {

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

				while ((b = is.read()) != 0x0a) {

					if (b == -1) {
						System.err.println("Input ended");
						return;
					}

					lenBuf[lenBufIdx] = (byte)b;
					lenBufIdx++;
				}

				wikitextLength = Integer.parseInt(new String(lenBuf, 0, lenBufIdx, "UTF-8"));

				// init meta
				String title = "";
				// default to hash of empty string in order to handle new page case
				String hash = "da39a3ee5e6b4b0d3255bfef95601890afd80709";

				while ((b = is.read()) != 0x0a) {

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
					b = is.read();

					if (b == -1) {
						System.err.println("Input ended");
						return;
					}

					wikitextBuf[i] = (byte)b;
				}
				
				String wikitext = new String(wikitextBuf,0,wikitextLength,"UTF-8");
				Document doc = Jsoup.parseBodyFragment(wikitext);
				String out = filter(title, wikitext, doc);
				byte[] outBytes = out.getBytes("UTF-8");
				os.write(new Integer(outBytes.length).toString().getBytes("UTF-8"));
				os.write(0x0a);
				os.write(outBytes);
			}
		} catch (IOException e) {
			System.err.println(e.toString());
		}
	}
}
