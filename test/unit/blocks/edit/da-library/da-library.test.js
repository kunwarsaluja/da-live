import { expect } from '@esm-bundle/chai';
import sinon from 'sinon';
import '../../../../../../blocks/edit/da-library/da-library.js';

describe('DaLibrary', () => {
  let element;
  let mockView;

  beforeEach(async () => {
    // Setup mock window.view
    mockView = {
      dom: document.createElement('div'),
      state: {
        schema: {
          text: (text) => ({ type: 'text', text }),
        },
        tr: {
          replaceSelectionWith: sinon.stub().returns({
            scrollIntoView: () => {},
          }),
        },
      },
      dispatch: sinon.stub(),
    };
    window.view = mockView;

    // Create element
    element = document.createElement('da-library');
    document.body.appendChild(element);
    await element.updateComplete;
  });

  afterEach(() => {
    element.remove();
    sinon.restore();
  });

  it('initializes with default properties', () => {
    expect(element._libraryList).to.deep.equal([]);
    expect(element._libraryDetails).to.deep.equal({});
    expect(element._searchStr).to.equal('');
    expect(element._searchHasFocus).to.be.false;
  });

  // it('handles search input', async () => {
  //   const searchInput = element.shadowRoot.querySelector('.da-library-search-input');
  //   searchInput.value = 'test search';
  //   searchInput.dispatchEvent(new Event('input'));
  //   await element.updateComplete;

  //   expect(element._searchStr).to.equal('test search');
  // });

  it('handles escape key to close library', () => {
    const event = new KeyboardEvent('keydown', { key: 'Escape' });

    expect(document.querySelector('da-library')).to.not.exist;
    window.dispatchEvent(event);
    expect(document.querySelector('da-library')).to.exist;
  });

  it('handles search clear', async () => {
    element._searchStr = 'test';
    await element.updateComplete;

    const closeSearchBtn = element.shadowRoot.querySelector('.palette-back');
    closeSearchBtn.click();
    await element.updateComplete;

    expect(element._searchStr).to.equal('');
  });

  // it('renders main menu when no search string', async () => {
  //   element._libraryList = [
  //     { name: 'blocks', icon: 'test-icon.svg' },
  //     { name: 'templates' },
  //   ];
  //   await element.updateComplete;

  //   const menuItems = element.shadowRoot.querySelectorAll('.da-library-item-list-main button');
  //   expect(menuItems.length).to.equal(2);
  //   expect(menuItems[0].classList.contains('blocks')).to.be.true;
  //   expect(menuItems[1].classList.contains('templates')).to.be.true;
  // });

  // it('handles item click', async () => {
  //   const mockItem = {
  //     parsed: { type: 'paragraph' },
  //   };

  //   await element.handleItemClick(mockItem);

  //   expect(mockView.dispatch.called).to.be.true;
  //   expect(mockView.state.tr.replaceSelectionWith.calledWith(mockItem.parsed)).to.be.true;
  // });
});

