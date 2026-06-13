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
  // Clean up double hyphens
  slug = slug.replace(/-+/g, '-');
  // Trim leading/trailing hyphens
  return slug.replace(/^-+|-+$/g, '');
}

function parseAttrs(attrsStr) {
  const res = {};
  if (!attrsStr) return res;
  const keywords = ["id", "lastName", "gender", "spouseOf", "motherId", "fatherId", "birthday", "notes"];
  const positions = [];
  
  for (const kw of keywords) {
    const pos = attrsStr.indexOf(kw + ":");
    if (pos !== -1) {
      positions.push({ pos, kw });
    }
  }
  
  positions.sort((a, b) => a.pos - b.pos);
  for (let i = 0; i < positions.length; i++) {
    const { pos, kw } = positions[i];
    const startVal = pos + kw.length + 1;
    const endVal = (i + 1 < positions.length) ? positions[i + 1].pos : attrsStr.length;
    let val = attrsStr.slice(startVal, endVal).trim();
    if (val.endsWith(",")) {
      val = val.slice(0, -1).trim();
    }
    res[kw] = val;
  }
  return res;
}

// Export helpers for testing
export { slugify, parseAttrs, main };

function main(txtPathOverride, jsonPathOverride) {
  const baseDir = path.dirname(__dirname);
  const txtPath = txtPathOverride || path.join(baseDir, "family.txt");
  const jsonPath = jsonPathOverride || path.join(baseDir, "src", "data", "family.json");

  if (!fs.existsSync(txtPath)) {
    console.error(`Error: ${txtPath} not found.`);
    process.exit(1);
  }

  const fileContent = fs.readFileSync(txtPath, "utf-8");
  const lines = fileContent.split(/\r?\n/);

  const nodes = [];
  const generatedIds = new Set();
  const stack = []; // items are { indent, node }

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const lineNum = i + 1;
    const strippedRaw = rawLine.trim();
    
    if (!strippedRaw || strippedRaw.startsWith("#")) {
      continue; // empty line or comment
    }

    // Calculate indentation level (count leading whitespace)
    const indent = rawLine.length - rawLine.trimStart().length;

    // Ensure line starts with a list marker '-'
    if (!strippedRaw.startsWith("-")) {
      console.warn(`Warning: Line ${lineNum} does not start with '-' and will be skipped.`);
      continue;
    }

    // Parse inline spouse if present
    // Format: (spouse: Spouse Name [spouse attrs])
    const spouseRegex = /\(\s*spouse:\s*([^\)]+)\)/;
    const spouseMatch = rawLine.match(spouseRegex);
    let spouseName = null;
    let spouseAttrsStr = null;
    let mainPart = rawLine;

    if (spouseMatch) {
      const spouseFull = spouseMatch[1];
      mainPart = rawLine.slice(0, spouseMatch.index) + rawLine.slice(spouseMatch.index + spouseMatch[0].length);

      // Extract attributes from spouse
      const spBracketMatch = spouseFull.match(/\[([^\]]+)\]/);
      if (spBracketMatch) {
        spouseName = spouseFull.slice(0, spBracketMatch.index).trim();
        spouseAttrsStr = spBracketMatch[1].trim();
      } else {
        spouseName = spouseFull.trim();
        spouseAttrsStr = "";
      }
    }

    // Parse main node name and attributes
    const mainPartStripped = mainPart.trim();
    const bracketMatch = mainPartStripped.match(/\[([^\]]+)\]/);
    let mainName = "";
    let mainAttrsStr = "";
    
    if (bracketMatch) {
      mainName = mainPartStripped.slice(0, bracketMatch.index).trim();
      mainAttrsStr = bracketMatch[1].trim();
    } else {
      mainName = mainPartStripped.trim();
      mainAttrsStr = "";
    }

    // Remove list marker '-' from main name
    if (mainName.startsWith("-")) {
      mainName = mainName.slice(1).trim();
    }

    const mainAttrs = parseAttrs(mainAttrsStr);
    const spouseAttrs = spouseName ? parseAttrs(spouseAttrsStr) : {};

    // Resolve parent (father) using stack
    // Pop everything with indentation >= current line's indentation
    while (stack.length > 0 && stack[stack.length - 1].indent >= indent) {
      stack.pop();
    }

    const father = stack.length > 0 ? stack[stack.length - 1].node : null;

    // Build main node dictionary
    const mainNode = {
      name: mainName
    };
    
    // Determine ID
    let mainId = "";
    if (mainAttrs.id) {
      mainId = mainAttrs.id;
    } else {
      const nameSlug = slugify(mainName);
      let baseSlug = "";
      if (father) {
        const fatherSlug = slugify(father.name);
        baseSlug = `${nameSlug}-${fatherSlug}`;
      } else {
        baseSlug = nameSlug;
      }
      
      // Resolve collisions
      let candidate = baseSlug;
      let counter = 2;
      while (generatedIds.has(candidate)) {
        candidate = `${baseSlug}-${counter}`;
        counter++;
      }
      mainId = candidate;
    }

    generatedIds.add(mainId);
    mainNode.id = mainId;

    // Set father relation
    if (father) {
      mainNode.fatherId = father.id;
    } else {
      mainNode.fatherId = mainAttrs.fatherId || null;
    }

    // Merge other attributes
    const mainKeys = ["lastName", "gender", "birthday", "motherId", "spouseOf", "notes"];
    for (const key of mainKeys) {
      if (mainAttrs[key] !== undefined) {
        mainNode[key] = mainAttrs[key];
      }
    }

    nodes.push(mainNode);

    // Push main node to stack for potential children
    stack.push({ indent, node: mainNode });

    // Add inline spouse if present
    if (spouseName) {
      const spouseNode = {
        name: spouseName,
        gender: spouseAttrs.gender || "female",
        spouseOf: mainNode.id,
        fatherId: spouseAttrs.fatherId || null
      };
      
      // Determine spouse ID
      let spouseId = "";
      if (spouseAttrs.id) {
        spouseId = spouseAttrs.id;
      } else {
        const spouseSlug = slugify(spouseName);
        const baseSlug = `${spouseSlug}-${mainNode.id}`;
        
        let candidate = baseSlug;
        let counter = 2;
        while (generatedIds.has(candidate)) {
          candidate = `${baseSlug}-${counter}`;
          counter++;
        }
        spouseId = candidate;
      }

      generatedIds.add(spouseId);
      spouseNode.id = spouseId;

      // Merge other spouse attributes
      const spouseKeys = ["lastName", "birthday", "motherId", "notes"];
      for (const key of spouseKeys) {
        if (spouseAttrs[key] !== undefined) {
          spouseNode[key] = spouseAttrs[key];
        }
      }

      nodes.push(spouseNode);
    }
  }

  // Second pass: automatically resolve motherId for children
  for (const node of nodes) {
    if (node.fatherId && !node.motherId) {
      // Find the female spouse of the father
      const mother = nodes.find(n => n.spouseOf === node.fatherId && n.gender === "female");
      if (mother) {
        node.motherId = mother.id;
      }
    }
  }

  // Ensure output directory exists
  const outputDir = path.dirname(jsonPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(jsonPath, JSON.stringify(nodes, null, 2), "utf-8");
  console.log(`Successfully compiled ${nodes.length} nodes to ${jsonPath}`);
}

// Execute compiler if run directly from the command line
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
