import { expect } from '@esm-bundle/chai';
import { fixture, html, nextFrame } from '@open-wc/testing'; // nextFrame helps wait for updates

import { EditorState } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import * as Y from 'yjs';
import { yUndoPlugin, yUndo, yRedo } from 'da-y-wrapper';

import { getSchema } from '../../../../../../blocks/edit/prose/schema.js';

import {
  createMetadataSyncPlugin,
  daMetadataPluginKey,
  daMetadata,
  setMetadata as setMetadataDirectly,
  getMetadata as getMetadataDirectly,
  getAllMetadata as getAllMetadataDirectly,
} from '../../../../../../blocks/edit/prose/plugins/metadataSync.js';

// --- Test Setup ---

const MAP_NAME = 'da-metadata'; // Match the constant in the source

// Basic schema for testing
const schema = getSchema();

// Helper to create a minimal EditorView instance for testing
// Uses @open-wc/testing's fixture to handle DOM element creation/cleanup
const createTestView = async (ydoc, plugins = []) => {
  const yMetadata = ydoc.getMap(MAP_NAME);
  const state = EditorState.create({
    schema,
    plugins: [createMetadataSyncPlugin(yMetadata, ydoc), ...plugins],
  });

  // Use fixture to create the DOM element and ensure cleanup
  const editorContainer = await fixture(html`<div></div>`);

  let viewInstance; // To hold the view instance

  const view = new EditorView(editorContainer, {
    state,
    dispatchTransaction(tr) {
      const newState = view.state.apply(tr);
      view.updateState(newState);
    },
  });
  viewInstance = view; // Assign the created view

  // Return the view instance and other needed refs
  return { view: viewInstance, state, yMetadata, dom: editorContainer };
};

// --- Tests ---

describe('metadataSync Plugin and API (WTR)', () => {
  let ydoc;
  let view;
  let yMetadata;
  let dom;
  // No explicit destroyView needed, fixture handles DOM cleanup,
  // view.destroy() should be called if view is created outside fixture

  beforeEach(async () => {
    ydoc = new Y.Doc();
    // Setup view using the helper
    const setup = await createTestView(ydoc);
    view = setup.view;
    yMetadata = setup.yMetadata;
    dom = setup.dom;
  });

  afterEach(() => {
    // Destroy the view to unregister listeners etc.
    if (view && !view.isDestroyed) {
      view.destroy();
    }
    if (ydoc) {
      ydoc.destroy();
    }
    // Fixture handles DOM removal
  });

  // --- Initialization Tests ---
  it('should initialize plugin state from existing Y.Map data', async () => {
    // Pre-populate Y.Map before creating view
    const initialYDoc = new Y.Doc();
    const initialYMetadata = initialYDoc.getMap(MAP_NAME);
    initialYMetadata.set('foo', 'bar');
    initialYMetadata.set('baz', 123);

    const { view: testView } = await createTestView(initialYDoc); // fixture handles cleanup
    const pluginState = daMetadataPluginKey.getState(testView.state);

    expect(pluginState.metadata).to.deep.equal({ foo: 'bar', baz: 123 });

    testView.destroy(); // Explicitly destroy view created in test
    initialYDoc.destroy();
  });

  it('should initialize with empty metadata if Y.Map is empty', () => {
    const pluginState = daMetadataPluginKey.getState(view.state);
    expect(pluginState.metadata).to.deep.equal({});
  });

  // --- Sync Tests: PM -> Yjs ---
  it('should sync metadata from PM state to Y.Map via daMetadata.set', async () => {
    expect(yMetadata.get('testKey')).to.be.undefined;

    // Use the API to set metadata
    daMetadata.set(view, 'testKey', 'testValue');
    await nextFrame(); // Allow state update and potential async actions

    // Check Y.Map directly
    expect(yMetadata.get('testKey')).to.equal('testValue');

    // Check PM plugin state (should be updated by the sync mechanism)
    const pluginState = daMetadataPluginKey.getState(view.state);
    expect(pluginState.metadata.testKey).to.equal('testValue');
  });

  it('should not update Y.Map if value is unchanged via daMetadata.set', async () => {
    yMetadata.set('unchanged', 'value');
    let updateCount = 0;
    const observer = () => {
      updateCount += 1;
    };
    yMetadata.observe(observer);

    daMetadata.set(view, 'unchanged', 'value'); // Set the same value
    await nextFrame();

    expect(yMetadata.get('unchanged')).to.equal('value');
    expect(updateCount).to.equal(0); // No transaction should have occurred

    yMetadata.unobserve(observer);
  });

  // --- Sync Tests: Yjs -> PM ---
  it('should sync metadata from Y.Map changes to PM state', async () => {
    // Change Y.Map directly (simulating external change)
    ydoc.transact(() => {
      yMetadata.set('external', 'sync');
    });

    // Allow time for the observer -> dispatch -> state update cycle
    await nextFrame();
    await nextFrame(); // Might need a couple of frames

    const pluginState = daMetadataPluginKey.getState(view.state);
    expect(pluginState.metadata.external).to.equal('sync');
  });

  // --- API Function Tests ---
  it('daMetadata.get should retrieve value from PM state', async () => {
    daMetadata.set(view, 'getKey', 'getValue');
    await nextFrame();
    expect(daMetadata.get(view, 'getKey')).to.equal('getValue');
    expect(daMetadata.get(view, 'nonExistentKey')).to.be.undefined;
  });

  it('daMetadata.getAll should retrieve all metadata from PM state', async () => {
    daMetadata.set(view, 'all1', 'val1');
    daMetadata.set(view, 'all2', 456);
    await nextFrame();
    const allMeta = daMetadata.getAll(view);
    expect(allMeta).to.deep.equal({ all1: 'val1', all2: 456 });
  });

  it('daMetadata.getAll should return a copy, not the original object', async () => {
    daMetadata.set(view, 'copyTest', 'original');
    await nextFrame();
    const allMeta = daMetadata.getAll(view);
    allMeta.copyTest = 'modified'; // Modify the returned object
    await nextFrame();

    const pluginState = daMetadataPluginKey.getState(view.state);
    expect(pluginState.metadata.copyTest).to.equal('original'); // Original state unchanged
    expect(daMetadata.get(view, 'copyTest')).to.equal('original');
  });

  // --- DOM Attribute Tests ---
  it('should set data-meta-* attributes on the editor view DOM', async () => {
    daMetadata.set(view, 'attrKey', 'attrValue');
    daMetadata.set(view, 'numAttr', 789);
    daMetadata.set(view, 'objAttr', { complex: true }); // Objects shouldn't become attrs

    await nextFrame(); // Wait for PM update cycle to apply attributes

    expect(dom.getAttribute('data-meta-attrKey')).to.equal('attrValue');
    expect(dom.getAttribute('data-meta-numAttr')).to.equal('789');
    expect(dom.hasAttribute('data-meta-objAttr')).to.be.false; // Objects ignored

    // Test update
    daMetadata.set(view, 'attrKey', 'newValue');
    await nextFrame();
    expect(dom.getAttribute('data-meta-attrKey')).to.equal('newValue');
  });

  // --- Direct Yjs API Tests (Optional) ---
  it('getMetadataDirectly should retrieve from Y.Map', () => {
    ydoc.transact(() => {
      yMetadata.set('directGet', 'got');
    });
    expect(getMetadataDirectly(ydoc, 'directGet')).to.equal('got');
  });

  it('getAllMetadataDirectly should retrieve all from Y.Map', () => {
    ydoc.transact(() => {
      yMetadata.set('directAll1', 'd1');
      yMetadata.set('directAll2', 'd2');
    });
    expect(getAllMetadataDirectly(ydoc)).to.deep.equal({ directAll1: 'd1', directAll2: 'd2' });
  });

  it('setMetadataDirectly should update Y.Map', () => {
    setMetadataDirectly(ydoc, 'directSet', 'set');
    expect(yMetadata.get('directSet')).to.equal('set');
  });

  // --- Undo/Redo Tests ---
  describe('Undo/Redo Integration (WTR)', () => {
    let undoManager;
    let viewWithUndo;
    // dom and yMetadata available from outer scope

    beforeEach(async () => {
      // Re-create ydoc for isolation if needed, or reuse outer one
      ydoc = new Y.Doc(); // Use a fresh ydoc for undo tests
      yMetadata = ydoc.getMap(MAP_NAME);
      undoManager = new Y.UndoManager(yMetadata);
      const setup = await createTestView(ydoc, [yUndoPlugin({ undoManager })]);
      viewWithUndo = setup.view;
      dom = setup.dom; // Update dom ref if createTestView returns a new one
    });

    afterEach(() => {
      if (viewWithUndo && !viewWithUndo.isDestroyed) {
        viewWithUndo.destroy();
      }
      if (undoManager) {
        undoManager.destroy();
      }
      if (ydoc) {
        ydoc.destroy();
      }
      // fixture handles DOM cleanup
    });

    it('should undo a metadata change made via daMetadata.set', async () => {
      daMetadata.set(viewWithUndo, 'undoKey', 'initialValue');
      await nextFrame(); // Ensure sync

      expect(daMetadata.get(viewWithUndo, 'undoKey')).to.equal('initialValue');
      expect(yMetadata.get('undoKey')).to.equal('initialValue'); // Verify Yjs state

      // Perform Undo
      yUndo(viewWithUndo.state, viewWithUndo.dispatch);
      await nextFrame(); // Wait for sync

      // Metadata should be reverted
      expect(daMetadata.get(viewWithUndo, 'undoKey')).to.be.undefined;
      expect(yMetadata.get('undoKey')).to.be.undefined; // Verify Yjs state reverted
    });

    it('should redo a metadata change made via daMetadata.set', async () => {
      daMetadata.set(viewWithUndo, 'redoKey', 'initialValue');
      await nextFrame(); // Ensure sync

      // Undo the change
      yUndo(viewWithUndo.state, viewWithUndo.dispatch);
      await nextFrame(); // Wait for sync
      expect(daMetadata.get(viewWithUndo, 'redoKey')).to.be.undefined;

      // Perform Redo
      yRedo(viewWithUndo.state, viewWithUndo.dispatch);
      await nextFrame(); // Wait for sync

      // Metadata should be restored
      expect(daMetadata.get(viewWithUndo, 'redoKey')).to.equal('initialValue');
      expect(yMetadata.get('redoKey')).to.equal('initialValue'); // Verify Yjs state restored
    });

    it('should handle multiple metadata changes with undo/redo', async () => {
      daMetadata.set(viewWithUndo, 'multi', 'step1');
      await nextFrame();
      daMetadata.set(viewWithUndo, 'multi', 'step2');
      await nextFrame();
      daMetadata.set(viewWithUndo, 'another', 'other');
      await nextFrame();

      expect(daMetadata.get(viewWithUndo, 'multi')).to.equal('step2');
      expect(daMetadata.get(viewWithUndo, 'another')).to.equal('other');

      // Undo 'another'
      yUndo(viewWithUndo.state, viewWithUndo.dispatch);
      await nextFrame();
      expect(daMetadata.get(viewWithUndo, 'multi')).to.equal('step2');
      expect(daMetadata.get(viewWithUndo, 'another')).to.be.undefined;

      // Undo 'multi' step2
      yUndo(viewWithUndo.state, viewWithUndo.dispatch);
      await nextFrame();
      expect(daMetadata.get(viewWithUndo, 'multi')).to.equal('step1');
      expect(daMetadata.get(viewWithUndo, 'another')).to.be.undefined;

      // Redo 'multi' step2
      yRedo(viewWithUndo.state, viewWithUndo.dispatch);
      await nextFrame();
      expect(daMetadata.get(viewWithUndo, 'multi')).to.equal('step2');
      expect(daMetadata.get(viewWithUndo, 'another')).to.be.undefined;
    });
  });
});
