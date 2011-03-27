StringTuple:
	cd src/cc/arrow/WikitextDocument/StringTuple && make

docs:
	./src/sh/makedocs.sh

all: StringTuple

test: all FORCE
	./src/test.sh

clean:
	find . -name "*.o" | xargs -r rm

.PHONY: docs test

FORCE:
