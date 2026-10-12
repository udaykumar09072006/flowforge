import React, { useState } from 'react';
import {
  Search,
  Plus,
  PlayCircle,
  Webhook,
  Clock,
  GitFork,
  Split,
  Filter,
  GitMerge,
  Hourglass,
  Globe,
  Mail,
  Database,
  FileText,
  Variable,
  Shuffle,
  Code,
  Type,
  Calendar,
  CheckCircle,
} from 'lucide-react';
import { NodeCategory, NodeType } from '../../types/workflow';
import { NODE_DEFINITIONS, CATEGORY_COLORS } from '../../shared/nodeRegistry';

const ICON_MAP: Record<string, React.FC<{ className?: string }>> = {
  PlayCircle,
  Webhook,
  Clock,
  GitFork,
  Split,
  Filter,
  GitMerge,
  Hourglass,
  Globe,
  Mail,
  Database,
  FileText,
  Variable,
  Shuffle,
  Code,
  Type,
  Calendar,
  CheckCircle,
};

interface NodePaletteProps {
  onAddNode: (type: NodeType) => void;
}

export const NodePalette: React.FC<NodePaletteProps> = ({ onAddNode }) => {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const categories: { id: string; label: string }[] = [
    { id: 'all', label: 'All Nodes' },
    { id: 'trigger', label: 'Triggers' },
    { id: 'logic', label: 'Logic' },
    { id: 'action', label: 'Actions' },
    { id: 'utility', label: 'Utilities' },
  ];

  const filteredNodes = Object.values(NODE_DEFINITIONS).filter((def) => {
    const matchesCategory = selectedCategory === 'all' || def.category === selectedCategory;
    const searchLower = (search || '').toLowerCase().trim();
    const matchesSearch =
      !searchLower ||
      (def.name || '').toLowerCase().includes(searchLower) ||
      (def.description || '').toLowerCase().includes(searchLower);
    return matchesCategory && matchesSearch;
  });

  const handleDragStart = (event: React.DragEvent, nodeType: NodeType) => {
    event.dataTransfer.setData('application/flowforge-nodetype', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <aside className="w-72 h-full border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col z-10 select-none">
      {/* Header & Search */}
      <div className="p-3 border-b border-slate-200 dark:border-slate-800 space-y-2.5">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
            Node Library
          </h3>
          <span className="text-[10px] text-slate-500">{filteredNodes.length} available</span>
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search triggers, logic, actions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full text-xs pl-8 pr-3 py-1.5 rounded-md bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {/* Category Pills / Filter bar (Interactive buttons) */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 no-scrollbar">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-2 py-0.5 text-[11px] font-medium rounded transition-colors whitespace-nowrap cursor-pointer ${
                selectedCategory === cat.id
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Nodes List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {filteredNodes.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-400">
            No matching nodes found.
          </div>
        ) : (
          filteredNodes.map((def) => {
            const colors = CATEGORY_COLORS[def.category] || CATEGORY_COLORS.action;
            const Icon = ICON_MAP[def.icon] || CheckCircle;

            return (
              <div
                key={def.type}
                draggable
                onDragStart={(e) => handleDragStart(e, def.type)}
                onClick={() => onAddNode(def.type)}
                className="group p-2.5 rounded-lg border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-sm cursor-grab active:cursor-grabbing transition-all flex items-start gap-2.5"
              >
                <div className={`p-1.5 rounded-md ${colors.bg} ${colors.text} shrink-0 mt-0.5`}>
                  <Icon className="w-4 h-4" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <h4 className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                      {def.name}
                    </h4>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onAddNode(def.type);
                      }}
                      title="Add to canvas"
                      className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-indigo-600 transition-opacity"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5">
                    {def.description}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer hint */}
      <div className="p-2.5 border-t border-slate-200 dark:border-slate-800 text-[10px] text-slate-400 text-center bg-slate-50 dark:bg-slate-950/40">
        Drag to canvas or click to insert
      </div>
    </aside>
  );
};
