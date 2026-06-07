import json
import os
import re
from collections import defaultdict

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

def main():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    json_path = os.path.join(base_dir, "src", "data", "family.json")
    txt_path = os.path.join(base_dir, "family.txt")

    if not os.path.exists(json_path):
        print(f"Error: {json_path} not found.")
        return

    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    by_old_id = {node["id"]: node for node in data}

    # Generate readable slug IDs mapping: old_id -> new_slug
    old_to_new_id = {}
    generated_slugs = set()

    for node in data:
        name_slug = slugify(node.get("name", ""))
        
        father_node = None
        if "fatherId" in node and node["fatherId"]:
            father_node = by_old_id.get(node["fatherId"])
            
        spouse_node = None
        if "spouseOf" in node and node["spouseOf"]:
            spouse_node = by_old_id.get(node["spouseOf"])

        if father_node:
            father_name_slug = slugify(father_node.get("name", ""))
            base_slug = f"{name_slug}-{father_name_slug}"
        elif spouse_node:
            spouse_name_slug = slugify(spouse_node.get("name", ""))
            base_slug = f"{name_slug}-{spouse_name_slug}"
        else:
            base_slug = name_slug

        # Ensure uniqueness
        candidate = base_slug
        counter = 2
        while candidate in generated_slugs:
            candidate = f"{base_slug}-{counter}"
            counter += 1
        
        generated_slugs.add(candidate)
        old_to_new_id[node["id"]] = candidate

    # Update relationships to point to new slug IDs
    updated_data = []
    for node in data:
        new_node = node.copy()
        new_node["id"] = old_to_new_id[node["id"]]
        if "fatherId" in node and node["fatherId"]:
            new_node["fatherId"] = old_to_new_id.get(node["fatherId"])
        if "motherId" in node and node["motherId"]:
            new_node["motherId"] = old_to_new_id.get(node["motherId"])
        if "spouseOf" in node and node["spouseOf"]:
            new_node["spouseOf"] = old_to_new_id.get(node["spouseOf"])
        updated_data.append(new_node)

    by_new_id = {node["id"]: node for node in updated_data}

    # Identify children by father
    children_by_father = defaultdict(list)
    for node in updated_data:
        if node.get("fatherId"):
            children_by_father[node["fatherId"]].append(node)

    # Identify inline spouses: female spouses who have no father in the database
    # These will be printed on the same line as their husband.
    inline_spouses_by_husband = defaultdict(list)
    written_inline_spouses = set()

    for node in updated_data:
        if node.get("spouseOf") and not node.get("fatherId"):
            inline_spouses_by_husband[node["spouseOf"]].append(node)
            written_inline_spouses.add(node["id"])

    # Find root nodes: nodes with no father and not written inline
    roots = []
    for node in updated_data:
        if not node.get("fatherId") and node["id"] not in written_inline_spouses:
            roots.append(node)

    # Format attributes string
    def format_attrs(node, exclude_keys=None):
        if exclude_keys is None:
            exclude_keys = set()
        
        # Determine default ID
        name_slug = slugify(node.get("name", ""))
        father_node = by_new_id.get(node.get("fatherId")) if node.get("fatherId") else None
        spouse_node = by_new_id.get(node.get("spouseOf")) if node.get("spouseOf") else None
        
        if father_node:
            default_id = f"{name_slug}-{slugify(father_node.get('name', ''))}"
        elif spouse_node:
            default_id = f"{name_slug}-{slugify(spouse_node.get('name', ''))}"
        else:
            default_id = name_slug
            
        parts = []
        # Only output id if it deviates from the default slug pattern
        if node["id"] != default_id and "id" not in exclude_keys:
            parts.append(f"id: {node['id']}")
            
        for key in ["lastName", "gender", "birthday", "motherId", "spouseOf", "notes"]:
            if key in exclude_keys:
                continue
            val = node.get(key)
            if val is not None and val != "":
                # Clean notes of newlines
                if key == "notes":
                    val = val.replace("\n", " ").replace("\r", "")
                parts.append(f"{key}: {val}")
                
        if parts:
            return f" [{', '.join(parts)}]"
        return ""

    output_lines = []

    def write_node_tree(node, depth):
        indent = "  " * depth
        line = f"{indent}- {node['name']}"
        
        # Append attributes
        line += format_attrs(node)
        
        # Append inline spouses if any
        spouses = inline_spouses_by_husband.get(node["id"], [])
        for sp in spouses:
            spouse_str = f" (spouse: {sp['name']}"
            spouse_attrs = format_attrs(sp, exclude_keys={"spouseOf", "gender"})  # gender is implicitly female
            spouse_str += spouse_attrs + ")"
            line += spouse_str
            
        output_lines.append(line)
        
        # Recursively write children
        children = children_by_father.get(node["id"], [])
        # Sort children by birthday or index to keep consistent structure
        children.sort(key=lambda x: x.get("birthday", ""))
        for child in children:
            write_node_tree(child, depth + 1)

    # Sort roots: put the main shezhire root first (usually Кіші жүз or the one with most descendants)
    # To identify the main tree, we can count the size of each tree
    descendant_counts = {}
    def count_descendants(nid):
        if nid in descendant_counts:
            return descendant_counts[nid]
        count = len(children_by_father[nid])
        for child in children_by_father[nid]:
            count += count_descendants(child["id"])
        descendant_counts[nid] = count
        return count

    roots.sort(key=lambda r: count_descendants(r["id"]), reverse=True)

    for root in roots:
        write_node_tree(root, 0)

    with open(txt_path, "w", encoding="utf-8") as f:
        f.write("\n".join(output_lines) + "\n")

    print(f"Successfully converted {len(data)} nodes to {txt_path}")
    print(f"Mapped {len(old_to_new_id)} old IDs to readable slugs.")

if __name__ == "__main__":
    main()
