"""
Audit Vector Database Snippet Coverage
Checks how many entities in LanceDB have actual code snippets
"""

import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from src.vector_storage.lance_manager import LanceManager
import json

def audit_lancedb_snippets():
    """Audit LanceDB to check snippet coverage"""
    
    print("\n" + "="*80)
    print("VECTOR DATABASE SNIPPET COVERAGE AUDIT")
    print("="*80)
    
    # Initialize LanceDB
    lancedb_path = "workspace/lancedb"
    lance_manager = LanceManager(lancedb_path)
    
    # Get the table
    table = lance_manager.get_table("code_entity_embeddings")
    
    if not table:
        print("\n❌ ERROR: LanceDB table 'code_entity_embeddings' not found!")
        return
    
    print(f"\n✅ Found LanceDB table at: {lancedb_path}")
    
    # Get all entities
    all_entities = table.to_pandas()
    total_entities = len(all_entities)
    
    print(f"\n📊 Total Entities in LanceDB: {total_entities}")
    
    # Check snippet coverage
    entities_with_snippets = 0
    entities_without_snippets = 0
    snippet_lengths = []
    entities_with_metadata_text = 0
    
    print("\n🔍 Analyzing snippet content...")
    
    for idx, row in all_entities.iterrows():
        entity_name = row.get('entity_name', 'unknown')
        entity_type = row.get('entity_type', 'unknown')
        code_snippet = row.get('code_snippet', '')
        
        if code_snippet and len(code_snippet) > 0:
            entities_with_snippets += 1
            snippet_lengths.append(len(code_snippet))
            
            # Check if it's actual code or just metadata text
            # Metadata text looks like: "ClassName class /path/to/file.java"
            if entity_type in code_snippet and '/' in code_snippet and len(code_snippet) < 200:
                entities_with_metadata_text += 1
                if idx < 5:  # Show first 5 examples
                    print(f"\n⚠️  Metadata Text Example:")
                    print(f"   Entity: {entity_name} ({entity_type})")
                    print(f"   Snippet: {code_snippet[:100]}")
        else:
            entities_without_snippets += 1
            if entities_without_snippets <= 5:  # Show first 5 examples
                print(f"\n❌ Missing Snippet:")
                print(f"   Entity: {entity_name} ({entity_type})")
    
    # Calculate statistics
    coverage_percent = (entities_with_snippets / total_entities * 100) if total_entities > 0 else 0
    actual_code_percent = ((entities_with_snippets - entities_with_metadata_text) / total_entities * 100) if total_entities > 0 else 0
    
    avg_snippet_length = sum(snippet_lengths) / len(snippet_lengths) if snippet_lengths else 0
    
    print("\n" + "="*80)
    print("RESULTS")
    print("="*80)
    
    print(f"\n📈 Coverage Statistics:")
    print(f"   Total Entities:              {total_entities}")
    print(f"   With Snippets:               {entities_with_snippets} ({coverage_percent:.2f}%)")
    print(f"   Without Snippets:            {entities_without_snippets} ({100-coverage_percent:.2f}%)")
    print(f"   With Metadata Text (Bug 0):  {entities_with_metadata_text} ({entities_with_metadata_text/total_entities*100:.2f}%)")
    print(f"   With Actual Code:            {entities_with_snippets - entities_with_metadata_text} ({actual_code_percent:.2f}%)")
    
    print(f"\n📏 Snippet Length Statistics:")
    print(f"   Average Length:              {avg_snippet_length:.0f} chars")
    if snippet_lengths:
        print(f"   Min Length:                  {min(snippet_lengths)} chars")
        print(f"   Max Length:                  {max(snippet_lengths)} chars")
    
    # Verdict
    print("\n" + "="*80)
    print("VERDICT")
    print("="*80)
    
    if actual_code_percent >= 80:
        print("\n✅ EXCELLENT: >80% entities have actual code snippets")
    elif actual_code_percent >= 50:
        print("\n⚠️  GOOD: 50-80% entities have actual code snippets")
    elif actual_code_percent >= 20:
        print("\n⚠️  POOR: 20-50% entities have actual code snippets")
    else:
        print("\n❌ CRITICAL: <20% entities have actual code snippets")
    
    if entities_with_metadata_text > 0:
        print(f"\n⚠️  WARNING: {entities_with_metadata_text} entities have metadata text instead of code (Bug 0 not fully fixed)")
        print("   This means the code snippet extraction during ingestion is not working properly.")
        print("   You need to re-run the ingestion pipeline with the Bug 0 fix.")
    
    # Sample some entities with good snippets
    print("\n" + "="*80)
    print("SAMPLE ENTITIES WITH CODE SNIPPETS")
    print("="*80)
    
    good_snippets = []
    for idx, row in all_entities.iterrows():
        code_snippet = row.get('code_snippet', '')
        entity_name = row.get('entity_name', 'unknown')
        entity_type = row.get('entity_type', 'unknown')
        
        # Look for actual code (has braces, semicolons, etc.)
        if code_snippet and len(code_snippet) > 100 and ('{' in code_snippet or ';' in code_snippet):
            good_snippets.append({
                'name': entity_name,
                'type': entity_type,
                'snippet': code_snippet[:200]
            })
            if len(good_snippets) >= 3:
                break
    
    if good_snippets:
        for i, entity in enumerate(good_snippets, 1):
            print(f"\n{i}. {entity['name']} ({entity['type']})")
            print(f"   {entity['snippet']}...")
    else:
        print("\n❌ No entities found with actual code snippets!")
    
    # Save detailed report
    report = {
        'total_entities': total_entities,
        'entities_with_snippets': entities_with_snippets,
        'entities_without_snippets': entities_without_snippets,
        'entities_with_metadata_text': entities_with_metadata_text,
        'entities_with_actual_code': entities_with_snippets - entities_with_metadata_text,
        'coverage_percent': coverage_percent,
        'actual_code_percent': actual_code_percent,
        'avg_snippet_length': avg_snippet_length
    }
    
    with open('workspace/data/lancedb_snippet_audit.json', 'w') as f:
        json.dump(report, f, indent=2)
    
    print(f"\n💾 Detailed report saved to: workspace/data/lancedb_snippet_audit.json")
    print("\n" + "="*80)

if __name__ == '__main__':
    try:
        audit_lancedb_snippets()
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
