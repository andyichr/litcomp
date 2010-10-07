package org.andyic.litcomp;

import java.io.*;
import java.nio.*;
import java.util.*;

import org.apache.commons.io.IOUtils;

import org.wikimodel.wem.*;
import org.wikimodel.wem.mediawiki.*;
import org.wikimodel.wem.xhtml.PrintListener;

import org.json.simple.*;
import org.json.simple.parser.*;

import org.jsoup.*;
import org.jsoup.nodes.*;
import org.jsoup.select.*;

public class LitComp {
	public static void main(String[] args) {
		//TODO: load header/footer
		//TODO: reload header/footer when changed (http://jnotify.sourceforge.net/)

		// read arguments
		Hashtable<String, String> argMap = new Hashtable<String, String>();
		int rootArgIdx = 0;
		int port = 8070;
		File root;

		for (String arg : args) {
			if (arg.substring(0,2).equals("--")) {
				if (arg.length() == 2) {
					System.err.println("Invalid argument");
					return;
				}

				int eqIdx = arg.indexOf("=");

				if (eqIdx == -1 || eqIdx == 2) {
					System.err.println("Invalid argument");
					return;
				}

				rootArgIdx++;
				argMap.put(arg.substring(2, eqIdx), arg.substring(eqIdx+1));
			}
		}

		if (rootArgIdx == -1 || rootArgIdx >= args.length) {
			System.err.println("Usage: LitComp ROOT_DIR");
			return;
		}

		if (argMap.get("port") != null) {
			port = new Integer(argMap.get("port").toString());
		}

		root = new File(args[rootArgIdx]);
		LitComp app = new LitComp();
		app.startServer(root, port);
	}

	static class ResourceReader {
		public static String read(String name) throws IOException {
			return IOUtils.toString(ResourceReader.class.getResourceAsStream(name));
		}
	}

	class LitCompServer extends Server {

		JSONObject mimeMap = null;

		private JSONObject getMimeMap() {
			JSONParser parser = new JSONParser();

			if (mimeMap != null) {
				return mimeMap;
			}

			try {
				String mimeJSON = ResourceReader.read("/res/mime.js");
				mimeMap = (JSONObject)parser.parse(mimeJSON);
			} catch (Exception e) {
				System.err.println("Error while reading /res/mime.js: " + e.toString());
			}

			if (mimeMap == null) {
				System.err.println("Error: mimeMap is null; setting to default");
				mimeMap = new JSONObject();
			}

			return mimeMap;
		}

		protected String mimeType(String fileExtension) {

			JSONObject mimeMap = getMimeMap();

			// lookup mime in hash derived from resource
			Object typeObj = mimeMap.get(fileExtension);
			String type;

			if (typeObj == null) {
				System.err.println("Unknown file extension: " + fileExtension);
				//FIXME allow setting of default mimetype in mime resource
				type = "application/octet-stream";
			} else {
				type = typeObj.toString();
			}

			return type;
		}

		protected void wikitextToXhtml(final InputStream is, final OutputStream os) throws IOException {
			// read input stream into string
			Reader wikiFileReader = new InputStreamReader(is, "UTF-8");
			StringBuilder sb = new StringBuilder();
			int c;

			while ((c = wikiFileReader.read()) != -1) {
				sb.append((char)c);
			}

			String inputHTML = sb.toString();

			// parse input with JSOUP
			class Walker {
				private Element lastHeader;

				Walker(Element lastHeader) {
					this.lastHeader = lastHeader;
				}

				public Element walk(Element el) {
					Elements children = el.children();
					String tagName = el.tagName().toLowerCase();

					if (tagName.matches("h[1-6]")) {
						lastHeader = el;
					} else if (tagName.equals("pre")) {
						String className = el.attr("class");
						if (className.equals("source")) {
							if (lastHeader != null) {
								lastHeader.attr("data-runnable", "runnable");
							}
						}
					}

					for (Element child : children) {
						Element newLastHeader = (new Walker(lastHeader)).walk(child);
						if (newLastHeader != null) {
							lastHeader = newLastHeader;
						}
					}

					return lastHeader;
				}
			}

			Document doc = Jsoup.parseBodyFragment(inputHTML);
			(new Walker(null)).walk(doc.body());

			// serialize DOM to XHTML and write to os
			Element body = doc.body();
			String outputHTML = body.html();
			os.write(outputHTML.getBytes("UTF-8"));
		}

		/**
		 * transforms MediaWiki to XHTML
		 *
		 * @deprecated
		 */
		@Deprecated
		protected void mw_wikitextToXhtml(final Reader reader, final OutputStream os) throws IOException {
			IWikiParser parser = new MediaWikiParser();

			IWikiPrinter printer = new IWikiPrinter() {
				public void print(String str) {
					try {
						os.write(str.getBytes());
					} catch (IOException e) {
						System.out.println("Error while writing wikitext XHTML: " + e.toString());
					}
				}

				public void println(String str) {
					try {
						os.write(str.getBytes());
						os.write(0x0a);
					} catch (IOException e) {
						System.out.println("Error while writing wikitext XHTML: " + e.toString());
					}
				}
			};

			IWemListener listener = new PrintListener(printer);

			try {
				parser.parse(reader, listener);
			} catch (WikiParserException e) {
				System.err.println("Error parsing wikitext: " + e);
			}
		}

		public void start(File root, int port) {
			super.start(root, port);
		}
	}

	private void startServer(File root, int port) {
		LitCompServer server = new LitCompServer();
		server.start(root, port);
	}
}
