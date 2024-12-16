import { LitElement, html } from 'da-lit';
import { getNx } from '../../../scripts/utils.js';

// Styles
const { default: getStyle } = await import(`${getNx()}/utils/styles.js`);
const STYLE = await getStyle(import.meta.url);

const getItemPath = (item) => {
  // eslint-disable-next-line no-unused-vars
  const [, org, repo, ...pathParts] = item.path.split('/');
  const path = pathParts.join('/');
  if (path.includes('.')) {
    return path.split('.')[0];
  }
  return path;
};

export default class DaActionBar extends LitElement {
  static properties = {
    items: { attribute: false },
    _canPaste: { state: true },
    _isMoving: { state: true },
    _isExpanded: { state: true },
    fullpath: { type: String },
  };

  constructor() {
    super();
    this.items = [];
    this._isExpanded = false;
    this._isMoving = false;
    this.fullpath = '';
  }

  connectedCallback() {
    super.connectedCallback();
    this.shadowRoot.adoptedStyleSheets = [STYLE];
  }

  async update(props) {
    if (props.has('items')) {
      // Reset state when items go empty
      if (this.items.length === 0) {
        this._canPaste = false;
        this._isMoving = false;
      }
    }

    super.update(props);
  }

  handleClear() {
    this._canPaste = false;
    this._isMoving = false;
    this._isDeleting = false;
    const opts = { detail: true, bubbles: true, composed: true };
    const event = new CustomEvent('clearselection', opts);
    this.dispatchEvent(event);
  }

  handleRename() {
    const opts = { detail: true, bubbles: true, composed: true };
    const event = new CustomEvent('rename', opts);
    this.dispatchEvent(event);
  }

  handleCopy() {
    this._canPaste = true;
  }

  handleMove() {
    this._isMoving = true;
    this._canPaste = true;
  }

  handlePaste() {
    const detail = { move: this._isMoving };
    const opts = { bubbles: true, composed: true };
    const event = new CustomEvent('onpaste', { ...opts, detail });
    this.dispatchEvent(event);
  }

  handleDelete() {
    this._isDeleting = true;
    const opts = { bubbles: true, composed: true };
    const event = new CustomEvent('ondelete', opts);
    this.dispatchEvent(event);
  }

  handleShare() {
    const aemUrls = this.items.reduce((acc, item) => {
      if (item.ext) {
        const path = item.path.replace('.html', '');
        const [org, repo, ...pathParts] = path.substring(1).split('/');
        const pageName = pathParts.pop();
        pathParts.push(pageName === 'index' ? '' : pageName);
        acc.push(`https://main--${repo}--${org}.aem.page/${pathParts.join('/')}`);
      }
      return acc;
    }, []);
    const blob = new Blob([aemUrls.join('\n')], { type: 'text/plain' });
    const data = [new ClipboardItem({ [blob.type]: blob })];
    navigator.clipboard.write(data);
    const opts = { bubbles: true, composed: true };
    const event = new CustomEvent('onshare', opts);
    this.dispatchEvent(event);
  }

  inNewDir() {
    // items can only be selected from the same directory
    const itemPath = this.items?.[0]?.path;
    const itemDir = itemPath?.split('/').slice(0, -1).join('/');
    return itemDir !== this.fullpath;
  }

  get _canShare() {
    return this.items.some((item) => item.ext && item.ext !== 'link');
  }

  get currentAction() {
    if (this._canPaste && this._isMoving) return `Moving ${this.items.length} items`;
    if (this._canPaste && !this._isMoving) return `Copying ${this.items.length} items`;
    if (this._isDeleting) return `Deleting ${this.items.length} items`;
    return `${this.items.length} selected`;
  }

  toggleExpand() {
    this._isExpanded = !this._isExpanded;
    const event = new CustomEvent('actionbar-expand', {
      bubbles: true,
      composed: true,
      detail: { expanded: this._isExpanded },
    });
    this.dispatchEvent(event);
  }

  render() {
    return html`
      <div class="da-action-bar ${this._isExpanded ? 'expanded' : ''}">
        <div class="da-action-bar-main">
          <div class="da-action-bar-left-rail">
            <button
              class="close-circle"
              @click=${this.handleClear}
              aria-label="Unselect items">
              <img src="/blocks/browse/da-browse/img/CrossSize200.svg" />
            </button>
            <div class="selection-info">
              ${this.items.length > 0
                ? html`<button
                        class="expand-toggle ${this._isExpanded ? 'expanded' : ''}"
                        @click=${this.toggleExpand}
                        aria-label="${this._isExpanded ? 'Collapse selection' : 'Expand selection'}">
                        ▶
                      </button>`
                : ''}
              <span>${this.currentAction}</span>
            </div>
          </div>
          <div class="da-action-bar-right-rail">
            <button
              @click=${this.handleRename}
              class="rename-button ${this.items.length === 1 ? '' : 'hide'} ${this._canPaste ? 'hide' : ''}">
              <img src="/blocks/browse/da-browse/img/Smock_TextEdit_18_N.svg" />
              <span>Rename</span>
            </button>
            <button
              @click=${this.handleMove}
              class="copy-button ${this._canPaste ? 'hide' : ''}">
              <img src="/blocks/browse/da-browse/img/Smock_MoveTo_18_N.svg" />
              <span>Move</span>
            </button>
            <button
              @click=${this.handleCopy}
              class="copy-button ${this._canPaste ? 'hide' : ''}">
              <img src="/blocks/browse/da-browse/img/Smock_Copy_18_N.svg" />
              <span>Copy</span>
            </button>
            <button
              @click=${this.handlePaste}
              class="copy-button ${this._canPaste ? '' : 'hide'}">
              <img src="/blocks/browse/da-browse/img/Smock_Copy_18_N.svg" />
              <span>Paste</span>
            </button>
            <button
              @click=${this.handleDelete}
              class="delete-button">
              <img src="/blocks/browse/da-browse/img/Smock_Delete_18_N.svg" />
              <span>Delete</span>
            </button>
            <button
              @click=${this.handleShare}
              class="share-button ${this._canShare ? '' : 'hide'}">
              <img src="/blocks/browse/img/Smock_Share_18_N.svg" />
              <span>Share</span>
            </button>
          </div>
        </div>
        ${this._isExpanded && this.items.length > 0
          ? html`<div class="items-list">
              ${this.items.map((item) => html`
                <div class="item-entry">
                  <img
                    class="item-icon"
                    src="/blocks/browse/img/${this._getItemIcon(item)}"
                  />
                  <span>${getItemPath(item)}</span>
                </div>
              `)}
            </div>`
          : ''}
      </div>`;
  }

  _getItemIcon(item) {
    if (!item.ext) return 'Smock_Folder_18_N.svg';
    if (item.ext === 'html') return 'Smock_FileHTML_18_N.svg';
    if (item.ext === 'json') return 'Smock_FileData_18_N.svg';
    if (item.ext === 'link') return 'Smock_LinkOut_18_N.svg';
    return 'Smock_Image_18_N.svg';
  }
}

customElements.define('da-actionbar', DaActionBar);
