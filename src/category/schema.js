/** 
 * below is a JSON structure defining the litcomp schema category (as in category theory)
 * - the name of each arrow represents a program in the system; the name must be in $PATH at runtime
 * - objects are named mathematical structures
 */

[ "Category", "Schema",
	[ "Object", "NaturalNumbers" ],
	[ "Object", "Strings" ],
	[ "Object", "NaturalNumberTuples" ],
	[ "Object", "WikitextDocuments" ],
	[ "Object", "ProgramFragments" ],
	[ "Object", "SectionTitles" ],
	[ "Arrow", "ProgramFragment", { "from": "WikitextDocuments", "to": "ProgramFragments" } ],
	[ "Arrow", "Name", { "from": "ProgramFragments", "to": "Strings" } ],
	[ "Arrow", "Lang", { "from": "ProgramFragments", "to": "Strings" } ],
	[ "Arrow", "Index", { "from": "ProgramFragments", "to": "NaturalNumbers" } ],
	[ "Arrow", "Indexes", { "from": "ProgramFragments", "to": "NaturalNumberTuples" } ]
	[ "Arrow", "SectionTitle", { "from": "WikitextDocuments", "to": "SectionTitles" } ]
	[ "Arrow", "Name", { "from": "SectionTitles", "to": "Strings" } ] ];
