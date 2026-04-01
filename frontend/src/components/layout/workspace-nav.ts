/** Stitch sidebar labels + Material Symbol names (project 11940742516565365524) */
export const WORKSPACE_NAV_ITEMS = [
  { id: 'repo', label: 'Repository', icon: 'folder_open' as const },
  { id: 'kg', label: 'Knowledge Graph', icon: 'hub' as const },
  { id: 'kgvis', label: 'Visualization', icon: 'monitoring' as const },
  { id: 'kgcompass', label: 'KGCompass', icon: 'explore' as const },
  { id: 'kuzu', label: 'KUZU DB', icon: 'database' as const },
  { id: 'vectors', label: 'Vector Search', icon: 'manage_search' as const },
  { id: 'gatr', label: 'Test Repair', icon: 'build' as const },
  { id: 'export', label: 'Export', icon: 'download' as const },
] as const;

export type WorkspaceSectionId = (typeof WORKSPACE_NAV_ITEMS)[number]['id'];
