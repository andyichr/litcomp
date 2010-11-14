# boot script for integration with bootprog (http://andyic.org/bootprog)
bootprog status_update "Updating LitComp..."
ant clean dist

# set up menu
mkdir -p "$MENU/Open Wiki"
cat <<EOF > "$MENU/Open Wiki/run.sh"
bootprog os_open "http://localhost:8070"
EOF

bootprog status_update "App Running Normally"
./bin/litcompd . ./test/wiki
