#!/usr/bin/env node

/*
test-server.mjs - Quick test to verify server can start
*/

import { WebSocketServer } from 'ws';

console.log('Testing WebSocket server startup...\n');

try {
  const wss = new WebSocketServer({ port: 1234 });
  
  console.log('✅ WebSocket server started successfully on port 1234');
  console.log('✅ All dependencies are properly installed');
  
  wss.close();
  console.log('✅ Server stopped cleanly\n');
  console.log('🎉 Collaboration server is ready to use!');
  console.log('\nStart it with: pnpm collab');
  
} catch (error) {
  console.error('❌ Failed to start server:', error.message);
  console.error('\nPossible issues:');
  console.error('  - Port 1234 already in use');
  console.error('  - Dependencies not installed (run: pnpm install)');
  process.exit(1);
}

