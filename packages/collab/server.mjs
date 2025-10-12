#!/usr/bin/env node

/*
server.mjs - WebSocket collaboration server for Strudel
Copyright (C) 2022 Strudel contributors - see <https://codeberg.org/uzu/strudel>
This program is free software: you can redistribute it and/or modify it under the terms of the GNU Affero General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU Affero General Public License for more details. You should have received a copy of the GNU Affero General Public License along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { WebSocketServer } from 'ws';
import * as Y from 'yjs';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import * as syncProtocol from 'y-protocols/sync';
import * as awarenessProtocol from 'y-protocols/awareness';

const args = process.argv.slice(2);
function getArgValue(flag, defaultValue) {
  const i = args.indexOf(flag);
  if (i !== -1) {
    const nextIsFlag = args[i + 1]?.startsWith('--') ?? true;
    if (nextIsFlag) return true;
    return args[i + 1];
  }
  return defaultValue;
}

const port = Number(getArgValue('--port', 1234));
const debug = getArgValue('--debug', false);

// Store active rooms with their Y.Doc instances
const docs = new Map();

// Message types
const messageSync = 0;
const messageAwareness = 1;

/**
 * Get or create a Y.Doc for a room
 */
const getYDoc = (roomName, gc = true) => {
  if (!docs.has(roomName)) {
    const doc = new Y.Doc();
    doc.gc = gc;
    docs.set(roomName, doc);
    if (debug) {
      console.log(`[${new Date().toISOString()}] Created new document for room: ${roomName}`);
    }
  }
  return docs.get(roomName);
};

/**
 * Send message to WebSocket client
 */
const send = (conn, message) => {
  if (conn.readyState !== 1) {
    return;
  }
  conn.send(message, (err) => {
    if (err) {
      conn.close();
    }
  });
};

/**
 * Setup WebSocket connection for Yjs synchronization
 */
const setupWSConnection = (conn, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const roomName = url.searchParams.get('room') || 'default';
  
  conn.binaryType = 'arraybuffer';
  
  // Get the shared document
  const doc = getYDoc(roomName);
  
  // Track this connection
  if (!conn.rooms) {
    conn.rooms = new Set();
  }
  conn.rooms.add(roomName);
  
  if (debug) {
    console.log(`[${new Date().toISOString()}] Client connected to room: ${roomName}`);
  }

  // Create awareness for this connection
  const awareness = new awarenessProtocol.Awareness(doc);
  
  // Listen for awareness changes and broadcast
  const awarenessChangeHandler = ({ added, updated, removed }, conn) => {
    const changedClients = added.concat(updated, removed);
    if (conn !== null) {
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, messageAwareness);
      encoding.writeVarUint8Array(
        encoder,
        awarenessProtocol.encodeAwarenessUpdate(awareness, changedClients)
      );
      send(conn, encoding.toUint8Array(encoder));
    }
  };
  
  awareness.on('update', awarenessChangeHandler);

  // Handle incoming messages
  conn.on('message', (message) => {
    try {
      const uint8Array = new Uint8Array(message);
      const decoder = decoding.createDecoder(uint8Array);
      const messageType = decoding.readVarUint(decoder);

      switch (messageType) {
        case messageSync: {
          const encoder = encoding.createEncoder();
          encoding.writeVarUint(encoder, messageSync);
          syncProtocol.readSyncMessage(decoder, encoder, doc, conn);
          if (encoding.length(encoder) > 1) {
            send(conn, encoding.toUint8Array(encoder));
          }
          break;
        }
        case messageAwareness:
          awarenessProtocol.applyAwarenessUpdate(
            awareness,
            decoding.readVarUint8Array(decoder),
            conn
          );
          break;
      }
    } catch (err) {
      if (debug) {
        console.error(`[${new Date().toISOString()}] Error processing message:`, err);
      }
    }
  });

  // Send sync step 1
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, messageSync);
  syncProtocol.writeSyncStep1(encoder, doc);
  send(conn, encoding.toUint8Array(encoder));
  
  // Broadcast awareness state
  const awarenessStates = awareness.getStates();
  if (awarenessStates.size > 0) {
    const awarenessEncoder = encoding.createEncoder();
    encoding.writeVarUint(awarenessEncoder, messageAwareness);
    encoding.writeVarUint8Array(
      awarenessEncoder,
      awarenessProtocol.encodeAwarenessUpdate(awareness, Array.from(awarenessStates.keys()))
    );
    send(conn, encoding.toUint8Array(awarenessEncoder));
  }

  // Listen for document updates
  const updateHandler = (update, origin) => {
    if (origin !== conn) {
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, messageSync);
      syncProtocol.writeUpdate(encoder, update);
      send(conn, encoding.toUint8Array(encoder));
    }
  };
  
  doc.on('update', updateHandler);

  // Handle connection close
  conn.on('close', () => {
    doc.off('update', updateHandler);
    awareness.off('update', awarenessChangeHandler);
    
    if (conn.rooms) {
      conn.rooms.forEach((roomName) => {
        if (debug) {
          console.log(`[${new Date().toISOString()}] Client disconnected from room: ${roomName}`);
        }
        
        // Check if room is empty
        const doc = docs.get(roomName);
        if (doc) {
          // Clean up empty rooms after a delay
          setTimeout(() => {
            if (doc.conns && doc.conns.size === 0) {
              docs.delete(roomName);
              if (debug) {
                console.log(`[${new Date().toISOString()}] Room ${roomName} is now empty`);
              }
            }
          }, 30000); // 30 seconds delay
        }
      });
    }
  });

  conn.on('error', (error) => {
    if (debug) {
      console.error(`[${new Date().toISOString()}] WebSocket error in room ${roomName}:`, error);
    }
  });
};

const wss = new WebSocketServer({ 
  port,
  perMessageDeflate: {
    zlibDeflateOptions: {
      chunkSize: 1024,
      memLevel: 7,
      level: 3
    },
    zlibInflateOptions: {
      chunkSize: 10 * 1024
    },
    clientNoContextTakeover: true,
    serverNoContextTakeover: true,
    serverMaxWindowBits: 10,
    concurrencyLimit: 10,
    threshold: 1024
  }
});

wss.on('connection', setupWSConnection);

wss.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`------ ERROR -------
A server is already running on port ${port}!
To stop it:
1. Run "lsof -ti :${port} | xargs kill -9" (macOS / Linux)
2. Re-run the collaboration server
`);
  } else {
    console.error('WebSocket server error:', error);
  }
});

console.log(`
╔═══════════════════════════════════════════════════════════╗
║  Strudel Collaboration Server                             ║
╚═══════════════════════════════════════════════════════════╝

WebSocket server running on port ${port}
${debug ? 'Debug mode: ENABLED' : ''}

Waiting for connections...
`);

// Periodic stats
if (debug) {
  setInterval(() => {
    console.log(`[${new Date().toISOString()}] Active rooms: ${docs.size}`);
    docs.forEach((doc, roomName) => {
      const connCount = wss.clients.size;
      console.log(`  - ${roomName}: ${connCount} client(s)`);
    });
  }, 30000); // Every 30 seconds
}

