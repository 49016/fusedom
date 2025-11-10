# FuseDOM

FUSE driver that provides read/write access to the DOM of a loaded web page through filesystem operations.

## Features

- Mount a web page's DOM as a filesystem using FUSE
- Manipulate DOM elements using standard filesystem commands (`echo`, `cat`, etc.)
- Real-time bidirectional synchronization between filesystem and browser
- WebSocket-based communication between backend and web page

## Installation

```bash
npm install
```

## Usage

### 1. Start the FUSE server

```bash
node server.js [mount_point] [websocket_port]
```

Default mount point: `./mnt`  
Default WebSocket port: `8080`

Example:
```bash
node server.js ./mnt 8080
```

### 2. Open the web page

Open `index.html` in your web browser. The page will automatically connect to the WebSocket server.

### 3. Manipulate the DOM via filesystem

The DOM is exposed as a hierarchical filesystem structure. Each element is represented as a directory named `{index}.{tagname}`, where index is the position among siblings with the same tag name.

#### Examples

```bash
# List the DOM structure
ls -la ./mnt/

# View the entire page
ls -la ./mnt/0.html/

# View body contents
ls -la ./mnt/0.html/0.body/

# Read current innerHTML
cat ./mnt/0.html/0.body/innerHTML

# Write new content (this will update the live page!)
echo "<h1>Hello World</h1>" > ./mnt/0.html/0.body/innerHTML

# Modify specific element's text
echo "New Title Text" > ./mnt/0.html/0.body/0.div/0.h1/innerText

# Clear content
echo "" > ./mnt/0.html/0.body/0.div/innerHTML
```

### DOM Structure

Each DOM element is exposed as a directory containing:
- Child elements (as subdirectories): `{index}.{tagname}/`
- Properties (as files): `innerHTML`, `innerText`, `textContent`, `value`, `className`, `id`

Example structure:
```
mnt/
└── 0.html/
    ├── innerHTML
    ├── innerText
    ├── 0.head/
    │   ├── innerHTML
    │   └── ...
    └── 0.body/
        ├── innerHTML
        ├── innerText
        ├── 0.div/
        │   ├── innerHTML
        │   ├── 0.h1/
        │   └── ...
        └── ...
```

## Architecture

- **server.js**: Node.js FUSE driver that mounts the filesystem and communicates with the web page
- **fusedom-client.js**: Browser library that connects to the server and handles DOM operations
- **index.html**: Example web page demonstrating the system

## Requirements

- Node.js (v14 or higher)
- Linux or macOS with FUSE support
- Modern web browser with WebSocket support

## How It Works

1. The Node.js server mounts a FUSE filesystem and starts a WebSocket server
2. The web page connects to the WebSocket server
3. The client sends the DOM tree structure to the server
4. Filesystem operations (read/write) are translated to WebSocket messages
5. The client updates the DOM based on received operations
6. Changes propagate back to the filesystem view

## Limitations

- Read-only access to most properties (write supported for innerHTML, innerText, textContent, value, className, id)
- Element structure (adding/removing elements) must be done via innerHTML
- Requires active browser connection

## Warning

⚠️ **PLEASE DO NOT RUN THIS ON UNTRUSTED WEB PAGES** ⚠️

This tool gives filesystem-level access to manipulate web page content. Only use it with web pages you control and trust.
