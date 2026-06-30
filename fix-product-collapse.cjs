const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend', 'src', 'components', 'products', 'ProductList.jsx');
let content = fs.readFileSync(filePath, 'utf8');

const NL = content.includes('\r\n') ? '\r\n' : '\n';
const lines = content.split(NL);

// ── 1. Add showEditProduct state ───────────────────────────────────────
const stateSentinel = 'const [showEditDesc, setShowEditDesc] = useState(false); // collapsible description in product edit form';
const newStateLine = '\tconst [showEditProduct, setShowEditProduct] = useState(true); // collapsible product info section (default open)';

if (!content.includes('showEditProduct')) {
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(stateSentinel)) {
      lines.splice(i + 1, 0, newStateLine);
      console.log('✅ Added showEditProduct state');
      break;
    }
  }
}

// ── 2. Add reset in startEditing ───────────────────────────────────────
const resetSentinel = '\t\tsetShowEditDesc(false);';
const newResetLine = '\t\tsetShowEditProduct(true);';

if (!content.includes(newResetLine.trim())) {
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === resetSentinel.trim()) {
      lines.splice(i + 1, 0, newResetLine);
      console.log('✅ Added showEditProduct reset in startEditing');
      break;
    }
  }
}

// ── 3. Helper: wrap product detail block ───────────────────────────────
function wrapProductBlock(lines, searchStart) {
  let startIdx = -1;
  for (let i = searchStart; i < lines.length; i++) {
    if (lines[i].includes('className="form-row"') && lines[i].includes('<div')) {
      startIdx = i;
      break;
    }
  }
  if (startIdx === -1) return false;

  let variantCommentIdx = -1;
  for (let i = startIdx; i < lines.length; i++) {
    if (lines[i].trim().startsWith('{/* Variant manager */}')) {
      variantCommentIdx = i;
      break;
    }
  }
  if (variantCommentIdx === -1) return false;

  // Find end of images-section (closing </div>)
  let imagesSectionStart = -1;
  for (let i = startIdx; i < variantCommentIdx; i++) {
    if (lines[i].includes('className="images-section"') && lines[i].includes('<div')) {
      imagesSectionStart = i;
      break;
    }
  }
  if (imagesSectionStart === -1) return false;

  let depth = 0;
  let endIdx = -1;
  for (let i = imagesSectionStart; i < variantCommentIdx; i++) {
    const opens = (lines[i].match(/<div/g) || []).length;
    const closes = (lines[i].match(/<\/div>/g) || []).length;
    depth += opens - closes;
    if (depth <= 0 && i > imagesSectionStart) {
      endIdx = i;
      break;
    }
  }
  if (endIdx === -1 || endIdx >= variantCommentIdx) {
    endIdx = variantCommentIdx - 1;
  }

  const blockContent = lines.slice(startIdx, endIdx + 1);

  const firstLine = blockContent[0];
  const tabMatch = firstLine.match(/^(\t+)/);
  const depth_tabs = tabMatch ? tabMatch[1].length : 0;
  const tabs = '\t'.repeat(depth_tabs);
  const innerTabs = '\t'.repeat(depth_tabs + 1);
  const deepTabs = '\t'.repeat(depth_tabs + 2);

  const collapsibleBlock = [
    `${tabs}<div className="variant-desc-collapsible edit-product-collapsible">`,
    `${innerTabs}<button`,
    `${innerTabs}\ttype="button"`,
    `${innerTabs}\tclassName="variant-desc-toggle"`,
    `${innerTabs}\tonClick={() => setShowEditProduct(prev => !prev)}`,
    `${innerTabs}>`,
    `${deepTabs}<span>🏷️ Producto</span>`,
    `${deepTabs}<span className="collapsible-icon">{showEditProduct ? '−' : '+'}</span>`,
    `${innerTabs}</button>`,
    `${innerTabs}{showEditProduct && (`,
    `${deepTabs}<>`,
    ...blockContent.map(line => {
      const innerMatch = line.match(/^(\t+)/);
      const innerDepth = innerMatch ? innerMatch[1].length : 0;
      return '\t'.repeat(innerDepth + 2) + line.trim();
    }),
    `${deepTabs}</>`,
    `${innerTabs})}`,
    `${tabs}</div>`,
  ];

  lines.splice(startIdx, endIdx - startIdx + 1, ...collapsibleBlock);
  console.log(`✅ Wrapped product detail block (${endIdx - startIdx + 1} lines → ${collapsibleBlock.length} lines)`);
  return true;
}

// ── 4. Find desktop form ───────────────────────────────────────────────
let desktopSearchStart = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('className="edit-form-content"') && lines[i].includes('<div')) {
    let j = i;
    while (j >= 0 && j > i - 10) {
      if (lines[j].includes('colSpan') || lines[j].includes('colspan')) {
        desktopSearchStart = i;
        break;
      }
      j--;
    }
    if (desktopSearchStart >= 0) break;
  }
}

if (desktopSearchStart >= 0) {
  wrapProductBlock(lines, desktopSearchStart + 1);
} else {
  console.error('❌ Could not find desktop edit form content');
}

// ── 5. Find mobile form ────────────────────────────────────────────────
let mobileSearchStart = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('mobile-edit-form')) {
    for (let j = i; j < lines.length; j++) {
      if (lines[j].includes('className="edit-form-content"')) {
        mobileSearchStart = j;
        break;
      }
    }
    if (mobileSearchStart >= 0) break;
  }
}

if (mobileSearchStart >= 0) {
  wrapProductBlock(lines, mobileSearchStart + 1);
} else {
  console.error('❌ Could not find mobile edit form content');
}

content = lines.join(NL);
fs.writeFileSync(filePath, content, 'utf8');
console.log('✅ Done');
