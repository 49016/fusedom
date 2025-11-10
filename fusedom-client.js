/**
 * FuseDOM Client Library
 * Connects a web page's DOM to a FUSE filesystem via WebSocket
 */

class FuseDOMClient {
  constructor(wsUrl = 'ws://localhost:8080') {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.connected = false;
    this.domObserver = null;
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);

      this.ws.onopen = () => {
        console.log('FuseDOM: Connected to server');
        this.connected = true;
        this.setupMessageHandler();
        resolve();
      };

      this.ws.onerror = (error) => {
        console.error('FuseDOM: WebSocket error', error);
        reject(error);
      };

      this.ws.onclose = () => {
        console.log('FuseDOM: Disconnected from server');
        this.connected = false;
      };
    });
  }

  setupMessageHandler() {
    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        
        if (message.type === 'get_dom') {
          this.sendDOMTree();
        } else if (message.type === 'operation') {
          this.handleOperation(message.id, message.operation);
        }
      } catch (err) {
        console.error('FuseDOM: Error handling message', err);
      }
    };
  }

  /**
   * Build a tree representation of the DOM
   */
  buildDOMTree(element = document.documentElement, pathPrefix = '') {
    const tagName = element.tagName.toLowerCase();
    const index = this.getElementIndex(element);
    const nodeName = `${index}.${tagName}`;
    const currentPath = pathPrefix + '/' + nodeName;

    const node = {
      name: nodeName,
      path: currentPath,
      tagName: tagName,
      element: element,
      children: []
    };

    // Add special property files
    const properties = ['innerHTML', 'innerText', 'textContent', 'value', 'className', 'id'];
    
    for (const prop of properties) {
      if (prop in element) {
        node.children.push({
          name: prop,
          path: currentPath + '/' + prop,
          property: prop,
          element: element,
          content: String(element[prop] || ''),
          children: null
        });
      }
    }

    // Add child elements
    const childElements = Array.from(element.children);
    for (const child of childElements) {
      node.children.push(this.buildDOMTree(child, currentPath));
    }

    return node;
  }

  /**
   * Get the index of an element among its siblings with the same tag name
   */
  getElementIndex(element) {
    if (!element.parentElement) {
      return 0; // root element
    }

    const siblings = Array.from(element.parentElement.children);
    const sameTag = siblings.filter(el => el.tagName === element.tagName);
    return sameTag.indexOf(element);
  }

  /**
   * Send the current DOM tree to the server
   */
  sendDOMTree() {
    if (!this.connected) return;

    try {
      const tree = this.buildDOMTree();
      
      // Remove circular references (element references)
      const cleanTree = JSON.parse(JSON.stringify(tree, (key, value) => {
        if (key === 'element') return undefined;
        return value;
      }));

      this.ws.send(JSON.stringify({
        type: 'dom_tree',
        tree: cleanTree
      }));
      
      console.log('FuseDOM: DOM tree sent to server');
    } catch (err) {
      console.error('FuseDOM: Error sending DOM tree', err);
    }
  }

  /**
   * Find an element in the DOM based on the filesystem path
   */
  findElementByPath(path) {
    const parts = path.split('/').filter(p => p);
    let current = document.documentElement;
    let property = null;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      
      // Check if this is a property access
      const properties = ['innerHTML', 'innerText', 'textContent', 'value', 'className', 'id'];
      if (properties.includes(part)) {
        property = part;
        break;
      }

      // Parse element selector (e.g., "0.body" -> index 0, tag "body")
      const match = part.match(/^(\d+)\.(.+)$/);
      if (!match) {
        return null;
      }

      const [, indexStr, tagName] = match;
      const index = parseInt(indexStr);

      // Find child with matching tag and index
      const children = Array.from(current.children);
      const sameTagChildren = children.filter(el => el.tagName.toLowerCase() === tagName.toLowerCase());
      
      if (index >= sameTagChildren.length) {
        return null;
      }

      current = sameTagChildren[index];
    }

    return { element: current, property: property };
  }

  /**
   * Handle an operation from the server
   */
  handleOperation(operationId, operation) {
    try {
      if (operation.type === 'write') {
        const result = this.findElementByPath(operation.path);
        
        if (!result || !result.element) {
          this.sendOperationError(operationId, 'Element not found');
          return;
        }

        const { element, property } = result;

        if (property) {
          // Writing to a property
          element[property] = operation.content;
          console.log(`FuseDOM: Set ${property} on ${element.tagName}`);
        } else {
          // Writing to the element itself (default to innerHTML)
          element.innerHTML = operation.content;
          console.log(`FuseDOM: Set innerHTML on ${element.tagName}`);
        }

        // Send updated DOM tree
        this.sendDOMTree();
        
        this.sendOperationResult(operationId, { success: true });
      } else {
        this.sendOperationError(operationId, 'Unknown operation type');
      }
    } catch (err) {
      console.error('FuseDOM: Error handling operation', err);
      this.sendOperationError(operationId, err.message);
    }
  }

  sendOperationResult(operationId, result) {
    if (!this.connected) return;
    
    this.ws.send(JSON.stringify({
      type: 'operation_result',
      id: operationId,
      result: result
    }));
  }

  sendOperationError(operationId, error) {
    if (!this.connected) return;
    
    this.ws.send(JSON.stringify({
      type: 'error',
      id: operationId,
      error: error
    }));
  }

  /**
   * Start observing DOM changes and update the server
   */
  startObserving() {
    if (this.domObserver) {
      this.domObserver.disconnect();
    }

    this.domObserver = new MutationObserver(() => {
      // Debounce DOM tree updates - longer delay to avoid spam
      clearTimeout(this.updateTimeout);
      this.updateTimeout = setTimeout(() => {
        this.sendDOMTree();
      }, 2000);
    });

    this.domObserver.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: false,  // Don't observe attribute changes
      characterData: false  // Don't observe text changes
    });
  }

  stopObserving() {
    if (this.domObserver) {
      this.domObserver.disconnect();
      this.domObserver = null;
    }
  }

  disconnect() {
    this.stopObserving();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
  }
}

// Auto-initialize if running in browser
if (typeof window !== 'undefined') {
  window.FuseDOMClient = FuseDOMClient;
  
  // Auto-connect on load
  window.addEventListener('load', () => {
    const client = new FuseDOMClient();
    client.connect()
      .then(() => {
        client.startObserving();
        console.log('FuseDOM: Client initialized and observing DOM');
      })
      .catch(err => {
        console.error('FuseDOM: Failed to connect', err);
      });
    
    // Make client accessible globally
    window.fuseDOMClient = client;
  });
}
