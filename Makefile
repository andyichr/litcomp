StringTuple:
	cd src/hs/arrow/WikitextDocument/StringTuple && make

all: StringTuple

test: all FORCE
	./src/test.sh

FORCE:
