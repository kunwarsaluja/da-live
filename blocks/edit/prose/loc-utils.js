/* eslint-disable max-classes-per-file */
import {
  DOMParser,
  DOMSerializer,
  Fragment,
  Slice,
} from 'da-y-wrapper';

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

export function getLocClass(elName, getSchema, dispatchTransaction, { isLangstore } = {}) {
  return class {
    constructor(node, view, getPos) {
      this.dom = document.createElement(elName);
      this.dom.dataset.objHash = node.attrs.objHash;
      const serializer = DOMSerializer.fromSchema(getSchema());
      const nodeDOM = serializer.serializeFragment(node.content);

      this.dom.appendChild(nodeDOM);
      const coverDiv = getCoverDiv(isLangstore);
      this.dom.appendChild(coverDiv);
      const { overlay, deleteBtn, keepBtn } = getLangOverlay(isLangstore);
      this.langOverlay = overlay;

      deleteBtn.addEventListener('click', () => {
        if (node.attrs.objHash) {
          delete window.daMetadata[node.attrs.objHash];
        }
        dispatchTransaction(deleteLocContent(view, getPos(), node));
      });

      keepBtn.addEventListener('click', () => {
        if (node.attrs.objHash) {
          delete window.daMetadata[node.attrs.objHash];
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

export function addLocNodes(baseNodes, daMetadata) {
  if (!baseNodes.content.includes('da_content_source')) {
    baseNodes.content.push('da_content_source');
    baseNodes.content.push({
      attrs: { objHash: { default: null } },
      group: 'block',
      content: 'block+',
      parseDOM: parseLocDOM('da-content-source', { getHash: true }),
      toDOM: (node) => ['da-content-source',
        { contenteditable: false, 'data-obj-hash': node.attrs.objHash },
        0,
      ],
    });
    baseNodes.content.push('da_content_current');
    baseNodes.content.push({
      group: 'block',
      content: 'block+',
      parseDOM: parseLocDOM('da-content-current'),
      toDOM: () => ['da-content-current', { contenteditable: false }, 0],
    });
    baseNodes.content.push('da_metadata');
    baseNodes.content.push({
      group: 'block',
      content: 'block+',
      attrs: { objHash: { default: null }, innHtml: { default: null } },
      parseDOM: [{
        tag: 'da-metadata',
        ignore: true,
        getAttrs: (dom) => {
          [...dom.children].forEach((child) => {
            if (child.className === 'da-content-source') {
              daMetadata[child.dataset.objHash] = child.innerHTML;
            }
          });
          return {};
        },
      }],
      toDOM: () => ['da-metadata'],
    });
  }
  return baseNodes;
}

export function getDaMetadataClass(getSchema) {
  return class DaMetaData {
    constructor(node) {
      this.dom = document.createElement('da-metadata');
      this.dom.style.display = 'none';

      const serializer = DOMSerializer.fromSchema(getSchema());
      const nodeDOM = serializer.serializeFragment(node.content);

      this.dom.appendChild(nodeDOM);
    }

    destroy() {}

    stopEvent() { return true; }
  };
}
