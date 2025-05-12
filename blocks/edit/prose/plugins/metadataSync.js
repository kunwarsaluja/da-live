/* eslint-disable no-unused-vars, max-classes-per-file */
import { Plugin, PluginKey } from 'da-y-wrapper';

// --- Metadata Sync Plugin ---
const MAP_NAME = 'da-metadata';
export const daMetadataPluginKey = new PluginKey('da-metadata-sync');

class MetadataState {
  constructor(metadata) {
    this.metadata = metadata || {};
  }

  static init(config) {
    const { yMetadata } = config;
    return new MetadataState(Object.fromEntries(yMetadata.entries()));
  }

  apply(tr, value, _oldState, _newState) {
    const meta = tr.getMeta(daMetadataPluginKey);

    if (meta?.action === 'syncFromYjs') {
      // Update state based on Yjs change received by the observer
      return new MetadataState(meta.metadata);
    }

    if (meta?.action === 'set' && meta.key !== undefined) {
      // Optimistically update PM state immediately for 'set' actions
      const newMetadata = { ...value.metadata }; // Create a new metadata object
      newMetadata[meta.key] = meta.value;
      // Note: Y.Map typically deletes a key if the value is set to undefined.
      // This implementation currently just sets the value. If exact deletion
      // synchronization is needed, this logic might need adjustment based on `meta.value`.
      return new MetadataState(newMetadata);
    }

    // If the change originated from PM ('set' action), the state doesn't change here,
    // appendTransaction handles the Yjs update, and the observer syncs back if needed.
    // The 'value' parameter represents the current state instance, which is needed for the return.
    return value; // For any other transaction or meta, return the current state unchanged
  }
}

/**
 * Creates a ProseMirror plugin to sync global metadata with a Y.Map.
 * @param {import('yjs').Map<any>} yMetadata The Y.Map instance for metadata.
 * @param {import('yjs').Doc} ydoc The Y.Doc instance.
 * @returns {Plugin}
 */
export function createMetadataSyncPlugin(yMetadata, ydoc) {
  return new Plugin({
    key: daMetadataPluginKey,
    state: {
      init: (config, _instance) => MetadataState.init({ ...config, yMetadata }),
      apply: (tr, value, oldState, newState) => value.apply(tr, value, oldState, newState),
    },
    view(editorView) {
      const syncMetadataFromYjs = () => {
        const currentYjsMetadata = Object.fromEntries(yMetadata.entries());
        const currentPmState = daMetadataPluginKey.getState(editorView.state);

        // Avoid unnecessary transactions if state is already in sync
        if (JSON.stringify(currentYjsMetadata) !== JSON.stringify(currentPmState?.metadata)) {
          const tr = editorView.state.tr.setMeta(daMetadataPluginKey, {
            action: 'syncFromYjs',
            metadata: currentYjsMetadata,
          });
          // Check if view is still mounted before dispatching
          if (editorView.docView) {
            editorView.dispatch(tr);
          }
        }
      };

      // Initial sync when the view is created
      syncMetadataFromYjs();

      // Observe YMap changes
      const observer = (_event, transaction) => {
        syncMetadataFromYjs();
      };
      yMetadata.observe(observer);

      return {
        destroy() {
          yMetadata.unobserve(observer);
        },
      };
    },
    props: {
      attributes(state) {
        const metadataState = daMetadataPluginKey.getState(state);
        const attrs = {};
        if (metadataState?.metadata) {
          for (const [key, value] of Object.entries(metadataState.metadata)) {
            if (value !== null && value !== undefined && typeof value !== 'object') {
              attrs[`data-meta-${key}`] = String(value);
            }
          }
        }
        return attrs;
      },
    },
    appendTransaction(transactions, _oldState, _newState) {
      transactions.forEach((tr) => {
        const meta = tr.getMeta(daMetadataPluginKey);
        if (meta?.action === 'set' && meta.key !== undefined) {
          const { key } = meta;
          const newValue = meta.value;
          const currentValue = yMetadata.get(key);

          if (currentValue !== newValue) {
            ydoc.transact(() => {
              yMetadata.set(key, newValue);
            }, daMetadataPluginKey);
          }
        }
      });
      return null;
    },
  });
}

export function setMetadata(ydoc, key, value) {
  if (!ydoc) {
    // eslint-disable-next-line no-console
    console.warn('YDoc not provided for setMetadata');
    return;
  }
  const yMetadata = ydoc.getMap(MAP_NAME);
  ydoc.transact(() => {
    yMetadata.set(key, value);
  }, 'external-api');
}

export function getMetadata(ydoc, key) {
  if (!ydoc) {
    // eslint-disable-next-line no-console
    console.warn('YDoc not provided for getMetadata');
    return undefined;
  }
  const yMetadata = ydoc.getMap(MAP_NAME);
  return yMetadata.get(key);
}

export function getAllMetadata(ydoc) {
  if (!ydoc) {
    // eslint-disable-next-line no-console
    console.warn('YDoc not provided for getAllMetadata');
    return {};
  }
  const yMetadata = ydoc.getMap(MAP_NAME);
  return Object.fromEntries(yMetadata.entries());
}

function getMetadataFromPm(view, key) {
  const state = daMetadataPluginKey.getState(view?.state);
  return state?.metadata?.[key];
}

function setMetadataWithPmTransaction(view, key, value) {
  const tr = view.state.tr.setMeta(daMetadataPluginKey, { action: 'set', key, value });
  view?.dispatch(tr);
}

function getAllMetadataFromPm(view) {
  const state = daMetadataPluginKey.getState(view?.state);
  return { ...(state?.metadata || {}) }; // Return a shallow copy
}

export const daMetadata = {
  get: getMetadataFromPm,
  getAll: getAllMetadataFromPm,
  set: setMetadataWithPmTransaction,
};
