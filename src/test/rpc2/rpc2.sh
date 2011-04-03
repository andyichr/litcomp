#!/usr/bin/env bash

set -e

echo "Testing RPC..."

export PATH="$(find "$SRC_DIR"/* -maxdepth 0 -type d | while read LANG_DIR; do
	test -d "$LANG_DIR"/arrow && {
		echo "$LANG_DIR/arrow:" | tr -d "\n";
	} || true
done)$PATH"

find "$TEST_DIR"/rpc2/* -type d | while read RPC_TEST; do
	echo "Invoking RPC test: $(basename "$RPC_TEST")"
	test -f "$RPC_TEST"/req.js || touch "$RPC_TEST"/req.js
	test -f "$RPC_TEST"/res.js || touch "$RPC_TEST"/res.js
	diff -u "$RPC_TEST"/res.js <("$SRC_DIR"/pl/rpc2.pl < "$RPC_TEST"/req.js 2>&1) && echo "TEST PASS" || echo "TEST FAIL"
done
