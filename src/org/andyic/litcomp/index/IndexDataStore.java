package org.andyic.litcomp.index;

import java.io.*;

public class IndexDataStore {
	private String indexDir;

	public IndexDataStore(String indexDir) {
		this.indexDir = indexDir;
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
