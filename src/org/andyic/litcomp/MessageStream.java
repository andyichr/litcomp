package org.andyic.litcomp;

import java.io.*;
import java.nio.*;
import java.util.*;

abstract public class MessageStream {

	abstract public String onMessage(String message);

	@SuppressWarnings("unchecked")
	public void read(InputStream is, OutputStream os) {

		int messageLength;
		String pageTitle;
		int bufLen = 4096;
		byte[] lenBuf = new byte[bufLen];
		int lenBufIdx = 0;

		try {
			int b;

			while (true) {
				lenBufIdx = 0;

				while ((b = is.read()) != 0x0a) {

					if (b == -1) {
						System.err.println("Input ended");
						return;
					}

					lenBuf[lenBufIdx] = (byte)b;
					lenBufIdx++;
				}

				messageLength = Integer.parseInt(new String(lenBuf, 0, lenBufIdx, "UTF-8"));

				byte[] messageBuf = new byte[messageLength];

				for (int i = 0; i < messageLength; i++) {
					b = is.read();

					if (b == -1) {
						System.err.println("Input ended");
						return;
					}

					messageBuf[i] = (byte)b;
				}
				
				String message = new String(messageBuf,0,messageLength,"UTF-8");
				String out = onMessage(message);
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
