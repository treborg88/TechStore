const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend', 'src', 'components', 'products', 'ProductList.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// ── Detect line endings ────────────────────────────────────────────────
const NL = content.includes('\r\n') ? '\r\n' : '\n';
const lines = content.split(NL);

// ── Step 1: Add showEditDesc state if missing ──────────────────────────
const stateSentinel = 'const [showEditUrlPanel, setShowEditUrlPanel] = useState(false);';
const newStateLine = '\tconst [showEditDesc, setShowEditDesc] = useState(false); // collapsible description in product edit form';

if (!content.includes('showEditDesc')) {
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(stateSentinel)) {
      lines.splice(i + 1, 0, newStateLine);
      console.log('✅ Added showEditDesc state');
      break;
    }
  }
}

// ── Step 2: Add reset in startEditing ───────────────────────────────────
const resetSentinel = '\t\tsetShowEditUrlPanel(false);';
const newResetLine = '\t\tsetShowEditDesc(false);';

if (!content.includes(newResetLine)) {
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === resetSentinel.trim()) {
      lines.splice(i + 1, 0, newResetLine);
      console.log('✅ Added showEditDesc reset in startEditing');
      break;
    }
  }
}

// ── Step 3: Find and replace description blocks ────────────────────────
// Strategy: find {renderVariantSection(editingProduct.id)} followed by <label> + Descripción
// Replace the <label>...Descripción...<RichTextEditor.../>...</label> with collapsible

function replaceBlock(startIdx) {
  // startIdx = index of {renderVariantSection(editingProduct.id)} line
  const sectionLine = lines[startIdx];
  const commentLine = startIdx - 1 >= 0 ? lines[startIdx - 1] : '';

  // Next line should be <label>
  const labelLineIdx = startIdx + 1;
  if (labelLineIdx >= lines.length || lines[labelLineIdx].trim() !== '<label>') return false;

  // Check it's the Descripción label, not some other label
  const descLineIdx = labelLineIdx + 1;
  if (descLineIdx >= lines.length || lines[descLineIdx].trim() !== 'Descripción') return false;

  // Find the closing </label> at the SAME tab depth as the opening <label>
  const labelTabs = lines[labelLineIdx].match(/^(\t+)/);
  const depth = labelTabs ? labelTabs[1].length : -1;

  let closeLabelIdx = -1;
  for (let j = labelLineIdx + 1; j < lines.length; j++) {
    const trimmed = lines[j].trim();
    if (trimmed === '</label>') {
      // Check tab depth
      const closeTabs = lines[j].match(/^(\t+)/);
      const closeDepth = closeTabs ? closeTabs[1].length : -1;
      if (closeDepth === depth) {
        closeLabelIdx = j;
        break;
      }
    }
  }

  if (closeLabelIdx === -1) return false;

  // Figure out what to keep and what to replace
  // We KEEP the commentLine and sectionLine (comment + renderVariantSection)
  // We REPLACE <label>...</label> with the collapsible div

  const tabs = '\t'.repeat(depth);
  const innerTabs = '\t'.repeat(depth + 1);
  const deepTabs = '\t'.repeat(depth + 2);
  const icon = '\u{1F4DD}';

  const collapsibleBlock = [
    `${tabs}<div className="variant-desc-collapsible edit-desc-collapsible">`,
    `${innerTabs}<button`,
    `${innerTabs}\ttype="button"`,
    `${innerTabs}\tclassName="variant-desc-toggle"`,
    `${innerTabs}\tonClick={() => setShowEditDesc(prev => !prev)}`,
    `${innerTabs}>`,
    `${deepTabs}<span>${icon} Descripción</span>`,
    `${deepTabs}<span className="collapsible-icon">{showEditDesc ? '−' : '+'}</span>`,
    `${innerTabs}</button>`,
    `${innerTabs}{showEditDesc && (`,
    `${deepTabs}<RichTextEditor`,
    `${deepTabs}\tvalue={editingProduct.description}`,
    `${deepTabs}\tonChange={(html) => handleEditField('description', html)}`,
    `${deepTabs}\tplaceholder="Descripcion del producto..."`,
    `${deepTabs}\tminHeight={140}`,
    `${deepTabs}/>`,
    `${innerTabs})}`,
    `${tabs}</div>`,
  ];

  // Replace lines from labelLineIdx to closeLabelIdx inclusive with the collapsible block
  const removed = lines.splice(labelLineIdx, closeLabelIdx - labelLineIdx + 1, ...collapsibleBlock);
  console.log(`✅ Replaced block at line ${startIdx + 1} (${removed.length} lines → ${collapsibleBlock.length} lines)`);
  return true;
}

// Find all occurrences - we need to iterate carefully since splice shifts indices
let found = 0;
let i = 0;
while (i < lines.length) {
  const trimmed = lines[i].trim();
  if (trimmed === '{renderVariantSection(editingProduct.id)}') {
    // Check next non-empty line is <label>
    let nextNonEmpty = -1;
    for (let k = i + 1; k < Math.min(i + 5, lines.length); k++) {
      if (lines[k].trim().length > 0) {
        nextNonEmpty = k;
        break;
      }
    }
    if (nextNonEmpty >= 0 && lines[nextNonEmpty].trim() === '<label>') {
      // Check next non-empty after that is Descripción
      let descLine = -1;
      for (let k = nextNonEmpty + 1; k < Math.min(nextNonEmpty + 5, lines.length); k++) {
        if (lines[k].trim().length > 0) {
          descLine = k;
          break;
        }
      }
      if (descLine >= 0 && lines[descLine].trim() === 'Descripción') {
        // Make sure the RichTextEditor uses editingProduct.description (product-level, not variant-level)
        let rteLine = -1;
        for (let k = descLine + 1; k < Math.min(descLine + 5, lines.length); k++) {
          if (lines[k].trim().startsWith('<RichTextEditor')) {
            rteLine = k;
            break;
          }
        }
        if (rteLine >= 0) {
          // Check if this RTE uses editingProduct.description (product) vs editingVariant.description (variant)
          let valueLine = -1;
          for (let k = rteLine; k < Math.min(rteLine + 4, lines.length); k++) {
            if (lines[k].includes('value={editingProduct.description}')) {
              valueLine = k;
              break;
            }
          }
          if (valueLine >= 0) {
            // This is a product-level description block - replace it!
            if (replaceBlock(i)) {
              found++;
              // After splice, re-check from the same index (which now has the collapsible)
              i++;
              continue;
            }
          }
        }
      }
    }
  }
  i++;
}

console.log(`Total: ${found} block(s) replaced`);

content = lines.join(NL);
fs.writeFileSync(filePath, content, 'utf8');
console.log('✅ Done');
