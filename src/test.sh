#!/usr/bin/env bash

# execute test suite
echo "Running test suite..."

# execute all scripts in src/test
cd src/test && find . -name "*.sh" | while read FILE; do
	echo "Invoking $FILE..."
	PATH="$(pwd)/$(dirname ../"$FILE"):$PATH" \
			&& cd $(dirname "$FILE") \
			&& . "$(basename "$FILE")"
done
