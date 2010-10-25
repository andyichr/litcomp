package org.andyic.litcomp.index;

import java.io.*;

public class IndexDataStore {
	private String indexDir;

	public IndexDataStore(String indexDir) {
		this.indexDir = indexDir;
	}

	public String get(String key) {
		if (key == null) {
			System.err.println("IndexDataStore: key must not be null");
			return "";
		}

		StringBuilder out = new StringBuilder();
		key.replace("..","");
		byte[] buf = new byte[4096];
		int numRead;

		try {
			FileInputStream is = new FileInputStream(indexDir + "/" + key);

			while ((numRead = is.read(buf)) != -1) {
				out.append(new String(buf, 0, numRead, "UTF-8"));
			}

		} catch (IOException e) {
			System.err.println("Missing index key requested: '" + key + "'");
		}

		return out.toString();
	}

	public void put(String key, String value) {
		System.err.println("Writing index key: '" + key + "'");
		try {
			String dirName = key.substring(0, key.lastIndexOf("/"));
			System.err.println("Index directory: '" + dirName + "'");
			new File(indexDir + "/" + dirName).mkdirs();
			new FileOutputStream(indexDir + "/" + key).write(value.getBytes("UTF-8"));
		} catch (IOException e) {
			System.err.println("Error writing index key '" + key + "': " + e.toString());
		}
	}
}
