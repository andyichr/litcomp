package org.andyic.litcomp;

import java.io.*;
import java.security.*;

public class StringHash {
	private String srcString;

	public StringHash(String srcString) {
		if (srcString == null) {
			this.srcString = "";
		} else {
			this.srcString = srcString;
		}
	}

	/**
	 * returns SHA-1 hash of string
	 */
	public String hash() throws Exception {

		String hash = "";
		byte[] hashBytes = srcString.getBytes("UTF-8");
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

		return hash;
	}
}
