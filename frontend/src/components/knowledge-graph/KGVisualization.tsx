// Knowledge Graph Visualization — Stitch `f4c8da3312714034ab88ee4239785620`

import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { getGraphData } from '@/lib/api/knowledge-graph';
import Button from '../ui/Button';
import MaterialIcon from '../ui/MaterialIcon';
import { RefreshCw, X } from 'lucide-react';

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

const typeColors: Record<string, string> = {
  function: '#c3f5ff',
  method: '#c3f5ff',
  class: '#cdbdff',
  module: '#ffc948',
  file: '#71717a',
  variable: '#71717a',
  import: '#00daf3',
  test: '#ffb4ab',
  unknown: '#52525b',
};

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

type LayoutMode = 'force' | 'grid' | 'tree';

function computePositions(
  displayNodes: VisualizationNode[],
  displayLinks: VisualizationLink[],
  width: number,
  height: number,
  layoutMode: LayoutMode
): Record<string, { x: number; y: number }> {
  const out: Record<string, { x: number; y: number }> = {};
  if (displayNodes.length === 0) return out;

  if (layoutMode === 'grid') {
    const cols = Math.ceil(Math.sqrt(displayNodes.length));
    const cellW = width / (cols + 1);
    const cellH = height / (Math.ceil(displayNodes.length / cols) + 1);
    displayNodes.forEach((node, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      out[node.id] = {
        x: cellW * (col + 1) + (Math.random() - 0.5) * 20,
        y: cellH * (row + 1) + (Math.random() - 0.5) * 20,
      };
    });
    return out;
  }

  if (layoutMode === 'tree') {
    displayNodes.forEach((node, i) => {
      const angle = (i / Math.max(displayNodes.length, 1)) * Math.PI * 2;
      const r = Math.min(width, height) * 0.32;
      out[node.id] = {
        x: width / 2 + Math.cos(angle) * r * (0.4 + (i % 4) * 0.15),
        y: height / 2 + Math.sin(angle) * r * (0.4 + (i % 4) * 0.15),
      };
    });
    return out;
  }

  const simNodes = displayNodes.map((n) => ({ ...n })) as any[];
  const linkObjs = displayLinks.map((l) => ({ source: l.source, target: l.target }));

  const sim = d3
    .forceSimulation(simNodes)
    .force(
      'link',
      d3
        .forceLink(linkObjs)
        .id((d: any) => d.id)
        .distance(48)
    )
    .force('charge', d3.forceManyBody().strength(-90))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('collision', d3.forceCollide().radius(10));

  for (let i = 0; i < 350; i++) sim.tick();
  sim.stop();

  simNodes.forEach((n: any) => {
    out[n.id] = { x: n.x ?? width / 2, y: n.y ?? height / 2 };
  });
  return out;
}

export default function KGVisualization() {
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const nodePositionsRef = useRef<Record<string, { x: number; y: number }>>({});

  const [graphData, setGraphData] = useState<VisualizationData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<VisualizationNode | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('force');

  const loadGraphData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = (await getGraphData()) as any;
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
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    zoomBehaviorRef.current = null;

    const width = svg.clientWidth || 800;
    const height = 520;

    const filteredNodes =
      filterType === 'all' ? graphData.entities : graphData.entities.filter((n) => n.type === filterType);
    const nodeIds = new Set(filteredNodes.map((n) => n.id));
    const filteredLinks = graphData.relationships.filter(
      (l) => nodeIds.has(l.source) && nodeIds.has(l.target)
    );

    const maxNodes = 120;
    const displayNodes = filteredNodes.slice(0, maxNodes);
    const displayNodeIds = new Set(displayNodes.map((n) => n.id));
    const displayLinks = filteredLinks.filter(
      (l) => displayNodeIds.has(l.source) && displayNodeIds.has(l.target)
    );

    const positions = computePositions(displayNodes, displayLinks, width, height, layoutMode);
    nodePositionsRef.current = { ...positions };

    const svgNS = 'http://www.w3.org/2000/svg';

    const defs = document.createElementNS(svgNS, 'defs');
    const grad = document.createElementNS(svgNS, 'linearGradient');
    grad.setAttribute('id', 'edge-grad');
    grad.setAttribute('x1', '0%');
    grad.setAttribute('x2', '100%');
    grad.setAttribute('y1', '0%');
    grad.setAttribute('y2', '0%');
    ['0%', '50%', '100%'].forEach((off, i) => {
      const stop = document.createElementNS(svgNS, 'stop');
      stop.setAttribute('offset', off);
      stop.setAttribute('stop-color', '#00daf3');
      stop.setAttribute('stop-opacity', i === 1 ? '0.45' : '0');
      grad.appendChild(stop);
    });
    defs.appendChild(grad);

    const marker = document.createElementNS(svgNS, 'marker');
    marker.setAttribute('id', 'arrowhead');
    marker.setAttribute('viewBox', '-0 -5 10 10');
    marker.setAttribute('refX', '16');
    marker.setAttribute('refY', '0');
    marker.setAttribute('orient', 'auto');
    marker.setAttribute('markerWidth', '5');
    marker.setAttribute('markerHeight', '5');
    const path = document.createElementNS(svgNS, 'path');
    path.setAttribute('d', 'M 0,-5 L 10,0 L 0,5');
    path.setAttribute('fill', '#849396');
    marker.appendChild(path);
    defs.appendChild(marker);
    svg.appendChild(defs);

    const zoomLayer = document.createElementNS(svgNS, 'g');
    zoomLayer.setAttribute('class', 'kg-zoom-layer');

    const bgRect = document.createElementNS(svgNS, 'rect');
    bgRect.setAttribute('width', String(width));
    bgRect.setAttribute('height', String(height));
    bgRect.setAttribute('fill', 'transparent');
    bgRect.setAttribute('pointer-events', 'all');
    bgRect.style.cursor = 'grab';
    zoomLayer.appendChild(bgRect);

    const linksGroup = document.createElementNS(svgNS, 'g');
    linksGroup.setAttribute('class', 'links');
    zoomLayer.appendChild(linksGroup);

    const lineBindings: Array<{ link: VisualizationLink; el: SVGLineElement }> = [];

    const updateLines = () => {
      const pos = nodePositionsRef.current;
      lineBindings.forEach(({ link, el }) => {
        const s = pos[link.source];
        const t = pos[link.target];
        if (!s || !t) return;
        el.setAttribute('x1', String(s.x));
        el.setAttribute('y1', String(s.y));
        el.setAttribute('x2', String(t.x));
        el.setAttribute('y2', String(t.y));
      });
    };

    displayLinks.forEach((link) => {
      const s = nodePositionsRef.current[link.source];
      const t = nodePositionsRef.current[link.target];
      if (!s || !t) return;
      const line = document.createElementNS(svgNS, 'line');
      line.setAttribute('x1', String(s.x));
      line.setAttribute('y1', String(s.y));
      line.setAttribute('x2', String(t.x));
      line.setAttribute('y2', String(t.y));
      line.setAttribute('stroke', 'url(#edge-grad)');
      line.setAttribute('stroke-opacity', '0.55');
      line.setAttribute('stroke-width', '1.2');
      line.setAttribute('stroke-dasharray', '6 4');
      line.setAttribute('pointer-events', 'none');
      linksGroup.appendChild(line);
      lineBindings.push({ link, el: line });
    });

    const nodesGroup = document.createElementNS(svgNS, 'g');
    nodesGroup.setAttribute('class', 'nodes');
    zoomLayer.appendChild(nodesGroup);

    svg.appendChild(zoomLayer);

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.25, 5])
      .filter((event) => {
        if (event.type === 'wheel' || event.type === 'dblclick') return true;
        const t = event.target as Element | null;
        if (t?.closest?.('[data-kg-node]')) return false;
        return true;
      })
      .on('zoom', (event) => {
        zoomLayer.setAttribute('transform', event.transform.toString());
      });

    zoomBehaviorRef.current = zoom;
    d3.select(svg).call(zoom);

    let dragMoved = false;
    const drag = d3
      .drag<SVGGElement, VisualizationNode>()
      .on('start', function () {
        dragMoved = false;
        d3.select(this).raise();
      })
      .on('drag', function (event, d) {
        if (event.dx !== 0 || event.dy !== 0) dragMoved = true;
        const k = d3.zoomTransform(svg).k;
        const pos = nodePositionsRef.current[d.id];
        if (!pos) return;
        pos.x += event.dx / k;
        pos.y += event.dy / k;
        d3.select(this).attr('transform', `translate(${pos.x}, ${pos.y})`);
        updateLines();
      })
      .on('end', function (_event, d) {
        if (!dragMoved) setSelectedNode(d);
        dragMoved = false;
      });

    displayNodes.forEach((node) => {
      const pos = nodePositionsRef.current[node.id];
      if (!pos) return;

      const group = document.createElementNS(svgNS, 'g');
      group.setAttribute('data-kg-node', node.id);
      group.setAttribute('transform', `translate(${pos.x}, ${pos.y})`);
      group.style.cursor = 'grab';

      const shape = typeShapes[node.type] || 'circle';
      const color = typeColors[node.type] || typeColors.unknown;

      if (shape === 'circle') {
        const circle = document.createElementNS(svgNS, 'circle');
        circle.setAttribute('r', '7');
        circle.setAttribute('fill', color);
        circle.setAttribute('stroke', '#131315');
        circle.setAttribute('stroke-width', '2');
        group.appendChild(circle);
      } else {
        const rect = document.createElementNS(svgNS, 'rect');
        rect.setAttribute('x', '-7');
        rect.setAttribute('y', '-7');
        rect.setAttribute('width', '14');
        rect.setAttribute('height', '14');
        rect.setAttribute('rx', '2');
        rect.setAttribute('fill', color);
        rect.setAttribute('stroke', '#131315');
        rect.setAttribute('stroke-width', '2');
        group.appendChild(rect);
      }

      const text = document.createElementNS(svgNS, 'text');
      text.setAttribute('dx', '12');
      text.setAttribute('dy', '4');
      text.setAttribute('font-size', '9');
      text.setAttribute('font-family', 'JetBrains Mono, monospace');
      text.setAttribute('fill', '#bac9cc');
      text.setAttribute('pointer-events', 'none');
      text.textContent = node.name.length > 14 ? node.name.slice(0, 14) + '…' : node.name;
      group.appendChild(text);

      group.addEventListener('mouseenter', () => {
        (group.querySelector('circle, rect') as SVGElement)?.setAttribute('stroke', '#c3f5ff');
        (group.querySelector('text') as SVGElement)?.setAttribute('fill', '#e5e1e3');
      });
      group.addEventListener('mouseleave', () => {
        (group.querySelector('circle, rect') as SVGElement)?.setAttribute('stroke', '#131315');
        (group.querySelector('text') as SVGElement)?.setAttribute('fill', '#bac9cc');
      });

      d3.select(group).datum(node).call(drag);

      nodesGroup.appendChild(group);
    });

    return () => {
      d3.select(svg).on('.zoom', null);
    };
  }, [graphData, filterType, layoutMode]);

  const handleZoomIn = useCallback(() => {
    const el = svgRef.current;
    const z = zoomBehaviorRef.current;
    if (!el || !z) return;
    d3.select(el).transition().duration(200).call(z.scaleBy, 1.25);
  }, []);

  const handleZoomOut = useCallback(() => {
    const el = svgRef.current;
    const z = zoomBehaviorRef.current;
    if (!el || !z) return;
    d3.select(el).transition().duration(200).call(z.scaleBy, 1 / 1.25);
  }, []);

  const handleRecenter = useCallback(() => {
    const el = svgRef.current;
    const z = zoomBehaviorRef.current;
    if (!el || !z) return;
    d3.select(el).transition().duration(300).call(z.transform, d3.zoomIdentity);
  }, []);

  const entityTypes = graphData ? [...new Set(graphData.entities.map((e) => e.type))] : [];

  const legendItems = [
    { key: 'function', label: 'Function / method', color: typeColors.function, shape: 'circle' as const },
    { key: 'class', label: 'Class / module', color: typeColors.class, shape: 'square' as const },
    { key: 'test', label: 'Test', color: typeColors.test, shape: 'circle' as const },
  ];

  const panelOpen = !!selectedNode;

  if (loading && !graphData) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="glass-panel rounded-lg border border-outline-variant/15 p-4">
          <div className="skeleton h-10 rounded-lg max-w-md" />
        </div>
        <div className="relative rounded-lg border border-outline-variant/10 bg-surface-container-lowest overflow-hidden min-h-[520px]">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(195,245,255,0.06),transparent_55%)]" />
          <div className="skeleton h-full min-h-[520px] rounded-lg" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-outline-variant/15 bg-surface-container-low p-8 text-center">
        <MaterialIcon name="error" className="text-error mb-3 !text-[32px]" />
        <p className="text-sm text-on-error-container mb-4 font-mono">{error}</p>
        <Button onClick={loadGraphData} size="sm" variant="ghost">
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="glass-panel rounded-lg border border-outline-variant/15 px-4 py-3 md:px-6 md:py-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex items-center gap-3">
              <MaterialIcon name="tune" className="text-on-surface-variant shrink-0" />
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-mono uppercase tracking-widest text-on-surface-variant/50">
                  Entity filter
                </span>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="ghost-input py-2.5 px-3 w-full sm:w-56 text-sm text-on-surface bg-surface-container-low"
                >
                  <option value="all">All types</option>
                  {entityTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="hidden sm:flex items-center gap-6 pl-0 lg:pl-4 lg:border-l border-outline-variant/15">
              {legendItems.map((item) => (
                <div key={item.key} className="flex items-center gap-2">
                  {item.shape === 'circle' ? (
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0 ring-1 ring-outline-variant/20"
                      style={{ backgroundColor: item.color }}
                    />
                  ) : (
                    <span
                      className="w-2.5 h-2.5 rounded-sm shrink-0 ring-1 ring-outline-variant/20"
                      style={{ backgroundColor: item.color }}
                    />
                  )}
                  <span className="text-[10px] uppercase tracking-widest text-on-surface-variant/60 font-mono">
                    {item.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <Button
            onClick={loadGraphData}
            size="sm"
            variant="ghost"
            loading={loading}
            className="shrink-0 border-outline-variant/20"
            icon={<RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />}
          >
            Refresh graph
          </Button>
        </div>
      </div>

      <div
        className={`relative rounded-lg border border-outline-variant/10 bg-surface-container-lowest overflow-hidden min-h-[520px] touch-none ${
          panelOpen ? 'lg:pr-96' : ''
        }`}
      >
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(0,229,255,0.07),transparent_50%)]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage: `linear-gradient(#3b494c 1px, transparent 1px), linear-gradient(90deg, #3b494c 1px, transparent 1px)`,
            backgroundSize: '40px 40px',
          }}
          aria-hidden
        />

        <svg
          ref={svgRef}
          width="100%"
          height="520"
          className="relative z-[2] block select-none"
          role="img"
          aria-label="Knowledge graph"
        />

        <div className="absolute top-4 left-4 z-[3] flex items-center gap-2 bg-surface-container-lowest/85 px-3 py-1.5 rounded border border-outline-variant/20 text-[10px] font-mono text-on-surface-variant">
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          RENDER: SVG + D3 · {layoutMode.toUpperCase()} · drag nodes · wheel / buttons zoom · drag bg pan
        </div>

        {graphData && (
          <div className="absolute bottom-4 left-4 z-[3] glass-panel rounded-lg border border-outline-variant/15 px-4 py-2.5">
            <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-tighter text-primary/90">
              <span className="w-2 h-2 rounded-full bg-primary shadow-[0_0_8px_rgba(195,245,255,0.45)]" />
              <span>
                Nodes <span className="text-on-surface">{graphData.entities.length}</span>
              </span>
              <span className="text-outline-variant/40">·</span>
              <span>
                Edges <span className="text-on-surface">{graphData.relationships.length}</span>
              </span>
            </div>
          </div>
        )}

        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-[4] flex items-center gap-3 bg-surface-variant/60 backdrop-blur-xl px-4 py-2 rounded-xl border border-outline-variant/30 shadow-2xl max-w-[95vw] flex-wrap justify-center">
          <div className="flex items-center border-r border-outline-variant/20 pr-3 gap-1">
            <button
              type="button"
              onClick={handleZoomIn}
              className="p-2 hover:bg-surface-bright rounded transition-colors text-on-surface-variant hover:text-primary"
              aria-label="Zoom in"
            >
              <MaterialIcon name="zoom_in" />
            </button>
            <button
              type="button"
              onClick={handleZoomOut}
              className="p-2 hover:bg-surface-bright rounded transition-colors text-on-surface-variant hover:text-primary"
              aria-label="Zoom out"
            >
              <MaterialIcon name="zoom_out" />
            </button>
            <button
              type="button"
              onClick={handleRecenter}
              className="p-2 hover:bg-surface-bright rounded transition-colors text-on-surface-variant hover:text-primary"
              aria-label="Recenter"
            >
              <MaterialIcon name="center_focus_strong" />
            </button>
          </div>
          <div className="flex items-center border-r border-outline-variant/20 pr-3 gap-2 px-1">
            <span className="text-[10px] uppercase font-bold text-on-surface-variant/60 tracking-wider">Layout</span>
            {(['force', 'tree', 'grid'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setLayoutMode(m)}
                className={`px-2 py-1 text-[10px] font-bold rounded border ${
                  layoutMode === m
                    ? 'bg-primary/20 text-primary border-primary/30'
                    : 'text-on-surface-variant border-transparent hover:bg-surface-bright'
                }`}
              >
                {m.toUpperCase()}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="flex items-center gap-2 px-3 py-1.5 hover:bg-surface-bright rounded transition-colors text-on-surface-variant text-xs font-medium"
          >
            <MaterialIcon name="filter_alt" className="!text-sm" />
            Filters
          </button>
        </div>

        {panelOpen && selectedNode && (
          <aside className="absolute right-0 top-0 bottom-0 w-full max-w-[384px] z-[5] bg-surface-container-lowest/95 border-l border-outline-variant/20 shadow-2xl flex flex-col backdrop-blur-sm">
            <div className="p-6 flex flex-col h-full min-h-0 overflow-hidden">
              <div className="flex items-center justify-between mb-6 shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 bg-primary/10 rounded flex items-center justify-center border border-primary/20 shrink-0">
                    <MaterialIcon name="terminal" className="text-primary" filled />
                  </div>
                  <div className="min-w-0">
                    <h2 className="font-headline font-bold text-lg text-primary leading-tight truncate">
                      {selectedNode.name}
                    </h2>
                    <p className="text-xs text-on-surface-variant">{selectedNode.type}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedNode(null)}
                  className="text-on-surface-variant hover:text-on-surface shrink-0 p-1"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-4 flex-1 overflow-y-auto custom-scrollbar pr-1">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-surface-container-low rounded border border-outline-variant/10">
                    <p className="text-[10px] text-on-surface-variant uppercase font-bold mb-1 opacity-60">ID</p>
                    <p className="text-sm font-mono text-secondary truncate">{selectedNode.id}</p>
                  </div>
                  <div className="p-3 bg-surface-container-low rounded border border-outline-variant/10">
                    <p className="text-[10px] text-on-surface-variant uppercase font-bold mb-1 opacity-60">Type</p>
                    <p className="text-sm font-headline font-bold text-tertiary">{selectedNode.type}</p>
                  </div>
                </div>
                {selectedNode.file_path && (
                  <div>
                    <p className="text-[10px] text-on-surface-variant uppercase font-bold mb-2 tracking-widest">File Path</p>
                    <p className="text-xs font-mono bg-surface-container px-3 py-2 rounded border border-outline-variant/10 break-all text-on-surface/80">
                      {selectedNode.file_path}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
