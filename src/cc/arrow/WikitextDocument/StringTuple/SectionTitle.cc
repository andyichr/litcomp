#include <iostream>
#include <tinyxml/tinyxml.h>

#include "SectionTitle.h"

int main(void) {
	TiXmlDocument doc("/dev/stdin");
	bool loadOK = doc.LoadFile();

	if (loadOK) {
		std::cout << "loaded XML OK\n";
	}
	else {
		std::cout << "failed loading XML\n";
	}

	std::cout << "Hello World!\n";
	return 0;
}
