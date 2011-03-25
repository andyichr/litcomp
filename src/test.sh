#!/usr/bin/env bash

# execute test suite
echo "Running test suite..."

# execute all scripts in src/test
TEST_DIR="$(pwd)/src/test"
cd "$TEST_DIR" && find . -name "*.sh" | while read FILE; do
	echo "Invoking $FILE..."
	cd "$TEST_DIR"
	PATH="$(pwd)/$(dirname ../"$FILE"):$PATH" \
			&& cd $(dirname "$FILE") \
			&& . "$(basename "$FILE")"
done
