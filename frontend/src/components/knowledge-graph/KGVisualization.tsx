// Knowledge Graph Visualization Component - Minimalist-Futurism Design

import React, { useEffect, useRef, useState } from 'react';
import { getGraphData } from '@/lib/api/knowledge-graph';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { RefreshCw, X, Filter, Circle, Square, Triangle } from 'lucide-react';

interface VisualizationNode {
  id: string;
  name: string;
  type: string;
  file_path?: string;
  table?: string;
}

interface VisualizationLink {
  source: string;
  target: string;
  type: string;
}

interface VisualizationData {
  entities: VisualizationNode[];
  relationships: VisualizationLink[];
}

// Minimalist color mapping - using accent colors sparingly
const typeColors: Record<string, string> = {
  function: '#3b82f6', // Blue
  method: '#3b82f6',
  class: '#a855f7',    // Purple
  module: '#f59e0b',   // Amber
  file: '#71717a',     // Zinc
  variable: '#71717a',
  import: '#06b6d4',   // Cyan
  test: '#ec4899',     // Pink
  unknown: '#52525b',
};

// Shape mapping - circles for functions, squares for classes
const typeShapes: Record<string, 'circle' | 'rect'> = {
  function: 'circle',
  method: 'circle',
  class: 'rect',
  module: 'rect',
  file: 'rect',
  variable: 'circle',
  import: 'circle',
  test: 'circle',
  unknown: 'circle',
};

export default function KGVisualization() {
  const svgRef = useRef<SVGSVGElement>(null);
  const [graphData, setGraphData] = useState<VisualizationData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<VisualizationNode | null>(null);
  const [filterType, setFilterType] = useState<string>('all');

  const loadGraphData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getGraphData() as any;
      const vizData: VisualizationData = {
        entities: data.entities || data.nodes || [],
        relationships: data.relationships || data.links || [],
      };
      setGraphData(vizData);
    } catch (err: any) {
      setError(err.message || 'Failed to load graph data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGraphData();
  }, []);

  useEffect(() => {
    if (!graphData || !svgRef.current) return;

    const svg = svgRef.current;
    while (svg.firstChild) {
      svg.removeChild(svg.firstChild);
    }

    const width = svg.clientWidth || 800;
    const height = svg.clientHeight || 500;

    const filteredNodes = filterType === 'all' 
      ? graphData.entities 
      : graphData.entities.filter(n => n.type === filterType);
    
    const nodeIds = new Set(filteredNodes.map(n => n.id));
    const filteredLinks = graphData.relationships.filter(
      l => nodeIds.has(l.source) && nodeIds.has(l.target)
    );

    const maxNodes = 100;
    const displayNodes = filteredNodes.slice(0, maxNodes);
    const displayNodeIds = new Set(displayNodes.map(n => n.id));
    const displayLinks = filteredLinks.filter(
      l => displayNodeIds.has(l.source) && displayNodeIds.has(l.target)
    );

    const svgNS = 'http://www.w3.org/2000/svg';

    // Defs for arrow markers
    const defs = document.createElementNS(svgNS, 'defs');
    const marker = document.createElementNS(svgNS, 'marker');
    marker.setAttribute('id', 'arrowhead');
    marker.setAttribute('viewBox', '-0 -5 10 10');
    marker.setAttribute('refX', '20');
    marker.setAttribute('refY', '0');
    marker.setAttribute('orient', 'auto');
    marker.setAttribute('markerWidth', '6');
    marker.setAttribute('markerHeight', '6');
    const path = document.createElementNS(svgNS, 'path');
    path.setAttribute('d', 'M 0,-5 L 10,0 L 0,5');
    path.setAttribute('fill', '#3f3f46'); // Zinc-700
    marker.appendChild(path);
    defs.appendChild(marker);
    svg.appendChild(defs);

    // Groups
    const linksGroup = document.createElementNS(svgNS, 'g');
    linksGroup.setAttribute('class', 'links');
    svg.appendChild(linksGroup);

    const nodesGroup = document.createElementNS(svgNS, 'g');
    nodesGroup.setAttribute('class', 'nodes');
    svg.appendChild(nodesGroup);

    // Position nodes in a grid
    const nodePositions: Record<string, { x: number; y: number }> = {};
    const cols = Math.ceil(Math.sqrt(displayNodes.length));
    const cellWidth = width / (cols + 1);
    const cellHeight = height / (Math.ceil(displayNodes.length / cols) + 1);

    displayNodes.forEach((node, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      nodePositions[node.id] = {
        x: cellWidth * (col + 1) + (Math.random() - 0.5) * 30,
        y: cellHeight * (row + 1) + (Math.random() - 0.5) * 30,
      };
    });

    // Draw links - subtle, nearly invisible until hover
    displayLinks.forEach((link) => {
      const sourcePos = nodePositions[link.source];
      const targetPos = nodePositions[link.target];
      if (sourcePos && targetPos) {
        const line = document.createElementNS(svgNS, 'line');
        line.setAttribute('x1', String(sourcePos.x));
        line.setAttribute('y1', String(sourcePos.y));
        line.setAttribute('x2', String(targetPos.x));
        line.setAttribute('y2', String(targetPos.y));
        line.setAttribute('stroke', '#27272a'); // border color
        line.setAttribute('stroke-width', '1');
        line.setAttribute('marker-end', 'url(#arrowhead)');
        linksGroup.appendChild(line);
      }
    });

    // Draw nodes
    displayNodes.forEach((node) => {
      const pos = nodePositions[node.id];
      if (!pos) return;

      const group = document.createElementNS(svgNS, 'g');
      group.setAttribute('transform', `translate(${pos.x}, ${pos.y})`);
      group.style.cursor = 'pointer';

      const shape = typeShapes[node.type] || 'circle';
      const color = typeColors[node.type] || typeColors.unknown;

      if (shape === 'circle') {
        const circle = document.createElementNS(svgNS, 'circle');
        circle.setAttribute('r', '6');
        circle.setAttribute('fill', color);
        circle.setAttribute('stroke', '#09090b');
        circle.setAttribute('stroke-width', '2');
        group.appendChild(circle);
      } else {
        const rect = document.createElementNS(svgNS, 'rect');
        rect.setAttribute('x', '-6');
        rect.setAttribute('y', '-6');
        rect.setAttribute('width', '12');
        rect.setAttribute('height', '12');
        rect.setAttribute('fill', color);
        rect.setAttribute('stroke', '#09090b');
        rect.setAttribute('stroke-width', '2');
        group.appendChild(rect);
      }

      // Label
      const text = document.createElementNS(svgNS, 'text');
      text.setAttribute('dx', '10');
      text.setAttribute('dy', '4');
      text.setAttribute('font-size', '10');
      text.setAttribute('font-family', 'JetBrains Mono, monospace');
      text.setAttribute('fill', '#a1a1aa'); // text-secondary
      text.textContent = node.name.length > 12 ? node.name.slice(0, 12) + '…' : node.name;
      group.appendChild(text);

      group.addEventListener('click', () => {
        setSelectedNode(node);
      });

      // Hover effect
      group.addEventListener('mouseenter', () => {
        (group.querySelector('circle, rect') as SVGElement)?.setAttribute('stroke', '#fafafa');
        (group.querySelector('text') as SVGElement)?.setAttribute('fill', '#fafafa');
      });
      group.addEventListener('mouseleave', () => {
        (group.querySelector('circle, rect') as SVGElement)?.setAttribute('stroke', '#09090b');
        (group.querySelector('text') as SVGElement)?.setAttribute('fill', '#a1a1aa');
      });

      nodesGroup.appendChild(group);
    });
  }, [graphData, filterType]);

  const entityTypes = graphData 
    ? [...new Set(graphData.entities.map(e => e.type))]
    : [];

  if (loading && !graphData) {
    return (
      <Card title="Knowledge Graph">
        <div className="space-y-3">
          <div className="skeleton h-12 rounded-md" />
          <div className="skeleton h-[500px] rounded-md" />
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card title="Knowledge Graph">
        <div className="text-center py-8">
          <p className="text-red-400 mb-4 text-sm">{error}</p>
          <Button onClick={loadGraphData} size="sm" variant="ghost">Retry</Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <Card>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-text-muted" />
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="ghost-input py-2 px-3 w-auto"
              >
                <option value="all">All Types</option>
                {entityTypes.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
            
            {/* Legend */}
            <div className="hidden md:flex items-center gap-4 text-xs text-text-muted">
              <div className="flex items-center gap-1.5">
                <Circle className="w-3 h-3 text-accent fill-current" />
                <span>Function</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Square className="w-3 h-3 text-purple-500 fill-current" />
                <span>Class</span>
              </div>
            </div>
          </div>
          
          <Button 
            onClick={loadGraphData} 
            size="sm" 
            variant="ghost" 
            loading={loading}
            icon={<RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />}
          >
            Refresh
          </Button>
        </div>
      </Card>

      {/* Graph Canvas */}
      <Card noPadding>
        <div className="relative">
          <svg
            ref={svgRef}
            width="100%"
            height="500"
            className="bg-bg-zinc"
          />
          
          {/* Stats overlay */}
          {graphData && (
            <div className="absolute bottom-4 left-4 flex items-center gap-4 text-xs font-mono text-text-muted">
              <span>NODES: <span className="text-text-primary">{graphData.entities.length}</span></span>
              <span className="text-border">|</span>
              <span>EDGES: <span className="text-text-primary">{graphData.relationships.length}</span></span>
            </div>
          )}
        </div>
      </Card>

      {/* Selected Node Details */}
      {selectedNode && (
        <Card>
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div 
                  className={`w-3 h-3 ${typeShapes[selectedNode.type] === 'rect' ? 'rounded-sm' : 'rounded-full'}`}
                  style={{ backgroundColor: typeColors[selectedNode.type] || typeColors.unknown }}
                />
                <span className="font-mono font-medium text-text-primary">{selectedNode.name}</span>
                <span className="text-xs px-2 py-0.5 bg-surface border border-border text-text-secondary rounded">
                  {selectedNode.type}
                </span>
              </div>
              <div className="text-sm text-text-muted space-y-1 font-mono">
                <p><span className="text-text-secondary">ID:</span> {selectedNode.id}</p>
                {selectedNode.file_path && (
                  <p><span className="text-text-secondary">File:</span> {selectedNode.file_path}</p>
                )}
              </div>
            </div>
            <button 
              onClick={() => setSelectedNode(null)}
              className="text-text-muted hover:text-text-primary transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </Card>
      )}
    </div>
  );
}
