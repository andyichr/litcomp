#!/usr/bin/env bash

set -e
set -x

export SRCDIR="$(pwd)"

test -d .build || mkdir .build
test -d docs || mkdir docs

# build directory structure figure
exec 6>&1
exec > >(dot -Tps > .build/src.ps)
echo "strict graph src {"
dir_walk()
{
find "$1" -mindepth 1 -maxdepth 1 -type d | while read FILE; do
	echo "\"$FILE\" [label=\"$(echo "$FILE" | sed -e 's,.*/,,')\"]"
	echo "\"$1\" -- \"$FILE\""
	dir_walk "$FILE"
done
}

dir_walk src
echo "}"
exec 1>&6 6>&-

cd .build

# build manual dvi
latex "$SRCDIR"/src/tex/manual.tex
latex "$SRCDIR"/src/tex/manual.tex
dvipdf manual.dvi
cp manual.pdf "$SRCDIR"/docs/
