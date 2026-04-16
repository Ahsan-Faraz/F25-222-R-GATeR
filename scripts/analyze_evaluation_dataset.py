#!/usr/bin/env python3
"""Analyze the evaluation dataset to count repositories and samples."""
import json
from collections import Counter

# Load the dataset
with open('evaluation/real_edit_subset_1207.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

# Extract repository names
repos = [key.split(':')[0] for key in data.keys()]
repo_counts = Counter(repos)

# Print statistics
print(f'Total samples: {len(data)}')
print(f'Unique repositories: {len(repo_counts)}')
print(f'\nRepository breakdown:')
for repo, count in sorted(repo_counts.items(), key=lambda x: x[1], reverse=True):
    print(f'  {repo}: {count} samples')

# Count GATR results
gater_success = sum(1 for v in data.values() if v.get('gater_success', False))
gater_pass = sum(1 for v in data.values() if v.get('gater_pass', False))

print(f'\nGATER Performance:')
print(f'  Successful repairs: {gater_success}/{len(data)} ({gater_success/len(data)*100:.1f}%)')
print(f'  Passing tests: {gater_pass}/{len(data)} ({gater_pass/len(data)*100:.1f}%)')
