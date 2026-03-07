import { useEffect, useRef } from 'react';
import './RichTextEditor.css';

const TOOLBAR_ACTIONS = [
  { key: 'bold', label: 'B', title: 'Negrita' },
  { key: 'italic', label: 'I', title: 'Cursiva' },
  { key: 'underline', label: 'U', title: 'Subrayado' },
  { key: 'h3', label: 'H3', title: 'Subtitulo' },
  { key: 'paragraph', label: 'P', title: 'Parrafo' },
  { key: 'small', label: 'A-', title: 'Texto pequeno' },
  { key: 'normal', label: 'A', title: 'Texto normal' },
  { key: 'large', label: 'A+', title: 'Texto grande' },
  { key: 'ul', label: '• Lista', title: 'Lista con vinetas' },
  { key: 'ol', label: '1. Lista', title: 'Lista numerada' }
];

const escapeHtml = (value = '') => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const getNodeElement = (node) => {
  if (!node) return null;
  return node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
};

export default function RichTextEditor({
  value = '',
  onChange,
  placeholder = 'Escribe aqui...',
  minHeight = 200,
  helpText = '',
  className = ''
}) {
  const editorRef = useRef(null);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const normalizedValue = value || '';
    const isFocused = document.activeElement === editor;

    if (!isFocused && editor.innerHTML !== normalizedValue) {
      editor.innerHTML = normalizedValue;
    }
  }, [value]);

  const emitChange = () => {
    const editor = editorRef.current;
    if (!editor || !onChange) return;
    onChange(editor.innerHTML);
  };

  const keepSelectionOnToolbar = (event) => {
    event.preventDefault();
  };

  const runEditorCommand = (command, commandValue = null) => {
    const editor = editorRef.current;
    if (!editor) return;

    if (document.activeElement !== editor) {
      editor.focus();
    }

    document.execCommand(command, false, commandValue);
    emitChange();
  };

  const findClosestInEditor = (node, selectors) => {
    const editor = editorRef.current;
    const element = getNodeElement(node);
    if (!editor || !element) return null;
    const found = element.closest(selectors);
    if (!found || !editor.contains(found)) return null;
    return found;
  };

  const getCurrentListContext = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return null;

    const node = selection.anchorNode;
    const listElement = findClosestInEditor(node, 'ul, ol');
    if (!listElement) return null;

    return {
      listElement,
      tag: listElement.tagName.toLowerCase()
    };
  };

  const moveCaretToElementStart = (element) => {
    const selection = window.getSelection();
    if (!selection || !element) return;

    const range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
  };

  const exitListToParagraph = () => {
    const editor = editorRef.current;
    if (!editor) return;

    const context = getCurrentListContext();
    if (!context?.listElement) return;

    const paragraph = document.createElement('p');
    paragraph.innerHTML = '<br>';
    context.listElement.insertAdjacentElement('afterend', paragraph);
    moveCaretToElementStart(paragraph);
    emitChange();
  };

  const getEditorRange = () => {
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (!editor || !selection || selection.rangeCount === 0) return null;

    const range = selection.getRangeAt(0);
    if (!editor.contains(range.commonAncestorContainer)) return null;
    return range;
  };

  const insertListAtSelection = (ordered = false) => {
    const editor = editorRef.current;
    if (!editor) return;

    editor.focus();

    const selection = window.getSelection();
    if (!selection) return;

    let range = getEditorRange();
    if (!range) {
      range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    }

    const selectedText = range.toString().trim();
    const items = (selectedText || 'Elemento')
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean);

    const tag = ordered ? 'ol' : 'ul';
    const listHtml = `<${tag}>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</${tag}>`;

    document.execCommand('insertHTML', false, listHtml);
    emitChange();
  };

  const handleFormatAction = (action) => {
    switch (action) {
      case 'bold':
        runEditorCommand('bold');
        break;
      case 'italic':
        runEditorCommand('italic');
        break;
      case 'underline':
        runEditorCommand('underline');
        break;
      case 'h3':
        runEditorCommand('formatBlock', 'h3');
        break;
      case 'paragraph':
        if (getCurrentListContext()) {
          exitListToParagraph();
        } else {
          runEditorCommand('formatBlock', 'p');
        }
        break;
      case 'small':
        runEditorCommand('fontSize', '2');
        break;
      case 'normal':
        runEditorCommand('fontSize', '3');
        break;
      case 'large':
        runEditorCommand('fontSize', '5');
        break;
      case 'ul':
        if (getCurrentListContext()?.tag === 'ul') {
          exitListToParagraph();
        } else {
          insertListAtSelection(false);
        }
        break;
      case 'ol':
        if (getCurrentListContext()?.tag === 'ol') {
          exitListToParagraph();
        } else {
          insertListAtSelection(true);
        }
        break;
      default:
        break;
    }
  };

  return (
    <div className={`rich-text-editor-root ${className}`.trim()}>
      {helpText && <p className="rte-help-text">{helpText}</p>}

      <div className="rte-toolbar">
        {TOOLBAR_ACTIONS.map((action) => (
          <button
            key={action.key}
            type="button"
            className="rte-format-btn"
            onMouseDown={keepSelectionOnToolbar}
            onClick={() => handleFormatAction(action.key)}
            title={action.title}
          >
            {action.label}
          </button>
        ))}
      </div>

      <div
        ref={editorRef}
        className="rte-input"
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder}
        onInput={emitChange}
        onBlur={emitChange}
        style={{ minHeight: `${minHeight}px` }}
      />
    </div>
  );
}
