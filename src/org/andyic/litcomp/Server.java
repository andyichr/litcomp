package org.andyic.litcomp;

import com.sun.net.httpserver.*;
import java.io.*;
import java.net.*;
import java.security.*;
import java.util.*;
import org.json.simple.*;

abstract public class Server {

	private File root;

	abstract protected String mimeType(String fileExtension);
	abstract protected void wikitextToXhtml(final InputStream is, final OutputStream os) throws IOException;

	/**
	 * serve a wiki site rooted at root
	 */
	public void start(File root, int port) {
		if (root == null || !root.exists() || !root.isDirectory() || !root.canWrite()) {
			System.err.println("Root directory is not valid");
			return;
		}

		this.root = root;
		
		try {
			HttpServer server = HttpServer.create(new InetSocketAddress(port), 0);
			server.createContext("/", new RequestHandler());
			server.setExecutor(null);
			server.start();
			System.out.println("Server started at http://127.0.0.1:" + Integer.toString(port));
		} catch (IOException e) {
			System.err.println("Error while starting server: " + e.toString());
		}
	}

	class RequestHandler implements HttpHandler {
		public void handle(HttpExchange t) {
			String requestPath = t.getRequestURI().getPath();
			String resPrefix = "/res/";
			String literalPrefix = "/literal/";
			String jrpcPrefix = "/json-rpc/";

			if (requestPath.equals("/favicon.ico")) {
				requestPath = "/res" + requestPath;
			}

			if (requestPath.equals("/") || requestPath.equals("")) {
				requestPath = "/Index";
			}

			if (requestPath.equals("/literal/") || requestPath.equals("/literal")) {
				requestPath = "/literal/Index";
			}

			System.out.println("Serving request: " + requestPath);

			try {
				// handle wiki pages
				if (requestPath.lastIndexOf("/") == 0) {
					if (t.getRequestMethod().equals("PUT")) {
						handleWikiPutRequest(t, requestPath);
					} else {
						handleWikiRequest(t, requestPath);
					}

				// handle other types of requests
				} else  {

					// resources
					if (requestPath.substring(0,resPrefix.length()).equals(resPrefix)) {
						handleResourceRequest(t, requestPath.substring(resPrefix.length()));
					
					// literal wikitext
					} else if (requestPath.substring(0,literalPrefix.length()).equals(literalPrefix)) {
						handleLiteralWikiRequest(t, requestPath.substring(literalPrefix.length()));

					// JSON-RPC
					} else if (requestPath.substring(0,jrpcPrefix.length()).equals(jrpcPrefix)) {
						handleJsonRpcRequest(t);
					}
				}

			} catch (IOException e) {
				System.err.println("Error while handling request: " + e);
			}
		}

		protected void handleResourceRequest(HttpExchange t, String resourcePath) {
			InputStream in = RequestHandler.class.getResourceAsStream("/res/www/" + resourcePath);
			int extIdx = resourcePath.lastIndexOf(".");

			if (in != null) {
				try {

					if (extIdx != -1 && extIdx < resourcePath.length()) {
						t.getResponseHeaders().add("Content-type", mimeType(resourcePath.substring(extIdx+1)));
					}

					t.sendResponseHeaders(200, 0);
					OutputStream os = t.getResponseBody();
					int c;

					while ((c = in.read()) != -1) {
						os.write(c);
					}

					in.close();
					os.close();
				} catch (IOException e) {
					System.err.println("Error writing response: " + e.toString());
				}
			} else {
					try {
						t.sendResponseHeaders(404, -1);
					} catch (IOException e) {
						System.err.println("Error writing response headers: " + e.toString());
					}

					System.err.println("Resource not found: " + resourcePath);
			}
		}

		protected String getPageHandle(String path) {
			String pageHandle = path;
			pageHandle = pageHandle.replace("/", "");
			pageHandle = pageHandle.replace(" ", "_");

			if (pageHandle.length() == 0) {
				pageHandle = "Index";
			}

			return pageHandle;
		}

		protected File getWikiFile(String pageHandle) throws IOException {
			File wikiFile = new File(root.getCanonicalPath() + File.separator + pageHandle + ".wiki");
			return wikiFile;
		}

		/**
		 * handle JSON-RPC requests
		 *
		 * @see http://json-rpc.org
		 */
		@SuppressWarnings("unchecked")
		protected void handleJsonRpcRequest(HttpExchange t) throws IOException {
			// define map (method -> (request JSON -> result JSON))
			Hashtable<String, JRPCHandler> reqMap = new Hashtable<String, JRPCHandler>();
			registerJRPCHandlers(reqMap);

			StringWriter s = new StringWriter();
			InputStream is = t.getRequestBody();

			int c;

			while ((c = is.read()) != -1) {
				s.write(c);
			}

			JSONObject request = (JSONObject)JSONValue.parse(s.toString());
			s = null;
			JRPCHandler reqHandler = reqMap.get(request.get("method"));

			if (request == null || reqHandler == null || request.get("id") == null) {
				System.err.println("Received invalid JSON-RPC request");
				t.sendResponseHeaders(400, -1);
				return;
			}

			// apply request -> result transform and write result to HttpExchange
			JSONObject response = reqHandler.handle(request);
			response.put("id", request.get("id"));
			t.sendResponseHeaders(200, 0);
			OutputStream os = t.getResponseBody();
			os.write(response.toString().getBytes());
			os.close();
		}

		protected abstract class JRPCHandler {
			abstract public JSONObject handle(JSONObject request);
		}

		protected class SetSourceHandler extends JRPCHandler {
			public JSONObject handle(JSONObject request) {
				// input: page hash, source block #
				//TODO check wikitext hash against input hash
				// read wikitext, mirroring content
				// pre tags are ONLY used for macros (class=wikimodel-macro) or verbatim block. match !(class=wikimodel-macro)
				// onVerbatimBlock, start counting. if at right number, then splice
				// backtrack to <sourcePARAMS in mirrored output
				// output <sourcePARAMS>STR</source>
				// continue on
				//TODO write new wikitext to file
				//TODO return successful response
				JSONObject response = new JSONObject();
				return response;
			}
		}

		/**
		 * allow clients to send a "ping" to check RPC functionality
		 */
		@SuppressWarnings("unchecked")
		protected class PingHandler extends JRPCHandler {
			public JSONObject handle(JSONObject request) {
				JSONObject response = new JSONObject();
				response.put("result", "pong");
				return response;
			}
		}

		protected void registerJRPCHandlers(Hashtable<String, JRPCHandler> map) {
			map.put("ping", new PingHandler());
			map.put("setSource", new PingHandler());
		}

		protected void handleWikiPutRequest(HttpExchange t, String requestPath) throws IOException {
			//FIXME refactor following redundant code
			String pageHandle = getPageHandle(requestPath);

			// read from input stream, write to file stream
			try {
				InputStream is = t.getRequestBody();
				OutputStream os = new FileOutputStream(getWikiFile(pageHandle));
				int b;

				while ((b = is.read()) != -1) {
					os.write(b);
				}

				os.close();
			} catch (Exception e) {
				System.err.println("Error writing wikitext: " + e.toString());
			}

			t.sendResponseHeaders(200, -1);
		}

		@SuppressWarnings("unchecked")
		protected void handleWikiRequest(HttpExchange t, String requestPath) throws IOException {
			
			String pageHandle = getPageHandle(requestPath);
			System.out.println("Request wiki page: " + pageHandle);
			OutputStream os = t.getResponseBody();

			// read file
			t.getResponseHeaders().add("Content-type", "text/html; charset=utf-8");
			t.sendResponseHeaders(200, 0);

			InputStream headerIn = RequestHandler.class.getResourceAsStream("/res/header.html");
			InputStream footerIn = RequestHandler.class.getResourceAsStream("/res/footer.html");

			// header
			if (headerIn != null && footerIn != null) {
				int c = 0;

				while ((c = headerIn.read()) != -1) {
					os.write(c);
				}

				headerIn.close();
			}

			File wikiFile = getWikiFile(pageHandle);

			// init meta
			JSONObject meta = new JSONObject();
			String title = pageHandle.replace("_", " ");
			// default to hash of empty string in order to handle new page case
			String hash = "da39a3ee5e6b4b0d3255bfef95601890afd80709";

			if (wikiFile.exists() && wikiFile.canRead()) {

				// wiki xhtml
				InputStream is = new FileInputStream(wikiFile);
				wikitextToXhtml(is, os);
				is.close();

				try {
					//FIXME do not reread from disk!
					InputStream wikiIs = new FileInputStream(wikiFile);
					byte b;

					MessageDigest digest = MessageDigest.getInstance("SHA-1");

					while ((b = (byte)wikiIs.read()) != -1) {
						digest.update(b);
					}

					byte[] digestBytes = digest.digest();

					for (int i = 0; i < digestBytes.length; i++) {
						String hex = Integer.toHexString(0xFF & digestBytes[i]);

						if (hex.length() == 1) {
								hash += hash + "0";
						}

						hash += hex;
					}
				} catch (NoSuchAlgorithmException e) {
					System.out.println("Error while calculating page hash: " + e.toString());
				}
			}

			meta.put("title", title);
			meta.put("hash", new String(hash));
			os.write("<script>".getBytes("UTF-8"));
			os.write("var pageMeta = ".getBytes("UTF-8"));
			os.write(meta.toString().getBytes("UTF-8"));
			os.write(";".getBytes("UTF-8"));
			os.write("</script>".getBytes("UTF-8"));

			// footer
			if (headerIn != null && footerIn != null)
			{
				int c;

				while ((c = footerIn.read()) != -1) {
					os.write(c);
				}

				footerIn.close();
			}

			os.close();
		}

		protected void handleLiteralWikiRequest(HttpExchange t, String requestPath) throws IOException {
			String pageHandle = getPageHandle(requestPath);
			t.getResponseHeaders().add("Content-type", "text/plain; charset=utf-8");
			File wikiFile = new File(root.getCanonicalPath() + File.separator + pageHandle + ".wiki");

			if (wikiFile.exists() && wikiFile.canRead()) {
				t.sendResponseHeaders(200, 0);
				OutputStream os = t.getResponseBody();
				InputStream wikiFileReader = new FileInputStream(wikiFile);
				int b = 0;

				while ((b = wikiFileReader.read()) != -1) {
					os.write(b);
				}

				wikiFileReader.close();
				os.close();
			} else {
				t.sendResponseHeaders(200, -1);
			}
		}

	}
}
