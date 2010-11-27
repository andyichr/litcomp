# boot script for integration with bootprog (http://andyic.org/bootprog)
bootprog status_update "Updating LitComp..."
ant clean dist

# set up menu
mkdir -p "$MENU/Open Wiki"
cat <<EOF > "$MENU/Open Wiki/run.sh"
bootprog os_open "http://localhost:8070"
EOF

# node
if [ "$BOOTPROG_PREFIX" == "" ]; then
	echo "BOOTPROG_PREFIX must be defined"
	exit 1
fi

bootprog status_update "Updating node.js"

if [ ! -f "$BOOTPROG_PREFIX/bin/node" ]; then
	NODE_URL=$(curl -s "http://nodejs.org/" | grep -Eo "http://[^ \">]+node[^ \">]+.tar.gz" | head -n1)
	NODE_FILE=$(echo "$NODE_URL" | sed -e "s/.*\///")
	curl "$NODE_URL" -o "$NODE_FILE"
	tar xf "$NODE_FILE"
	pushd node*
		./configure \
			--prefix="$BOOTPROG_PREFIX"
		make
		make install
	popd
fi

bootprog status_update "App Running Normally"

if [ -d ~/.litcomp/wiki ]; then
	./bin/litcompd . ~/.litcomp/wiki
else
	./bin/litcompd . ./test/wiki
fi
