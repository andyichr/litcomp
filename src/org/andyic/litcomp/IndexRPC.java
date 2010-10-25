package org.andyic.litcomp;

import org.andyic.litcomp.index.*;

import java.util.*;

import org.json.simple.*;

public class IndexRPC {
	@SuppressWarnings("unchecked")
	public static void main(String args[]) {

		if (args.length != 1) {
			System.err.println("usage: IndexRPC INDEX_DIR");
			return;
		}

		System.err.println("IndexRPC starting using index: '" + args[0] + "'");
		IndexDataStore dataStore = new IndexDataStore(args[0]);
		final Hashtable rpcDispatchTable = new Hashtable<String, RPCMethod>();
		rpcDispatchTable.put("get", new GetMethod(dataStore));

		(new MessageStream() {
			@SuppressWarnings("unchecked")
			public String onMessage(String message) {
				JSONObject req = (JSONObject)JSONValue.parse(message);
				RPCMethod method = (RPCMethod)rpcDispatchTable.get((String)req.get("method"));

				if (method == null) {
					System.err.println("Encountered unknown method: '" + req.get("method") + "'");
					return "";
				}

				JSONObject res = new JSONObject();
				res.put("id", req.get("id"));
				res.put("result", method.apply((JSONObject)req.get("params")));
				return res.toString();
			}
		}).read(System.in, System.out);
	}

	private interface RPCMethod {
		public JSONObject apply(JSONObject params);
	}

	private static class GetMethod implements RPCMethod {
		private IndexDataStore dataStore;

		public GetMethod(IndexDataStore dataStore) {
			this.dataStore = dataStore;
		}

		@SuppressWarnings("unchecked")
		public JSONObject apply(JSONObject params) {
			JSONObject res = new JSONObject();
			res.put("value", dataStore.get((String)params.get("key")));
			return res;
		}
	}
}
