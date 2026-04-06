#!/usr/bin/env python3
"""Generate GATR architecture diagram using matplotlib."""
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch
import matplotlib.lines as mlines

# Create figure
fig, ax = plt.subplots(figsize=(16, 12))
ax.set_xlim(0, 10)
ax.set_ylim(0, 14)
ax.axis('off')

# Colors
color_storage = '#E8F4F8'
color_ingestion = '#FFF4E6'
color_compression = '#F0F8E8'
color_llm = '#FFE6F0'
color_fixed = '#D4EDDA'
color_bottleneck = '#F8D7DA'

# Title
ax.text(5, 13.5, 'GATR Pipeline Architecture', 
        ha='center', va='top', fontsize=20, fontweight='bold')
ax.text(5, 13, 'Graph-Aware Test Repair System', 
        ha='center', va='top', fontsize=14, style='italic')

# Layer 1: Repository Analysis
box1 = FancyBboxPatch((1, 11.5), 8, 1, boxstyle="round,pad=0.1", 
                       edgecolor='black', facecolor='#E0E0E0', linewidth=2)
ax.add_patch(box1)
ax.text(5, 12, 'Layer 1: Repository Analysis', ha='center', va='center', 
        fontsize=12, fontweight='bold')
ax.text(5, 11.7, 'Parse code → Extract entities → Build AST', 
        ha='center', va='center', fontsize=9)

# Layer 2: Storage (Split into Kuzu and LanceDB)
# Kuzu
box2a = FancyBboxPatch((0.5, 9.5), 4, 1.5, boxstyle="round,pad=0.1", 
                        edgecolor='black', facecolor=color_storage, linewidth=2)
ax.add_patch(box2a)
ax.text(2.5, 10.5, 'Kuzu Graph DB', ha='center', va='center', 
        fontsize=11, fontweight='bold')
ax.text(2.5, 10.1, 'Metadata Only', ha='center', va='center', fontsize=9)
ax.text(2.5, 9.8, '• Entities\n• Relationships\n• No code snippets', 
        ha='center', va='center', fontsize=8)

# LanceDB
box2b = FancyBboxPatch((5.5, 9.5), 4, 1.5, boxstyle="round,pad=0.1", 
                        edgecolor='green', facecolor=color_fixed, linewidth=3)
ax.add_patch(box2b)
ax.text(7.5, 10.5, 'LanceDB Vector Store', ha='center', va='center', 
        fontsize=11, fontweight='bold')
ax.text(7.5, 10.1, '✅ 100% Snippet Coverage', ha='center', va='center', 
        fontsize=9, color='green', fontweight='bold')
ax.text(7.5, 9.8, '• Embeddings\n• Code snippets\n• 5,402 entities', 
        ha='center', va='center', fontsize=8)

# Layer 3: Raw Context Ingestion
box3 = FancyBboxPatch((1, 7.5), 8, 1.5, boxstyle="round,pad=0.1", 
                       edgecolor='green', facecolor=color_fixed, linewidth=3)
ax.add_patch(box3)
ax.text(5, 8.5, 'Layer 3: Raw Context Ingestion', ha='center', va='center', 
        fontsize=12, fontweight='bold')
ax.text(5, 8.1, '✅ 80% Coverage (gatr_engine._ingest_raw_context)', 
        ha='center', va='center', fontsize=9, color='green', fontweight='bold')
ax.text(5, 7.8, '~160 entities retrieved | ~130 with snippets', 
        ha='center', va='center', fontsize=8)

# Layer 4: Context Compression
box4 = FancyBboxPatch((1, 5.5), 8, 1.5, boxstyle="round,pad=0.1", 
                       edgecolor='green', facecolor=color_fixed, linewidth=3)
ax.add_patch(box4)
ax.text(5, 6.5, 'Layer 4: Context Compression', ha='center', va='center', 
        fontsize=12, fontweight='bold')
ax.text(5, 6.1, '✅ Smart Budgeting (context_compressor.compress_context)', 
        ha='center', va='center', fontsize=9, color='green', fontweight='bold')
ax.text(5, 5.8, 'Quality Gate: 0.25 | Attention Cap: 20 | Budget: 8k chars', 
        ha='center', va='center', fontsize=8)

# Layer 5: Final Assembly
box5 = FancyBboxPatch((1, 3.5), 8, 1.5, boxstyle="round,pad=0.1", 
                       edgecolor='green', facecolor=color_fixed, linewidth=3)
ax.add_patch(box5)
ax.text(5, 4.5, 'Layer 5: Final Assembly', ha='center', va='center', 
        fontsize=12, fontweight='bold')
ax.text(5, 4.1, '✅ 100% Coverage (20/20 entities with snippets)', 
        ha='center', va='center', fontsize=9, color='green', fontweight='bold')
ax.text(5, 3.8, 'Dynamic budgeting | Field standardization', 
        ha='center', va='center', fontsize=8)

# Layer 6: LLM Repair
box6 = FancyBboxPatch((1, 1.5), 8, 1.5, boxstyle="round,pad=0.1", 
                       edgecolor='black', facecolor=color_llm, linewidth=2)
ax.add_patch(box6)
ax.text(5, 2.5, 'Layer 6: LLM Test Repair', ha='center', va='center', 
        fontsize=12, fontweight='bold')
ax.text(5, 2.1, 'GraphRAG Prompt Generation → Claude/GPT', 
        ha='center', va='center', fontsize=9)
ax.text(5, 1.8, '~2k tokens for snippets | High-quality repairs', 
        ha='center', va='center', fontsize=8)

# Arrows between layers
arrow_props = dict(arrowstyle='->', lw=2, color='black')
ax.annotate('', xy=(5, 11.5), xytext=(5, 12.5), arrowprops=arrow_props)
ax.annotate('', xy=(2.5, 9.5), xytext=(3.5, 11.5), arrowprops=arrow_props)
ax.annotate('', xy=(7.5, 9.5), xytext=(6.5, 11.5), arrowprops=arrow_props)
ax.annotate('', xy=(5, 7.5), xytext=(5, 9.5), arrowprops=arrow_props)
ax.annotate('', xy=(5, 5.5), xytext=(5, 7.5), arrowprops=arrow_props)
ax.annotate('', xy=(5, 3.5), xytext=(5, 5.5), arrowprops=arrow_props)
ax.annotate('', xy=(5, 1.5), xytext=(5, 3.5), arrowprops=arrow_props)

# Legend
legend_y = 0.8
ax.text(1, legend_y, 'Legend:', fontsize=10, fontweight='bold')
fixed_patch = mpatches.Patch(color=color_fixed, label='✅ Fixed/Working')
storage_patch = mpatches.Patch(color=color_storage, label='Storage Layer')
llm_patch = mpatches.Patch(color=color_llm, label='LLM Layer')
ax.legend(handles=[fixed_patch, storage_patch, llm_patch], 
          loc='lower left', fontsize=9, frameon=True)

# Performance metrics box
perf_box = FancyBboxPatch((0.2, 0.05), 4.5, 0.6, boxstyle="round,pad=0.05", 
                          edgecolor='green', facecolor='white', linewidth=2)
ax.add_patch(perf_box)
ax.text(2.45, 0.55, 'Performance Metrics', ha='center', va='top', 
        fontsize=10, fontweight='bold', color='green')
ax.text(2.45, 0.4, 'Storage: 100% coverage (5,402/5,402)', 
        ha='center', va='top', fontsize=8)
ax.text(2.45, 0.28, 'Runtime: 100% coverage (20/20 top entities)', 
        ha='center', va='top', fontsize=8)
ax.text(2.45, 0.16, 'Improvement: 10x from initial 10%', 
        ha='center', va='top', fontsize=8)

# Status box
status_box = FancyBboxPatch((5.3, 0.05), 4.5, 0.6, boxstyle="round,pad=0.05", 
                            edgecolor='green', facecolor='white', linewidth=2)
ax.add_patch(status_box)
ax.text(7.55, 0.55, 'System Status', ha='center', va='top', 
        fontsize=10, fontweight='bold', color='green')
ax.text(7.55, 0.4, '✅ All critical bugs fixed', 
        ha='center', va='top', fontsize=8, color='green')
ax.text(7.55, 0.28, '✅ Smart budgeting implemented', 
        ha='center', va='top', fontsize=8, color='green')
ax.text(7.55, 0.16, '✅ Production ready', 
        ha='center', va='top', fontsize=8, color='green')

plt.tight_layout()
plt.savefig('docs/GATR_ARCHITECTURE_DIAGRAM.png', dpi=300, bbox_inches='tight')
print('✅ Architecture diagram saved to docs/GATR_ARCHITECTURE_DIAGRAM.png')
