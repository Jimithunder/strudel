# @strudel/collab

Real-time collaboration for Strudel using Yjs and WebSockets.

## Features

- Real-time collaborative code editing
- Conflict-free synchronization using CRDTs
- Cursor and selection sharing
- Room-based sessions with shareable URLs

## Usage

### Starting the Server

```bash
npm run server
# or with custom port
npm run server -- --port 1234 --debug
```

### Client-side Integration

```javascript
import { createCollaborationProvider, generateRoomId } from '@strudel/collab';

// Create or join a room
const roomId = generateRoomId(); // or use existing room ID
const { ydoc, ytext, provider, awareness } = createCollaborationProvider(
  roomId,
  'ws://localhost:1234'
);

// Use with CodeMirror via y-codemirror.next
```

## License

AGPL-3.0-or-later

