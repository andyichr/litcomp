all: ProgramFragment SectionTitle

SEC_TITLE_DIR=src/cc/arrow/WikitextDocument/StringTuple
PROGRAM_FRAGMENT_DIR=src/cc/arrow/WikitextDocument/ProgramFragmentTuple

ProgramFragment.o: $(PROGRAM_FRAGMENT_DIR)/ProgramFragment.cc
	g++ $(CXX_FLAGS) -c $(PROGRAM_FRAGMENT_DIR)/ProgramFragment.cc -o $(PROGRAM_FRAGMENT_DIR)/ProgramFragment.o

ProgramFragment: ProgramFragment.o
	g++ $(CXX_FLAGS) $(TINYXML_LIB) $(PROGRAM_FRAGMENT_DIR)/ProgramFragment.o -o $(PROGRAM_FRAGMENT_DIR)/ProgramFragment -ltinyxml 

SectionTitle.o: $(SEC_TITLE_DIR)/SectionTitle.cc $(SEC_TITLE_DIR)/SectionTitle.h
	g++ $(CXX_FLAGS) -c $(SEC_TITLE_DIR)/SectionTitle.cc -o $(SEC_TITLE_DIR)/SectionTitle.o

SectionTitle: SectionTitle.o
	g++ $(CXX_FLAGS) $(TINYXML_LIB) $(SEC_TITLE_DIR)/SectionTitle.o -o $(SEC_TITLE_DIR)/SectionTitle -ltinyxml 

docs:
	./src/sh/makedocs.sh

test:
	./src/test.sh

clean:
	find . -name "*.o" | xargs -r rm

.PHONY: docs test

FORCE:
