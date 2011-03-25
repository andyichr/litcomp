#!/usr/bin/env bash

set -e

# execute test suite
echo "Running test suite..."

# execute all scripts in src/test
export SRC_DIR="$(pwd)"/src
export WIKI_DIR="$(pwd)"/test/wiki
export TEST_DIR="$SRC_DIR"/test

cd "$TEST_DIR" && find . -name "*.sh" | while read FILE; do
	echo "Invoking $FILE..."
	cd "$TEST_DIR"
	PATH="$(pwd)/$(dirname ../"$FILE"):$PATH" \
			&& cd $(dirname "$FILE") \
			&& . "$(basename "$FILE")"
done
