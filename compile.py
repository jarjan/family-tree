import json
import os
import re

# Transliteration mapping for Kazakh Cyrillic to clean Latin
TRANSLIT_MAP = {
    'а': 'a', 'ә': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'ғ': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo', 'ж': 'zh',
    'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'қ': 'q', 'л': 'l', 'м': 'm', 'н': 'n', 'ң': 'n', 'о': 'o',
    'ө': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ұ': 'u', 'ү': 'u', 'ф': 'f', 'х': 'kh',
    'һ': 'h', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'shch', 'ы': 'y', 'і': 'i', 'э': 'e', 'ю': 'yu', 'я': 'ya',
}

def slugify(text):
    if not text:
        return ""
    text = text.lower()
    res = []
    for char in text:
        if char in TRANSLIT_MAP:
            res.append(TRANSLIT_MAP[char])
        elif char.isalnum():
            res.append(char)
        elif char in (' ', '-', '_'):
            res.append('-')
    slug = "".join(res)
    # clean up double hyphens
    slug = re.sub(r'-+', '-', slug)
    return slug.strip('-')

def parse_attrs(attrs_str):
    res = {}
    if not attrs_str:
        return res
    keywords = ["id", "lastName", "gender", "spouseOf", "motherId", "fatherId", "birthday", "notes"]
    positions = []
    for kw in keywords:
        pos = attrs_str.find(kw + ":")
        if pos != -1:
            positions.append((pos, kw))
            
    positions.sort()
    for i in range(len(positions)):
        pos, kw = positions[i]
        start_val = pos + len(kw) + 1
        end_val = positions[i+1][0] if i+1 < len(positions) else len(attrs_str)
        val = attrs_str[start_val:end_val].strip()
        if val.endswith(","):
            val = val[:-1].strip()
        res[kw] = val
    return res

def main():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    txt_path = os.path.join(base_dir, "family.txt")
    json_path = os.path.join(base_dir, "src", "data", "family.json")

    if not os.path.exists(txt_path):
        print(f"Error: {txt_path} not found.")
        return

    with open(txt_path, "r", encoding="utf-8") as f:
        lines = f.readlines()

    nodes = []
    generated_ids = set()
    stack = []  # items are tuple: (indentation_level, node_dict)

    for line_num, raw_line in enumerate(lines, 1):
        stripped_raw = raw_line.strip()
        if not stripped_raw or stripped_raw.startswith("#"):
            continue  # empty line or comment

        # Calculate indentation level (count leading whitespace)
        indent = len(raw_line) - len(raw_line.lstrip())

        # Ensure line starts with a list marker '-'
        if not stripped_raw.startswith("-"):
            print(f"Warning: Line {line_num} does not start with '-' and will be skipped.")
            continue

        # Parse inline spouse if present
        # Format: (spouse: Spouse Name [spouse attrs])
        spouse_match = re.search(r'\(\s*spouse:\s*([^\)]+)\)', raw_line)
        spouse_name = None
        spouse_attrs_str = None
        if spouse_match:
            spouse_full = spouse_match.group(1)
            # Remove spouse part from the raw line for main parsing
            main_part = raw_line[:spouse_match.start()] + raw_line[spouse_match.end():]
            
            # Extract attributes from spouse
            sp_bracket_match = re.search(r'\[([^\]]+)\]', spouse_full)
            if sp_bracket_match:
                spouse_name = spouse_full[:sp_bracket_match.start()].strip()
                spouse_attrs_str = sp_bracket_match.group(1).strip()
            else:
                spouse_name = spouse_full.strip()
                spouse_attrs_str = ""
        else:
            main_part = raw_line

        # Parse main node name and attributes
        main_part_stripped = main_part.strip()
        bracket_match = re.search(r'\[([^\]]+)\]', main_part_stripped)
        if bracket_match:
            main_name = main_part_stripped[:bracket_match.start()].strip()
            main_attrs_str = bracket_match.group(1).strip()
        else:
            main_name = main_part_stripped.strip()
            main_attrs_str = ""

        # Remove list marker '-' from main name
        if main_name.startswith("-"):
            main_name = main_name[1:].strip()

        # Parse attributes
        main_attrs = parse_attrs(main_attrs_str)
        spouse_attrs = parse_attrs(spouse_attrs_str) if spouse_name else {}

        # Resolve parent (father) using stack
        # Pop everything with indentation >= current line's indentation
        while stack and stack[-1][0] >= indent:
            stack.pop()

        father = stack[-1][1] if stack else None

        # Build main node dictionary
        main_node = {
            "name": main_name
        }
        
        # Determine ID
        if "id" in main_attrs:
            main_id = main_attrs["id"]
        else:
            name_slug = slugify(main_name)
            if father:
                father_slug = slugify(father["name"])
                base_slug = f"{name_slug}-{father_slug}"
            else:
                base_slug = name_slug
            
            # Resolve collisions
            candidate = base_slug
            counter = 2
            while candidate in generated_ids:
                candidate = f"{base_slug}-{counter}"
                counter += 1
            main_id = candidate

        generated_ids.add(main_id)
        main_node["id"] = main_id

        # Set father relation
        if father:
            main_node["fatherId"] = father["id"]
        else:
            main_node["fatherId"] = main_attrs.get("fatherId", None)  # fallback if explicitly set

        # Merge other attributes
        for key in ["lastName", "gender", "birthday", "motherId", "spouseOf", "notes"]:
            if key in main_attrs:
                main_node[key] = main_attrs[key]

        nodes.append(main_node)

        # Push main node to stack for potential children
        stack.append((indent, main_node))

        # Add inline spouse if present
        if spouse_name:
            spouse_node = {
                "name": spouse_name,
                "gender": spouse_attrs.get("gender", "female"),
                "spouseOf": main_node["id"],
                "fatherId": spouse_attrs.get("fatherId", None)  # inline spouses usually don't have fatherId, but support just in case
            }
            
            # Determine spouse ID
            if "id" in spouse_attrs:
                spouse_id = spouse_attrs["id"]
            else:
                spouse_slug = slugify(spouse_name)
                base_slug = f"{spouse_slug}-{main_node['id']}"
                
                candidate = base_slug
                counter = 2
                while candidate in generated_ids:
                    candidate = f"{base_slug}-{counter}"
                    counter += 1
                spouse_id = candidate

            generated_ids.add(spouse_id)
            spouse_node["id"] = spouse_id

            # Merge other spouse attributes
            for key in ["lastName", "birthday", "motherId", "notes"]:
                if key in spouse_attrs:
                    spouse_node[key] = spouse_attrs[key]

            nodes.append(spouse_node)

    # Save to src/data/family.json
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(nodes, f, ensure_ascii=False, indent=2)

    print(f"Successfully compiled {len(nodes)} nodes to {json_path}")

if __name__ == "__main__":
    main()
