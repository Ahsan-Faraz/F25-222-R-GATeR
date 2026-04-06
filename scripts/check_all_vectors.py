"""Check all vectors in LanceDB for snippet coverage"""
import lancedb
import pandas as pd

db = lancedb.connect('workspace/lancedb')
table = db.open_table('code_entity_embeddings')
df = table.to_pandas()

print('=' * 60)
print('LanceDB Vector & Snippet Coverage Report')
print('=' * 60)

total = len(df)
with_snippets = (df['code_snippet'].str.len() > 20).sum()
empty_snippets = (df['code_snippet'].str.len() == 0).sum()
coverage = (with_snippets / total * 100) if total > 0 else 0

print(f'\nTotal vectors: {total}')
print(f'Vectors with snippets (>20 chars): {with_snippets}')
print(f'Vectors with empty snippets: {empty_snippets}')
print(f'Coverage: {coverage:.1f}%')

print('\nSnippet length statistics:')
print(df['code_snippet'].str.len().describe())

print('\nSample of first 20 entities:')
for i, row in df.head(20).iterrows():
    snippet_len = len(str(row['code_snippet']))
    status = '✅' if snippet_len > 20 else '❌'
    print(f'{status} {row["entity_name"]:30} ({row["entity_type"]:15}): {snippet_len:4} chars')

print('\n' + '=' * 60)
if coverage >= 80:
    print(f'✅ SUCCESS: {coverage:.1f}% coverage (expected ≥80%)')
else:
    print(f'❌ FAILURE: Only {coverage:.1f}% coverage (expected ≥80%)')
print('=' * 60)
