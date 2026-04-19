import json
import uuid
import os

data_path = os.path.join(os.path.dirname(__file__), 'src', 'data', 'family.json')

with open(data_path, 'r', encoding='utf-8') as f:
    data = json.load(f)

id_map = {}

# Create UUIDs for all nodes
for node in data:
    id_map[node['id']] = str(uuid.uuid4())

# Update logic
for node in data:
    node['id'] = id_map[node['id']]
    if 'parentId' in node and node['parentId']:
        node['parentId'] = id_map[node['parentId']]
    if 'spouseOf' in node and node['spouseOf']:
        node['spouseOf'] = id_map[node['spouseOf']]

with open(data_path, 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print('Migration complete')
