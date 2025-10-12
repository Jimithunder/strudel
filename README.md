## Running Locally

After cloning the project, you can run the REPL locally:

1. Install [Node.js](https://nodejs.org/)
2. Install [pnpm](https://pnpm.io/installation)
3. Install dependencies by running the following command:
   ```bash
   pnpm i
   ```
4. Run the development server:
   ```bash
   pnpm dev
   ```

## Real-time Collaboration

Strudel supports real-time collaborative editing using Yjs and WebSockets, allowing multiple users to edit the same code simultaneously.

### Starting the Collaboration Server

To enable collaboration, you need to run the collaboration server:

```bash
pnpm collab
```

The server will start on port 1234 by default. You can customize the port and enable debug mode:

```bash
cd packages/collab && npm run server -- --port 1234 --debug
```

### Using Collaboration

1. Start the collaboration server (see above)
2. Open the Strudel REPL in your browser
3. Click the "Collaborate" button in the header
4. Share the generated URL with others
5. All participants can now edit the code together in real-time!

### Features

- **Real-time synchronization**: Changes are instantly synced between all connected users
- **Conflict-free editing**: Uses CRDTs (Conflict-free Replicated Data Types) via Yjs
- **Cursor sharing**: See where other users are typing
- **Room-based sessions**: Each collaboration session has a unique room ID
- **No account required**: Just share the URL and start collaborating
- **Generative AI**: You can generate code snippets using your gen ai api key

## Using Strudel In Your Project

This project is organized into many [packages](./packages), which are also available on [npm](https://www.npmjs.com/search?q=%40strudel).

Read more about how to use these in your own project [here](https://strudel.cc/technical-manual/project-start).

You will need to abide by the terms of the [GNU Affero Public Licence v3](LICENSE). As such, Strudel code can only be shared within free/open source projects under the same license -- see the license for details.

Licensing info for the default sound banks can be found over on the [dough-samples](https://github.com/felixroos/dough-samples/blob/main/README.md) repository.


## Community

There is a #strudel channel on the TidalCycles discord: <https://discord.com/invite/HGEdXmRkzT>

You can also ask questions and find related discussions on the tidal club forum: <https://club.tidalcycles.org/>

The discord and forum is shared with the haskell (tidal) and python (vortex) siblings of this project.

We also have a mastodon account: <a rel="me" href="https://social.toplap.org/@strudel">social.toplap.org/@strudel</a>
