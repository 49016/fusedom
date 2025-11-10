#!/bin/bash

# FuseDOM Demo Script
# This script demonstrates the basic functionality of FuseDOM

set -e

MOUNT_POINT="./mnt"

echo "=== FuseDOM Demo ==="
echo ""
echo "This demo shows how to manipulate a web page's DOM using filesystem operations."
echo ""
echo "Prerequisites:"
echo "1. The server should be running: node server.js ./mnt 8080"
echo "2. Open index.html in your browser to connect the web client"
echo ""
echo "Press Enter to continue..."
read

echo ""
echo "--- Step 1: List the DOM structure ---"
echo "$ ls -la $MOUNT_POINT/"
ls -la $MOUNT_POINT/
echo ""
read -p "Press Enter to continue..."

echo ""
echo "--- Step 2: View the current body content ---"
echo "$ cat $MOUNT_POINT/0.html/0.body/innerHTML"
cat $MOUNT_POINT/0.html/0.body/innerHTML 2>/dev/null || echo "(No content yet or path not found)"
echo ""
read -p "Press Enter to continue..."

echo ""
echo "--- Step 3: Write new content to the page ---"
echo "$ echo '<h1>Hello from FUSE!</h1>' > $MOUNT_POINT/0.html/0.body/innerHTML"
echo '<h1>Hello from FUSE!</h1><p>This content was written via the filesystem!</p>' > $MOUNT_POINT/0.html/0.body/innerHTML
echo "Content written! Check your browser to see the changes."
echo ""
read -p "Press Enter to continue..."

echo ""
echo "--- Step 4: Read back the content ---"
echo "$ cat $MOUNT_POINT/0.html/0.body/innerHTML"
cat $MOUNT_POINT/0.html/0.body/innerHTML
echo ""
read -p "Press Enter to continue..."

echo ""
echo "--- Step 5: Modify specific element ---"
echo "You can navigate deeper into the DOM tree to modify specific elements"
echo "For example, if there's a div with an h1, you could:"
echo "$ echo 'New Title' > $MOUNT_POINT/0.html/0.body/0.div/0.h1/innerText"
echo ""

echo "Demo complete! Try your own commands to explore the DOM."
