// Compiles family.txt (the indented source of truth) into src/data/family.json.
// Runs automatically before `npm run dev` / `npm run build`; the line format is described at parseLines().
import fs from "node:fs";
import path from "node:path";

const ROOT = path.dirname(import.meta.dirname);

// Kazakh Cyrillic -> Latin, used to build readable ids
const TRANSLIT_MAP = {
  'а': 'a', 'ә': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'ғ': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo', 'ж': 'zh',
  'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'қ': 'q', 'л': 'l', 'м': 'm', 'н': 'n', 'ң': 'n', 'о': 'o',
  'ө': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ұ': 'u', 'ү': 'u', 'ф': 'f', 'х': 'kh',
  'һ': 'h', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'shch', 'ы': 'y', 'і': 'i', 'э': 'e', 'ю': 'yu', 'я': 'ya',
};

function slugify(text) {
  if (!text) return "";
  const chars = [...text.toLowerCase()].map((char) => {
    if (TRANSLIT_MAP[char] !== undefined) return TRANSLIT_MAP[char];
    if (/[a-z0-9]/.test(char)) return char;
    return /[ _-]/.test(char) ? "-" : "";
  });
  return chars.join("").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

const ATTR_KEYWORDS = ["id", "lastName", "gender", "spouseOf", "motherId", "fatherId", "birthday", "notes"];
// A keyword only counts at the start of the list or right after a comma, so free
// text such as `notes: gender: unknown` stays inside the notes value.
const ATTR_KEY_REGEX = new RegExp(`(?:^|,)\\s*(${ATTR_KEYWORDS.join("|")})\\s*:`, "g");

/** Parses `key: value, key: value` into an object; a value runs until the next keyword. */
function parseAttrs(attrsStr) {
  const res = {};
  if (!attrsStr) return res;

  const matches = [...attrsStr.matchAll(ATTR_KEY_REGEX)];
  matches.forEach((m, i) => {
    const end = i + 1 < matches.length ? matches[i + 1].index : attrsStr.length;
    res[m[1]] = attrsStr.slice(m.index + m[0].length, end).trim();
  });
  return res;
}

/** Splits `Name [attrs]` into the name and its parsed attributes. */
function parseEntry(text) {
  const bracket = text.match(/\[([^\]]+)\]/);
  if (!bracket) return { name: text.trim(), attrs: {} };
  return { name: text.slice(0, bracket.index).trim(), attrs: parseAttrs(bracket[1].trim()) };
}

/**
 * Checks the compiled nodes for problems that would break the tree at runtime.
 * Returns a list of human-readable error messages (empty when valid).
 */
function validateNodes(nodes) {
  const errors = [];
  const byId = new Map();

  for (const node of nodes) {
    if (byId.has(node.id)) {
      errors.push(`Duplicate id "${node.id}" (${byId.get(node.id).name} and ${node.name})`);
    } else {
      byId.set(node.id, node);
    }
  }

  for (const node of nodes) {
    for (const key of ["fatherId", "motherId", "spouseOf"]) {
      if (node[key] && !byId.has(node[key])) {
        errors.push(`"${node.id}" has ${key} "${node[key]}", which does not exist`);
      }
      if (node[key] && node[key] === node.id) {
        errors.push(`"${node.id}" references itself as ${key}`);
      }
    }
    if (node.gender && !["male", "female"].includes(node.gender)) {
      errors.push(`"${node.id}" has unknown gender "${node.gender}" (use male or female)`);
    }
    if (node.birthday && !/^\d{4}(-\d{2}(-\d{2})?)?$/.test(node.birthday)) {
      errors.push(`"${node.id}" has birthday "${node.birthday}" (use YYYY, YYYY-MM or YYYY-MM-DD)`);
    }
  }

  // Ancestry cycles (someone being their own ancestor) would hang the UI
  const state = new Map(); // id -> "visiting" | "done"
  const visit = (id, path) => {
    if (state.get(id) === "done") return;
    if (state.get(id) === "visiting") {
      errors.push(`Ancestry cycle: ${[...path.slice(path.indexOf(id)), id].join(" -> ")}`);
      return;
    }
    state.set(id, "visiting");
    const node = byId.get(id);
    for (const parentId of [node.fatherId, node.motherId]) {
      if (parentId && byId.has(parentId)) visit(parentId, [...path, id]);
    }
    state.set(id, "done");
  };
  for (const id of byId.keys()) visit(id, []);

  return errors;
}

/** Copies the listed attributes that are present, in order (keeps the JSON key order stable). */
function pick(attrs, keys) {
  return Object.fromEntries(keys.filter((k) => attrs[k] !== undefined).map((k) => [k, attrs[k]]));
}

/**
 * Line format: `- Name [attrs] (spouse: Name [attrs])`. Indentation makes a line
 * the child of the nearest less-indented line above it (its father).
 */
function parseLines(lines) {
  const nodes = [];
  const usedIds = new Set();
  const stack = []; // ancestors of the current line: { indent, node }

  // An explicit `id:` wins; otherwise a slug, suffixed with -2, -3... on collision.
  const assignId = (explicitId, base) => {
    let id = explicitId || base;
    for (let n = 2; !explicitId && usedIds.has(id); n++) id = `${base}-${n}`;
    usedIds.add(id);
    return id;
  };

  lines.forEach((rawLine, i) => {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) return;
    if (!line.startsWith("-")) {
      console.warn(`Warning: Line ${i + 1} does not start with '-' and will be skipped.`);
      return;
    }

    const indent = rawLine.length - rawLine.trimStart().length;
    while (stack.length && stack.at(-1).indent >= indent) stack.pop();
    const father = stack.at(-1)?.node ?? null;

    const spouseMatch = rawLine.match(/\(\s*spouse:\s*([^)]+)\)/);
    const mainText = spouseMatch ? rawLine.replace(spouseMatch[0], "") : rawLine;
    const main = parseEntry(mainText.trim());
    main.name = main.name.replace(/^-/, "").trim();

    const baseId = father ? `${slugify(main.name)}-${slugify(father.name)}` : slugify(main.name);
    const node = {
      name: main.name,
      id: assignId(main.attrs.id, baseId),
      fatherId: father ? father.id : main.attrs.fatherId || null,
      ...pick(main.attrs, ["lastName", "gender", "birthday", "motherId", "spouseOf", "notes"]),
    };
    nodes.push(node);
    stack.push({ indent, node });

    const spouse = spouseMatch && parseEntry(spouseMatch[1]);
    if (spouse?.name) {
      nodes.push({
        name: spouse.name,
        gender: spouse.attrs.gender || "female",
        spouseOf: node.id,
        fatherId: spouse.attrs.fatherId || null,
        id: assignId(spouse.attrs.id, `${slugify(spouse.name)}-${node.id}`),
        ...pick(spouse.attrs, ["lastName", "birthday", "motherId", "notes"]),
      });
    }
  });

  // The mother is filled in only when the father has exactly one wife;
  // with several wives it is ambiguous and must be given as `motherId:`.
  const wivesOf = Map.groupBy(
    nodes.filter((n) => n.spouseOf && n.gender === "female"),
    (n) => n.spouseOf,
  );
  for (const node of nodes) {
    const wives = wivesOf.get(node.fatherId);
    if (node.fatherId && !node.motherId && wives?.length === 1) node.motherId = wives[0].id;
  }

  return nodes;
}

function main(
  txtPath = path.join(ROOT, "family.txt"),
  jsonPath = path.join(ROOT, "src", "data", "family.json"),
) {
  if (!fs.existsSync(txtPath)) throw new Error(`${txtPath} not found.`);

  const nodes = parseLines(fs.readFileSync(txtPath, "utf-8").split(/\r?\n/));

  const errors = validateNodes(nodes);
  if (errors.length > 0) {
    throw new Error(`${txtPath} has ${errors.length} problem(s):\n  - ${errors.join("\n  - ")}`);
  }

  fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
  fs.writeFileSync(jsonPath, JSON.stringify(nodes, null, 2), "utf-8");
  console.log(`Successfully compiled ${nodes.length} nodes to ${jsonPath}`);
}

export { slugify, parseAttrs, validateNodes, main };

// Run when invoked from the command line (not when imported by tests)
if (process.argv[1] === import.meta.filename) {
  try {
    main();
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}
