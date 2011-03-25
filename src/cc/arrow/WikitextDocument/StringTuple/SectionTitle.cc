#include <iostream>
#include <string>
#include <stdio.h>
#include <tinyxml/tinyxml.h>

#include "SectionTitle.h"

bool print(TiXmlNode* pParent, bool first = true) {
	TiXmlNode* pChild;
	const char* nodeValue;

	if (pParent->Type() == TiXmlNode::TINYXML_TEXT) {
		if (!first) {
			std::cout << " ";
		}

		nodeValue = pParent->Value();

		int len = strlen(nodeValue);

		for (int i = 0; i < len; i++) {
			if (nodeValue[i] == '"') {
				std::cout << "\\";
			}

			std::cout << nodeValue[i];
		}

		first = false;
	}

	for (pChild = pParent->FirstChild(); pChild; pChild = pChild->NextSibling()) {
		first = print(pChild, first);
	}

	return first;
}

bool iterate(TiXmlNode* pParent, bool first = true) {
	TiXmlNode* pChild;

	for (pChild = pParent->FirstChild(); pChild; pChild = pChild->NextSibling()) {
		bool doPrint = false;

		if (pChild->Type() == TiXmlNode::TINYXML_ELEMENT) {
			const char* nodeName = pChild->Value();

			if (nodeName[0] == 'h' || nodeName[0] == 'H') {
				doPrint = true;
			}
		}

		if (doPrint) {
			if (!first) {
				std::cout << ",";
			}

			std::cout << "\"";
			print(pChild);
			std::cout << "\"";
			first = false;
		} else {
			first = iterate(pChild, first);
		}
	}

	return first;
}

int main(void) {
	TiXmlDocument doc("/dev/stdin");
	std::string input_line;

	while (std::cin) {
		getline(std::cin, input_line);
		doc.Parse(input_line.c_str());
	}


	//if (!doc.LoadFile()) {
	//	std::cerr << "XML load failed. Is XML file valid??" << std::endl;
	//	std::cerr << "TiXmlDocument.ErrorDesc(): " << doc.ErrorDesc() << std::endl;
	//	return 1;
	//}

	std::cout << "[";
	iterate(&doc);
	std::cout << "]" << std::endl;
	return 0;
}
