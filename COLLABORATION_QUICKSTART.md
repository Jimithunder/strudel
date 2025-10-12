# 🤝 Collaboration Quick Start

Get started with real-time collaborative editing in Strudel in 2 minutes!

## Step 1: Install Dependencies

```bash
pnpm install
```

## Step 2: Start the Collaboration Server

Open a terminal and run:

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

## Step 3: Start Strudel

Open another terminal and run:

```bash
pnpm dev
```

## Step 4: Start Collaborating!

1. Open http://localhost:4321 in your browser
2. Click the **"Collaborate"** button in the header (next to "share")
3. A modal will appear with a shareable URL
4. **Copy the URL** and share it with others
5. Open the same URL in another browser tab/window (or share it!)
6. **Start typing** - you'll see changes sync in real-time! ✨

## What You'll See

- 🟢 Green "Collaborating" button when active
- 👥 Number of connected users badge
- 🎨 Colored cursor indicators for other users
- ⚡ Instant synchronization of all edits

## Tips

- **Room URLs**: Each collaboration session has a unique room ID in the URL (e.g., `?room=abc123`)
- **Joining**: Anyone with the room URL can join and edit
- **Stopping**: Click "Stop Collaboration" to leave the room
- **Debugging**: Run the server with `--debug` flag to see all messages:
  ```bash
  cd packages/collab && npm run server -- --debug
  ```

## Example Workflow

### Host (Starting a Session)

```bash
# Terminal 1: Collaboration server
$ pnpm collab
# Server starts...

# Terminal 2: Strudel REPL  
$ pnpm dev
# Open browser, click "Collaborate"
# Share URL: http://localhost:4321/?room=abc123
```

### Guest (Joining a Session)

```bash
# Just open the shared URL!
http://localhost:4321/?room=abc123
# Start editing immediately!
```

## Troubleshooting

### "Could not connect to collaboration server"
- Make sure `pnpm collab` is running
- Check that port 1234 is not in use

### Changes don't sync
- Check browser console for errors
- Verify both users are in the same room (same URL)
- Refresh the page

### Server won't start
```bash
# If port 1234 is in use:
lsof -ti :1234 | xargs kill -9

# Then try again:
pnpm collab
```

## Architecture

```
┌──────────────┐                    ┌──────────────┐
│  Browser 1   │ ◄──────────────► │  Browser 2   │
│              │                    │              │
│ CodeMirror + │                    │ CodeMirror + │
│     Yjs      │                    │     Yjs      │
└──────┬───────┘                    └──────┬───────┘
       │                                   │
       │        WebSocket (ws://localhost:1234)
       │                                   │
       └────────────► ┌──────────┐ ◄──────┘
                      │  Collab  │
                      │  Server  │
                      └──────────┘
```

## What's Synced?

✅ **Code changes** - All edits sync instantly  
✅ **Cursor positions** - See where others are typing  
✅ **Selections** - See what others are selecting  

## What's NOT Synced?

❌ Playback state (playing/stopped)  
❌ Audio output (each person hears their own)  
❌ Settings (theme, font size, etc.)  
❌ Panel visibility/position  

This is by design - collaboration focuses on code editing only!

## Next Steps

- Read the full [COLLABORATION_IMPLEMENTATION.md](./COLLABORATION_IMPLEMENTATION.md) for technical details
- See [packages/collab/example.md](./packages/collab/example.md) for testing guide
- Check [README.md](./README.md) for general Strudel documentation

## Need Help?

If you encounter issues:

1. Run the verification script:
   ```bash
   node packages/collab/verify-setup.mjs
   ```

2. Test the server:
   ```bash
   node packages/collab/test-server.mjs
   ```

3. Check the [Troubleshooting](#troubleshooting) section above

4. Look for errors in:
   - Browser developer console (F12)
   - Terminal running `pnpm collab`
   - Terminal running `pnpm dev`

Happy collaborating! 🎵✨

