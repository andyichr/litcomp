#include <iostream>
#include <string>
#include <stdio.h>
#include <tinyxml/tinyxml.h>

int sectionIndex = 0;
int sourceIndex = 0;
std::string lastSectionTitle;

void printJSONString(const char *string) {
	if (!string) {
		std::cout << "\"\"";
		return;
	}

	std::cout << "\"";

	for (int i = 0; string[i]; i++) {
		if (string[i] == '\n') {
			std::cout << "\\n";
			continue;
		}

		if (string[i] == '"' || string[i] == '\\') {
			std::cout << "\\";
		}

		std::cout << string[i];
	}

	std::cout << "\"";
}

bool validChar(char c) {
	return ((c >= 65 && c <= 90)
			|| (c >= 97 && c <= 122)
			|| (c >= 48 && c <=57)
			|| (c == '.')
			|| (c == '-'));
}

bool rawText(TiXmlNode* pParent, std::string *pResult, bool first = true) {
	TiXmlNode* pChild;
	const char* nodeValue;

	if (!pResult) {
		std::cerr << "pResult argument must not be null" << std::endl;
	}

	if (first) {
		(*pResult) = "";
	}

	if (pParent->Type() == TiXmlNode::TINYXML_TEXT) {
		if (!first) {
			(*pResult) += " ";
		}

		nodeValue = pParent->Value();

		int len = strlen(nodeValue);

		for (int i = 0; i < len; i++) {
			(*pResult) += nodeValue[i];
		}

		first = false;
	}

	for (pChild = pParent->FirstChild(); pChild; pChild = pChild->NextSibling()) {
		first = rawText(pChild, pResult, first);
	}

	return first;
}

bool text(TiXmlNode* pParent, std::string *pResult, bool first = true) {
	TiXmlNode* pChild;
	const char* nodeValue;

	if (!pResult) {
		std::cerr << "pResult argument must not be null" << std::endl;
	}

	if (first) {
		(*pResult) = "";
	}

	if (pParent->Type() == TiXmlNode::TINYXML_TEXT) {
		if (!first) {
			(*pResult) += "_";
		}

		nodeValue = pParent->Value();

		int len = strlen(nodeValue);

		for (int i = 0; i < len; i++) {
			if (validChar(nodeValue[i])) {
				(*pResult) += nodeValue[i];
			} else {
				(*pResult) += "_";
			}
		}

		first = false;
	}

	for (pChild = pParent->FirstChild(); pChild; pChild = pChild->NextSibling()) {
		first = text(pChild, pResult, first);
	}

	return first;
}

bool iterate(TiXmlNode* pParent, bool first = true) {
	TiXmlNode* pChild;

	for (pChild = pParent->FirstChild(); pChild; pChild = pChild->NextSibling()) {
		bool noRecurse = false;

		if (pChild->Type() == TiXmlNode::TINYXML_ELEMENT) {
			const char* nodeName = pChild->Value();

			if ((nodeName[0] == 'h' || nodeName[0] == 'H') && nodeName[1] >= 49 && nodeName[1] <= 57) {
				sectionIndex++;
				noRecurse = true;
			} else if (strcasecmp(nodeName, "pre") == 0) {
				std::string source;
				const char *className, *langName;
				className = ((TiXmlElement *)pChild)->Attribute("class");
				langName = ((TiXmlElement *)pChild)->Attribute("data-lang");

				if (langName && className && strcasecmp(className, "source") == 0) {
					if (!first) {
						std::cout << ", ";
					}

					first = false;
					sourceIndex++;
					std::cout << "{\"section_index\": " << (sectionIndex - 1);
					std::cout << ", \"pre_index\": " << sourceIndex;
					std::cout << ", \"lang\": ";
					printJSONString(langName);
					std::cout << ", \"source\": ";
					rawText(pChild, &source);
					printJSONString(source.c_str());
					std::cout << "}";
				}

				noRecurse = true;
			}
		}

		if (noRecurse) {
			text(pChild, &lastSectionTitle);
		} else {
			first = iterate(pChild, first);
		}
	}

	return first;
}

int main(void) {
	TiXmlDocument doc("/dev/stdin");
	std::string input, input_line;

	while (std::cin) {
		getline(std::cin, input_line);
		input += input_line + "\n";
	}
	doc.Parse(input.c_str());

	std::cout << "[";
	iterate(&doc);
	std::cout << "]" << std::endl;
	return 0;
}
