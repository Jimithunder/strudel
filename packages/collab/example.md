# Testing Collaboration Feature

## Prerequisites

1. Make sure all dependencies are installed:
   ```bash
   pnpm install
   ```

## Running the Test

### Step 1: Start the Collaboration Server

In one terminal window:
```bash
pnpm collab
```

You should see:
```
╔═══════════════════════════════════════════════════════════╗
║  Strudel Collaboration Server                             ║
╚═══════════════════════════════════════════════════════════╝

WebSocket server running on port 1234

Waiting for connections...
```

### Step 2: Start the Strudel REPL

In another terminal window:
```bash
pnpm dev
```

### Step 3: Test Collaboration

1. Open http://localhost:4321 in your browser (or whatever port the dev server uses)
2. Click the "Collaborate" button in the header
3. A modal will appear with a shareable URL
4. Copy the URL
5. Open the URL in a new browser tab/window or share it with someone else
6. Start editing the code in one window - you should see the changes appear in the other window in real-time!

### Expected Behavior

- ✅ Both editors show the same code
- ✅ Changes in one editor appear in the other instantly
- ✅ Cursor positions are visible (colored markers)
- ✅ The "Connected users" count shows 2 (or more)
- ✅ Room ID is displayed in both windows

### Debugging

If collaboration doesn't work:

1. **Check the collaboration server is running**
   - Look for the server startup message
   - Check port 1234 is not already in use

2. **Check the browser console**
   - Look for WebSocket connection errors
   - Look for Yjs synchronization errors

3. **Enable debug mode**
   ```bash
   cd packages/collab && npm run server -- --debug
   ```
   This will show all messages being exchanged

4. **Check network tab**
   - Should see a WebSocket connection to `ws://localhost:1234`
   - Should see messages being sent/received

## Architecture

```
┌─────────────────┐         WebSocket         ┌─────────────────┐
│   Browser 1     │◄──────────────────────────►│   Browser 2     │
│  (Yjs Client)   │                            │  (Yjs Client)   │
└────────┬────────┘                            └────────┬────────┘
         │                                              │
         │            WebSocket (ws://localhost:1234)   │
         │                                              │
         └──────────────►┌──────────────┐◄─────────────┘
                         │   Collab     │
                         │   Server     │
                         │  (Yjs sync)  │
                         └──────────────┘
```

The server acts as a relay for Yjs synchronization messages. Each browser maintains a local Yjs document that stays in sync through the WebSocket connection.

