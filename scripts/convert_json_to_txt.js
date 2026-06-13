import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Transliteration mapping for Kazakh Cyrillic to clean Latin
const TRANSLIT_MAP = {
  'а': 'a', 'ә': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'ғ': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo', 'ж': 'zh',
  'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'қ': 'q', 'л': 'l', 'м': 'm', 'н': 'n', 'ң': 'n', 'о': 'o',
  'ө': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ұ': 'u', 'ү': 'u', 'ф': 'f', 'х': 'kh',
  'һ': 'h', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'shch', 'ы': 'y', 'і': 'i', 'э': 'e', 'ю': 'yu', 'я': 'ya',
};

function slugify(text) {
  if (!text) return "";
  text = text.toLowerCase();
  const res = [];
  for (const char of text) {
    if (TRANSLIT_MAP[char] !== undefined) {
      res.push(TRANSLIT_MAP[char]);
    } else if (/[a-z0-9]/i.test(char)) {
      res.push(char);
    } else if (char === ' ' || char === '-' || char === '_') {
      res.push('-');
    }
  }
  let slug = res.join('');
  slug = slug.replace(/-+/g, '-');
  return slug.replace(/^-+|-+$/g, '');
}

function main() {
  const baseDir = path.dirname(__dirname);
  const jsonPath = path.join(baseDir, "src", "data", "family.json");
  const txtPath = path.join(baseDir, "family.txt");

  if (!fs.existsSync(jsonPath)) {
    console.error(`Error: ${jsonPath} not found.`);
    process.exit(1);
  }

  const rawData = fs.readFileSync(jsonPath, "utf-8");
  const data = JSON.parse(rawData);

  const byOldId = {};
  for (const node of data) {
    byOldId[node.id] = node;
  }

  // Generate readable slug IDs mapping: old_id -> new_slug
  const oldToNewId = {};
  const generatedSlugs = new Set();

  for (const node of data) {
    const nameSlug = slugify(node.name || "");
    
    let fatherNode = null;
    if (node.fatherId) {
      fatherNode = byOldId[node.fatherId];
    }
      
    let spouseNode = null;
    if (node.spouseOf) {
      spouseNode = byOldId[node.spouseOf];
    }

    let baseSlug = "";
    if (fatherNode) {
      const fatherNameSlug = slugify(fatherNode.name || "");
      baseSlug = `${nameSlug}-${fatherNameSlug}`;
    } else if (spouseNode) {
      const spouseNameSlug = slugify(spouseNode.name || "");
      baseSlug = `${nameSlug}-${spouseNameSlug}`;
    } else {
      baseSlug = nameSlug;
    }

    // Ensure uniqueness
    let candidate = baseSlug;
    let counter = 2;
    while (generatedSlugs.has(candidate)) {
      candidate = `${baseSlug}-${counter}`;
      counter++;
    }
    
    generatedSlugs.add(candidate);
    oldToNewId[node.id] = candidate;
  }

  // Update relationships to point to new slug IDs
  const updatedData = [];
  for (const node of data) {
    const newNode = { ...node };
    newNode.id = oldToNewId[node.id];
    if (node.fatherId) {
      newNode.fatherId = oldToNewId[node.fatherId];
    }
    if (node.motherId) {
      newNode.motherId = oldToNewId[node.motherId];
    }
    if (node.spouseOf) {
      newNode.spouseOf = oldToNewId[node.spouseOf];
    }
    updatedData.push(newNode);
  }

  const byNewId = {};
  for (const node of updatedData) {
    byNewId[node.id] = node;
  }

  // Identify children by father
  const childrenByFather = {};
  for (const node of updatedData) {
    if (node.fatherId) {
      if (!childrenByFather[node.fatherId]) {
        childrenByFather[node.fatherId] = [];
      }
      childrenByFather[node.fatherId].push(node);
    }
  }

  // Identify inline spouses: female spouses who have no father in the database
  const inlineSpousesByHusband = {};
  const writtenInlineSpouses = new Set();

  for (const node of updatedData) {
    if (node.spouseOf && !node.fatherId) {
      if (!inlineSpousesByHusband[node.spouseOf]) {
        inlineSpousesByHusband[node.spouseOf] = [];
      }
      inlineSpousesByHusband[node.spouseOf].push(node);
      writtenInlineSpouses.add(node.id);
    }
  }

  // Find root nodes
  const roots = [];
  for (const node of updatedData) {
    if (!node.fatherId && !writtenInlineSpouses.has(node.id)) {
      roots.push(node);
    }
  }

  // Format attributes string
  function formatAttrs(node, excludeKeys = new Set()) {
    const nameSlug = slugify(node.name || "");
    const fatherNode = node.fatherId ? byNewId[node.fatherId] : null;
    const spouseNode = node.spouseOf ? byNewId[node.spouseOf] : null;
    
    let defaultId = "";
    if (fatherNode) {
      defaultId = `${nameSlug}-${slugify(fatherNode.name || "")}`;
    } else if (spouseNode) {
      defaultId = `${nameSlug}-${slugify(spouseNode.name || "")}`;
    } else {
      defaultId = nameSlug;
    }
      
    const parts = [];
    if (node.id !== defaultId && !excludeKeys.has("id")) {
      parts.push(`id: ${node.id}`);
    }
      
    const keys = ["lastName", "gender", "birthday", "motherId", "spouseOf", "notes"];
    for (const key of keys) {
      if (excludeKeys.has(key)) continue;
      
      // Skip redundant motherId (when the mother is the spouse of the father)
      if (key === "motherId" && node.motherId && node.fatherId) {
        const motherNode = byNewId[node.motherId];
        if (motherNode && motherNode.spouseOf === node.fatherId) {
          continue;
        }
      }

      let val = node[key];
      if (val !== undefined && val !== null && val !== "") {
        if (key === "notes") {
          val = val.replace(/\n/g, " ").replace(/\r/g, "");
        }
        parts.push(`${key}: ${val}`);
      }
    }
          
    if (parts.length > 0) {
      return ` [${parts.join(", ")}]`;
    }
    return "";
  }

  const outputLines = [];

  function writeNodeTree(node, depth) {
    const indent = "  ".repeat(depth);
    let line = `${indent}- ${node.name}`;
    
    // Append attributes
    line += formatAttrs(node);
    
    // Append inline spouses
    const spouses = inlineSpousesByHusband[node.id] || [];
    for (const sp of spouses) {
      let spouseStr = ` (spouse: ${sp.name}`;
      const spouseAttrs = formatAttrs(sp, new Set(["spouseOf", "gender"]));
      spouseStr += spouseAttrs + ")";
      line += spouseStr;
    }
      
    outputLines.push(line);
    
    // Recursively write children
    const children = childrenByFather[node.id] || [];
    children.sort((a, b) => (a.birthday || "").localeCompare(b.birthday || ""));
    for (const child of children) {
      writeNodeTree(child, depth + 1);
    }
  }

  // Sort roots by descendant count descending
  const descendantCounts = {};
  function countDescendants(nid) {
    if (descendantCounts[nid] !== undefined) {
      return descendantCounts[nid];
    }
    const children = childrenByFather[nid] || [];
    let count = children.length;
    for (const child of children) {
      count += countDescendants(child.id);
    }
    descendantCounts[nid] = count;
    return count;
  }

  roots.sort((a, b) => countDescendants(b.id) - countDescendants(a.id));

  for (const root of roots) {
    writeNodeTree(root, 0);
  }

  fs.writeFileSync(txtPath, outputLines.join("\n") + "\n", "utf-8");
  console.log(`Successfully converted ${data.length} nodes to ${txtPath}`);
}

main();
