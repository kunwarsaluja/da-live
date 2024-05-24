/* eslint-disable no-underscore-dangle */
/* eslint-disable max-classes-per-file */
import {
  DOMSerializer,
  Fragment,
  Slice,
} from 'da-y-wrapper';
import { getDaMetadata } from '../utils/helpers.js';

const LOC = {
  LANGSTORE: {
    BG: 'rgba(70, 130, 180, 0.8)',
    COVER_BG: 'rgba(70, 130, 180, 0.4)',
    TEXT: 'Langstore Content',
    TEXT_COLOR: 'rgba(70, 130, 180)',
  },
  REGIONAL: {
    BG: 'rgba(144, 42, 222, 0.8)',
    COVER_BG: 'rgba(144, 42, 222, 0.4)',
    TEXT: 'Regional Content',
    TEXT_COLOR: 'rgba(144, 42, 222)',
  },
};

const SOURCE_TAG = 'da-content-source';
const CURRENT_TAG = 'da-content-current';

function getCoverDiv(isLangstore) {
  const coverDiv = document.createElement('div');
  coverDiv.className = `loc-color-overlay ${isLangstore ? 'loc-langstore' : 'loc-regional'}`;
  coverDiv.setAttribute('loc-temp-dom', '');

  coverDiv.style.backgroundColor = isLangstore
    ? LOC.LANGSTORE.COVER_BG
    : LOC.REGIONAL.COVER_BG;
  return coverDiv;
}

function getLangOverlay(isLangstore) {
  const overlay = document.createElement('div');
  overlay.className = 'loc-lang-overlay';
  overlay.setAttribute('loc-temp-dom', '');
  overlay.style.backgroundColor = isLangstore
    ? LOC.LANGSTORE.BG
    : LOC.REGIONAL.BG;

  const dialog = document.createElement('div');
  dialog.className = 'loc-dialog';
  dialog.innerHTML = `
    <span>${isLangstore ? LOC.LANGSTORE.TEXT : LOC.REGIONAL.TEXT}</span>
    <div>
    <span class="loc-keep"><div title="Keep">Keep</div></span>
    <span class="loc-delete"><div title="Delete">Delete</div></span>
    </div>`;
  dialog.style.color = isLangstore
    ? LOC.LANGSTORE.TEXT_COLOR
    : LOC.REGIONAL.TEXT_COLOR;

  const deleteBtn = dialog.querySelector('.loc-delete');
  const keepBtn = dialog.querySelector('.loc-keep');
  overlay.appendChild(dialog);

  return { overlay, deleteBtn, keepBtn };
}

function keepLocContentInPlace(view, pos, node) {
  node.content.content = node.content.content.filter((c) => c.content.content.length);
  const newFragment = Fragment.fromArray(node.content.content);
  const newSlice = new Slice(newFragment, 0, 0);
  const transaction = view.state.tr.replace(pos, pos + node.nodeSize, newSlice);
  return transaction;
}

function deleteLocContent(view, pos, node) {
  const resolvedPos = view.state.doc.resolve(pos);

  if (resolvedPos.parent.type.name === 'list_item') {
    const parentPos = resolvedPos.before(resolvedPos.depth);
    const transaction = view.state.tr.delete(parentPos, parentPos + resolvedPos.parent.nodeSize);
    return transaction;
  }

  const transaction = view.state.tr.delete(pos, pos + node.nodeSize);
  return transaction;
}

function deleteDaMetadataSourceEntry(doc, objHash) {
  const hashCount = doc.querySelectorAll(`${SOURCE_TAG}[data-obj-hash="${objHash}"]`).length;
  if (hashCount === 1) {
    delete getDaMetadata()?.sourceMap?.[objHash];
  }
}

function getLocClass(elName, getSchema, dispatchTransaction, { isLangstore } = {}) {
  return class {
    constructor(node, view, getPos) {
      this.dom = document.createElement(elName);
      if (node.attrs.objHash) {
        this.dom.dataset.objHash = node.attrs.objHash;
      }
      const serializer = DOMSerializer.fromSchema(getSchema());
      const nodeDOM = serializer.serializeFragment(node.content);

      this.dom.appendChild(nodeDOM);
      const coverDiv = getCoverDiv(isLangstore);
      this.dom.appendChild(coverDiv);
      const { overlay, deleteBtn, keepBtn } = getLangOverlay(isLangstore);
      this.langOverlay = overlay;

      deleteBtn.addEventListener('click', () => {
        if (node.attrs.objHash) {
          deleteDaMetadataSourceEntry(view._root, node.attrs.objHash);
        }
        dispatchTransaction(deleteLocContent(view, getPos(), node));
      });

      keepBtn.addEventListener('click', () => {
        if (node.attrs.objHash) {
          deleteDaMetadataSourceEntry(view._root, node.attrs.objHash);
        }
        dispatchTransaction(keepLocContentInPlace(view, getPos(), node));
      });

      coverDiv.appendChild(this.langOverlay);

      coverDiv.addEventListener('mouseover', () => {
        this.langOverlay.style.display = 'flex';
      });

      coverDiv.addEventListener('mouseout', () => {
        this.langOverlay.style.display = 'none';
      });
    }

    destroy() {
      this.coverDiv?.remove();
      this.langOverlay?.remove();
    }

    stopEvent() { return true; }
  };
}

export function getContentCurrentView(getSchema, dispatchTransaction, node, view, getPos) {
  const View = getLocClass(CURRENT_TAG, getSchema, dispatchTransaction, { isLangstore: false });
  return new View(node, view, getPos);
}

export function getContentSourceView(getSchema, dispatchTransaction, node, view, getPos) {
  const View = getLocClass(SOURCE_TAG, getSchema, dispatchTransaction, { isLangstore: true });
  return new View(node, view, getPos);
}

function parseLocDOM(locTag, { getHash = false } = {}) {
  return [{
    tag: locTag,
    getAttrs: (dom) => {
      if (getHash) {
        return { objHash: dom.dataset.objHash };
      }
      return {};
    },
    contentElement: (dom) => {
      // Only parse the content of the node, not the temporary elements
      const deleteThese = dom.querySelectorAll('[loc-temp-dom]');
      deleteThese.forEach((e) => e.remove());
      return dom;
    },
  }];
}

export function addLocNodes(baseNodes) {
  if (!baseNodes.content.includes(SOURCE_TAG)) {
    baseNodes.content.push('da_content_source');
    baseNodes.content.push({
      attrs: { objHash: { default: null } },
      group: 'block',
      content: 'block+',
      parseDOM: parseLocDOM(SOURCE_TAG, { getHash: true }),
      toDOM: (node) => [SOURCE_TAG,
        { contenteditable: false, 'data-obj-hash': node.attrs.objHash },
        0,
      ],
    });
    baseNodes.content.push('da_content_current');
    baseNodes.content.push({
      group: 'block',
      content: 'block+',
      parseDOM: parseLocDOM(CURRENT_TAG),
      toDOM: () => [CURRENT_TAG, { contenteditable: false }, 0],
    });
    baseNodes.content.push('da_metadata');
    baseNodes.content.push({
      group: 'block',
      content: 'block+',
      parseDOM: [{
        tag: 'da-metadata',
        ignore: true, // prosemirror will not parse/insert the content of this tag
        getAttrs: (dom) => {
          // Convert the da-metadata dom to a sourceMap object
          // This is converted back to DOM in prose2aem
          const daMetadata = getDaMetadata();
          daMetadata.sourceMap ??= {};
          [...dom.children].forEach((child) => {
            if (child.className === SOURCE_TAG) {
              daMetadata.sourceMap[child.dataset.objHash] = child.innerHTML;
            }
          });
          return {};
        },
      }],
    });
  }
  return baseNodes;
}
