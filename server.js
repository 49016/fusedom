#!/usr/bin/env node

/**
 * FuseDOM Server
 * FUSE filesystem driver for web page DOM manipulation
 * 
 * WARNING: This server allows arbitrary HTML injection into connected web pages.
 * Only use with web pages you own and trust. This is a development/demonstration
 * tool and should not be used in production or with sensitive data.
 */

import Fuse from 'fuse-native';
import { WebSocketServer } from 'ws';
import { mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const MOUNT_POINT = process.argv[2] || './mnt';
const WS_PORT = process.argv[3] || 8080;

// In-memory DOM tree structure
let domTree = {};
let wsClient = null;
let pendingOperations = new Map();
let operationId = 0;

// Create mount point if it doesn't exist
if (!existsSync(MOUNT_POINT)) {
  mkdirSync(MOUNT_POINT, { recursive: true });
}

// WebSocket server for communication with web page
const wss = new WebSocketServer({ port: WS_PORT });

wss.on('connection', (ws) => {
  console.log('Web client connected');
  wsClient = ws;

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      
      if (data.type === 'dom_tree') {
        domTree = data.tree;
        console.log('DOM tree updated');
      } else if (data.type === 'operation_result') {
        const pending = pendingOperations.get(data.id);
        if (pending) {
          pending.resolve(data.result);
          pendingOperations.delete(data.id);
        }
      } else if (data.type === 'error') {
        const pending = pendingOperations.get(data.id);
        if (pending) {
          pending.reject(new Error(data.error));
          pendingOperations.delete(data.id);
        }
      }
    } catch (err) {
      console.error('Error handling message:', err);
    }
  });

  ws.on('close', () => {
    console.log('Web client disconnected');
    wsClient = null;
    domTree = {};
  });

  // Request initial DOM tree
  ws.send(JSON.stringify({ type: 'get_dom' }));
});

// Helper function to send operation to client
function sendOperation(operation) {
  return new Promise((resolve, reject) => {
    if (!wsClient) {
      reject(new Error('No web client connected'));
      return;
    }

    const id = operationId++;
    pendingOperations.set(id, { resolve, reject });

    wsClient.send(JSON.stringify({
      type: 'operation',
      id: id,
      operation: operation
    }));

    // Timeout after 5 seconds
    setTimeout(() => {
      if (pendingOperations.has(id)) {
        pendingOperations.delete(id);
        reject(new Error('Operation timeout'));
      }
    }, 5000);
  });
}

// Helper function to traverse DOM tree and find node
function findNode(path) {
  const parts = path.split('/').filter(p => p);
  let current = domTree;

  for (const part of parts) {
    if (!current || !current.children) {
      return null;
    }
    current = current.children.find(c => c.name === part);
  }

  return current;
}

// Helper function to list directory
function listDir(path) {
  const node = path === '/' ? domTree : findNode(path);
  if (!node || !node.children) {
    return [];
  }
  return node.children.map(c => c.name);
}

// FUSE operations
const fuseOps = {
  readdir: function (path, cb) {
    console.log('readdir(%s)', path);
    
    if (!wsClient) {
      return cb(Fuse.ENOENT);
    }

    try {
      const entries = listDir(path);
      cb(0, entries);
    } catch (err) {
      console.error('readdir error:', err);
      cb(Fuse.EIO);
    }
  },

  getattr: function (path, cb) {
    console.log('getattr(%s)', path);
    
    if (!wsClient) {
      return cb(Fuse.ENOENT);
    }

    try {
      if (path === '/') {
        return cb(0, {
          mtime: new Date(),
          atime: new Date(),
          ctime: new Date(),
          size: 0,
          mode: 16877,
          uid: process.getuid ? process.getuid() : 0,
          gid: process.getgid ? process.getgid() : 0
        });
      }

      const node = findNode(path);
      if (!node) {
        return cb(Fuse.ENOENT);
      }

      // Check if it's a directory (has children) or file
      const isDir = node.children && node.children.length >= 0;
      const mode = isDir ? 16877 : 33188;
      const size = node.content ? Buffer.byteLength(node.content) : 0;

      cb(0, {
        mtime: new Date(),
        atime: new Date(),
        ctime: new Date(),
        size: size,
        mode: mode,
        uid: process.getuid ? process.getuid() : 0,
        gid: process.getgid ? process.getgid() : 0
      });
    } catch (err) {
      console.error('getattr error:', err);
      cb(Fuse.EIO);
    }
  },

  open: function (path, flags, cb) {
    console.log('open(%s, %d)', path, flags);
    
    if (!wsClient) {
      return cb(Fuse.ENOENT);
    }

    const node = findNode(path);
    if (!node) {
      return cb(Fuse.ENOENT);
    }

    cb(0, 42); // return a dummy file handle
  },

  read: function (path, fd, buf, len, pos, cb) {
    console.log('read(%s, %d, %d, %d)', path, fd, len, pos);
    
    if (!wsClient) {
      return cb(Fuse.ENOENT);
    }

    try {
      const node = findNode(path);
      if (!node) {
        return cb(Fuse.ENOENT);
      }

      const content = node.content || '';
      const contentBuf = Buffer.from(content);
      
      if (pos >= contentBuf.length) {
        return cb(0);
      }

      const bytesToRead = Math.min(len, contentBuf.length - pos);
      contentBuf.copy(buf, 0, pos, pos + bytesToRead);
      
      cb(bytesToRead);
    } catch (err) {
      console.error('read error:', err);
      cb(Fuse.EIO);
    }
  },

  write: function (path, fd, buf, len, pos, cb) {
    console.log('write(%s, %d, %d, %d)', path, fd, len, pos);
    
    if (!wsClient) {
      return cb(Fuse.ENOENT);
    }

    try {
      const content = buf.toString('utf8', 0, len);
      
      sendOperation({
        type: 'write',
        path: path,
        content: content
      })
        .then(() => {
          // Update local cache
          const node = findNode(path);
          if (node) {
            node.content = content;
          }
          cb(len);
        })
        .catch(err => {
          console.error('write error:', err);
          cb(Fuse.EIO);
        });
    } catch (err) {
      console.error('write error:', err);
      cb(Fuse.EIO);
    }
  },

  truncate: function (path, size, cb) {
    console.log('truncate(%s, %d)', path, size);
    
    if (!wsClient) {
      return cb(Fuse.ENOENT);
    }

    // For simplicity, treat truncate as clearing the file
    if (size === 0) {
      sendOperation({
        type: 'write',
        path: path,
        content: ''
      })
        .then(() => {
          const node = findNode(path);
          if (node) {
            node.content = '';
          }
          cb(0);
        })
        .catch(err => {
          console.error('truncate error:', err);
          cb(Fuse.EIO);
        });
    } else {
      cb(0);
    }
  }
};

// Mount the filesystem
console.log(`Mounting FUSE filesystem at ${MOUNT_POINT}`);
console.log(`WebSocket server listening on port ${WS_PORT}`);
console.log('Waiting for web client to connect...');

const fuse = new Fuse(MOUNT_POINT, fuseOps, { debug: false, mkdir: true });

fuse.mount(function (err) {
  if (err) {
    console.error('Filesystem error:', err);
    process.exit(1);
  }
  console.log('FUSE filesystem mounted successfully!');
  console.log('Open index.html in your browser to connect.');
});

// Graceful shutdown
process.on('SIGINT', function () {
  console.log('\nUnmounting...');
  fuse.unmount(function (err) {
    if (err) {
      console.error('Error unmounting:', err);
      process.exit(1);
    }
    console.log('Unmounted successfully');
    process.exit(0);
  });
});

console.log('FUSE filesystem mounted. Open index.html in your browser to connect.');
