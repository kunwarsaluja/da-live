# Document Authoring

Document Authoring is a research project.

## Developing locally
### Run
1. Clone this repo to your computer.
1. Install the [AEM CLI](https://github.com/adobe/helix-cli): `sudo npm install -g @adobe/aem-cli`
1. In a terminal, run `aem up` this repo's folder.
1. Start building.

### Run (advanced)
Like most AEM Edge Delivery projects, `da-live` uses production service integrations by default. You work against the projects you have access to and there's less likely something breaks if you're working against production services already.

There are times when you need to develop a feature across the different services of DA. In these scenarios, you need local or stage variations of these services. With the right credentials, you can do so with the following flags:

#### DA Admin
1. Run `da-admin` locally. Details [here](https://github.com/adobe/da-admin).
1. Start the local AEM CLI (see above)
1. Visit `https://localhost:3000/?da-admin=local`

#### DA Collab
1. Run `da-collab` locally. Details [here](https://github.com/adobe/da-collab).
2. Start the local AEM CLI (see above)
3. Visit `https://localhost:3000/?da-collab=local`

#### Notes
1. You can mix and match these services. You can use local da-collab with stage da-admin, etc.
2. Each service will set a localStorage value and will not clear until you use `?name-of-service=reset`.

## Additional details
### Recommendations
1. We recommend running `npm install` for linting.

### Dependencies
DA has several libraries / dependencies that are built adhoc.

```shell
# Build Lit
npm run build:da-lit

# Build Prose / YDoc
npm run build:da-y-wrapper
```

Additional details can be [found here](https://github.com/adobe/da-live/wiki/Dependencies).

# ProseMirror-YDoc Metadata Sync

This solution allows you to sync global metadata/attributes between ProseMirror and YDoc for collaborative editing. It provides a bidirectional sync layer that ensures metadata consistency across all clients.

## How It Works

1. Creates a dedicated YMap in the YDoc to store document metadata
2. Provides a ProseMirror plugin that syncs changes between the YMap and the ProseMirror state
3. Includes a metadata manager utility for easy get/set operations

## Implementation Steps

1. Create the metadata-sync-plugin.js file (code provided in this repo)
2. Add the plugin to your ProseMirror editor setup

## Integration Example

This example shows how to integrate the metadata sync with your existing codebase:

```javascript
// In your editor initialization file
import { createMetadataPlugin, MetadataManager } from './metadata-sync-plugin.js';

export default function initProse({ path, permissions }) {
  // Your existing setup code...
  const editor = document.createElement('div');
  const schema = getSchema();
  const ydoc = new Y.Doc();

  // Get your xml fragment as you already do
  const yXmlFragment = ydoc.getXmlFragment('prosemirror');

  // Create the metadata plugin
  const metadataPlugin = createMetadataPlugin(ydoc, 'documentMetadata');

  // Add it to your plugins array
  const plugins = [
    ySyncPlugin(yXmlFragment),
    yCursorPlugin(wsProvider.awareness),
    yUndoPlugin(),
    // ... your other plugins
    metadataPlugin, // Add the metadata plugin
  ];

  // Create your state and view as usual
  let state = EditorState.create({ schema, plugins });
  window.view = new EditorView(editor, {
    state,
    // ... your other config
  });

  // Now you can use the MetadataManager to work with metadata

  // Set metadata
  MetadataManager.set(state, window.view.dispatch, 'documentId', 'doc-123');

  // Read metadata
  const metadata = MetadataManager.getAll(state);
  console.log('Document metadata:', metadata);

  return editor;
}
```

## Using Nested Metadata

You can use dot notation to access nested metadata:

```javascript
// Set nested metadata
MetadataManager.set(state, dispatch, 'customData.author', 'John Doe');
MetadataManager.set(state, dispatch, 'customData.status', 'draft');

// Get nested metadata
const author = MetadataManager.get(state, 'customData.author');
```

## Updating Multiple Fields

You can update multiple metadata fields at once:

```javascript
MetadataManager.update(state, dispatch, {
  lastModified: new Date().toISOString(),
  version: 2,
  'customData.status': 'published'
});
```

## Benefits

- Metadata changes sync automatically to all connected clients
- Changes persist with the YDoc, providing consistent state
- No need to modify ProseMirror schema or document structure
- Clean API for getting/setting metadata values


