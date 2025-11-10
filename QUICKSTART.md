# FuseDOM Quick Start Guide

Get started with FuseDOM in 5 minutes!

## Prerequisites

- Node.js v14 or higher
- Linux or macOS with FUSE support
- Modern web browser

## Installation

```bash
# Clone the repository (or download the files)
cd fusedom

# Install dependencies
npm install
```

## Running the Example

### Step 1: Start the Server

Open a terminal and run:

```bash
node server.js ./mnt 8080
```

You should see:
```
Mounting FUSE filesystem at ./mnt
WebSocket server listening on port 8080
FUSE filesystem mounted successfully!
```

### Step 2: Open the Web Page

Open `index.html` in your web browser. You can:
- Double-click the file, or
- Use a local web server:
  ```bash
  python3 -m http.server 8000
  # Then open http://localhost:8000/index.html
  ```

The page should show "✓ Connected to FUSE server" in green.

### Step 3: Try Filesystem Commands

Open a **new terminal** (keep the server running!) and try:

```bash
# Navigate to the project directory
cd fusedom

# List the DOM structure
ls -la ./mnt/

# You'll see something like:
# drwxr-xr-x 1 user user  0 Nov 10 12:00 0.head
# drwxr-xr-x 1 user user  0 Nov 10 12:00 0.body
# -rw-r--r-- 1 user user 42 Nov 10 12:00 innerHTML
#
# Note: If elements have id attributes, they'll use the id instead of index:
# drwxr-xr-x 1 user user  0 Nov 10 12:00 header.div     # div with id="header"
# drwxr-xr-x 1 user user  0 Nov 10 12:00 content.div    # div with id="content"

# Read the body content
cat ./mnt/0.html/0.body/innerHTML

# Write new content - watch it appear in the browser!
echo "<h1>Hello from FUSE!</h1><p>I modified the DOM using echo!</p>" > ./mnt/0.html/0.body/innerHTML

# If elements have IDs, you can reference them directly:
# echo "Updated content" > ./mnt/0.html/0.body/header.div/innerHTML
```

### Step 4: See the Magic! ✨

Switch back to your browser - the content should have changed instantly!

## What Just Happened?

1. The server mounted a FUSE filesystem at `./mnt/`
2. The web page connected via WebSocket and sent its DOM structure
3. You used `echo` to write HTML to a file in the filesystem
4. The server received the write operation
5. The server sent a command to the web page via WebSocket
6. The web page updated its DOM with the new content

## Next Steps

- Explore the DOM structure: `find ./mnt -type f`
- Try modifying specific elements
- Read the full README.md for more details
- Check SECURITY.md for important security information

## Troubleshooting

### "No such file or directory" when accessing ./mnt/

Make sure:
1. The server is running
2. The web page is open and connected (check for green status)
3. Wait a second after opening the page for the DOM tree to sync

### "fusermount: failed to unmount"

If you need to manually unmount:
```bash
fusermount -u ./mnt
```

### Server won't start

Make sure:
- FUSE is installed on your system
- Port 8080 is not already in use
- You have permission to create the mount point

### WebSocket won't connect

Make sure:
- The server is running on the correct port
- No firewall is blocking port 8080
- You're accessing from localhost

## Learning More

- **README.md**: Full documentation
- **SECURITY.md**: Security considerations
- **demo.sh**: Interactive demo script
- **server.js**: Server implementation
- **fusedom-client.js**: Browser client library

## Have Fun!

FuseDOM is a demonstration of what's possible when you combine FUSE filesystems with web technologies. Experiment, learn, and enjoy! 🚀
