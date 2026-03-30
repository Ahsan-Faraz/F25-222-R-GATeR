// Knowledge Graph Visualization Component
// Uses SVG-based force-directed graph

import React, { useEffect, useRef, useState } from 'react';
import { getGraphData } from '@/lib/api/knowledge-graph';
import Card from '../ui/Card';
import Button from '../ui/Button';

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

// Color mapping for different entity types
const typeColors: Record<string, string> = {
  function: '#4CAF50',
  method: '#2196F3',
  class: '#9C27B0',
  module: '#FF9800',
  file: '#795548',
  variable: '#607D8B',
  import: '#00BCD4',
  test: '#E91E63',
  unknown: '#9E9E9E',
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
      // Map the response to our visualization format
      // Backend returns: { entities: [...], relationships: [...] }
      // Or could return: { nodes: [...], links: [...] }
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

    // Clear previous content
    const svg = svgRef.current;
    while (svg.firstChild) {
      svg.removeChild(svg.firstChild);
    }

    const width = svg.clientWidth || 800;
    const height = svg.clientHeight || 600;

    // Filter nodes based on type
    const filteredNodes = filterType === 'all' 
      ? graphData.entities 
      : graphData.entities.filter(n => n.type === filterType);
    
    const nodeIds = new Set(filteredNodes.map(n => n.id));
    const filteredLinks = graphData.relationships.filter(
      l => nodeIds.has(l.source) && nodeIds.has(l.target)
    );

    // Limit nodes for performance
    const maxNodes = 100;
    const displayNodes = filteredNodes.slice(0, maxNodes);
    const displayNodeIds = new Set(displayNodes.map(n => n.id));
    const displayLinks = filteredLinks.filter(
      l => displayNodeIds.has(l.source) && displayNodeIds.has(l.target)
    );

    // Create SVG elements
    const svgNS = 'http://www.w3.org/2000/svg';

    // Create defs for arrow markers
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
    path.setAttribute('fill', '#B8E3E9');
    marker.appendChild(path);
    defs.appendChild(marker);
    svg.appendChild(defs);

    // Create groups
    const linksGroup = document.createElementNS(svgNS, 'g');
    linksGroup.setAttribute('class', 'links');
    svg.appendChild(linksGroup);

    const nodesGroup = document.createElementNS(svgNS, 'g');
    nodesGroup.setAttribute('class', 'nodes');
    svg.appendChild(nodesGroup);

    // Create a simple force-directed layout
    // Position nodes in a grid initially
    const nodePositions: Record<string, { x: number; y: number }> = {};
    const cols = Math.ceil(Math.sqrt(displayNodes.length));
    const cellWidth = width / (cols + 1);
    const cellHeight = height / (Math.ceil(displayNodes.length / cols) + 1);

    displayNodes.forEach((node, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      nodePositions[node.id] = {
        x: cellWidth * (col + 1) + (Math.random() - 0.5) * 50,
        y: cellHeight * (row + 1) + (Math.random() - 0.5) * 50,
      };
    });

    // Draw links
    displayLinks.forEach((link) => {
      const sourcePos = nodePositions[link.source];
      const targetPos = nodePositions[link.target];
      if (sourcePos && targetPos) {
        const line = document.createElementNS(svgNS, 'line');
        line.setAttribute('x1', String(sourcePos.x));
        line.setAttribute('y1', String(sourcePos.y));
        line.setAttribute('x2', String(targetPos.x));
        line.setAttribute('y2', String(targetPos.y));
        line.setAttribute('stroke', 'rgba(184, 227, 233, 0.4)');
        line.setAttribute('stroke-opacity', '0.8');
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

      // Circle
      const circle = document.createElementNS(svgNS, 'circle');
      circle.setAttribute('r', '8');
      circle.setAttribute('fill', typeColors[node.type] || typeColors.unknown);
      circle.setAttribute('stroke', '#fff');
      circle.setAttribute('stroke-width', '2');
      group.appendChild(circle);

      // Label
      const text = document.createElementNS(svgNS, 'text');
      text.setAttribute('dx', '12');
      text.setAttribute('dy', '4');
      text.setAttribute('font-size', '10');
      text.setAttribute('fill', '#B8E3E9');
      text.textContent = node.name.length > 15 ? node.name.slice(0, 15) + '...' : node.name;
      group.appendChild(text);

      // Click handler
      group.addEventListener('click', () => {
        setSelectedNode(node);
      });

      nodesGroup.appendChild(group);
    });
  }, [graphData, filterType]);

  // Get unique types for filter
  const entityTypes = graphData 
    ? [...new Set(graphData.entities.map(e => e.type))]
    : [];

  if (loading && !graphData) {
    return (
      <Card title="Knowledge Graph Visualization">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card title="Knowledge Graph Visualization">
        <div className="text-center py-8">
          <p className="text-red-500 mb-4">{error}</p>
          <Button onClick={loadGraphData} size="sm">Retry</Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card title="Knowledge Graph Visualization">
        <div className="space-y-4">
          <p className="text-[#B8E3E9] text-sm">
            Interactive visualization of the code knowledge graph. Click on nodes to see details.
          </p>

          {/* Controls */}
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <label className="block text-sm font-medium text-[#B8E3E9] mb-1">
                Filter by Type
              </label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="bg-[rgba(30,66,74,0.6)] border border-[rgba(184,227,233,0.3)] rounded px-3 py-2 text-[#B8E3E9] focus:border-[#B8E3E9] focus:outline-none"
              >
                <option value="all" className="bg-[#16424a]">All Types</option>
                {entityTypes.map((type) => (
                  <option key={type} value={type} className="bg-[#16424a]">{type}</option>
                ))}
              </select>
            </div>
            
            <div className="flex-1" />
            
            <Button onClick={loadGraphData} size="sm" variant="secondary" loading={loading}>
              🔄 Refresh
            </Button>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-3 text-xs">
            {Object.entries(typeColors).slice(0, 8).map(([type, color]) => (
              <div key={type} className="flex items-center gap-1">
                <div 
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: color }}
                />
                <span className="capitalize text-[#B8E3E9]">{type}</span>
              </div>
            ))}
          </div>

          {/* Graph Container */}
          <div className="border border-[rgba(184,227,233,0.25)] rounded-lg bg-[rgba(11,46,51,0.3)] overflow-hidden">
            <svg
              ref={svgRef}
              width="100%"
              height="500"
              className="bg-[rgba(22,66,74,0.5)]"
            />
          </div>

          {/* Stats */}
          {graphData && (
            <div className="flex gap-4 text-sm text-[#B8E3E9]">
              <span className="text-white font-medium">Nodes: {graphData.entities.length}</span>
              <span className="text-white font-medium">Edges: {graphData.relationships.length}</span>
              <span className="text-[#D4A574]">
                (Showing max 100 nodes for performance)
              </span>
            </div>
          )}
        </div>
      </Card>

      {/* Selected Node Details */}
      {selectedNode && (
        <Card title="Node Details">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div 
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: typeColors[selectedNode.type] || typeColors.unknown }}
              />
              <span className="font-semibold text-lg">{selectedNode.name}</span>
              <span className="text-xs px-2 py-0.5 bg-accent bg-opacity-20 text-accent rounded-full">
                {selectedNode.type}
              </span>
            </div>
            <div className="text-sm text-gray-600 space-y-1">
              <p><strong>ID:</strong> {selectedNode.id}</p>
              {selectedNode.file_path && (
                <p><strong>File:</strong> {selectedNode.file_path}</p>
              )}
              {selectedNode.table && (
                <p><strong>Source:</strong> {selectedNode.table}</p>
              )}
            </div>
            <Button 
              size="sm" 
              variant="secondary" 
              onClick={() => setSelectedNode(null)}
            >
              Close
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
