import React, { useState } from 'react';
import {
  TrendingUp,
  Minus,
  GitBranch,
  Square,
  Type,
  Trash2,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { useToastStore } from '@/stores/toast';

interface DrawingTool {
  id: string;
  label: string;
  icon: React.ElementType;
  isClear?: boolean;
}

const tools: DrawingTool[] = [
  { id: 'trendline', label: 'Trendline', icon: TrendingUp },
  { id: 'hline', label: 'Horizontal Line', icon: Minus },
  { id: 'fibonacci', label: 'Fibonacci Retracement', icon: GitBranch },
  { id: 'rectangle', label: 'Rectangle', icon: Square },
  { id: 'text', label: 'Text Note', icon: Type },
  { id: 'clear', label: 'Clear All', icon: Trash2, isClear: true },
];

export const DrawingToolbar: React.FC<{ className?: string }> = ({ className }) => {
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const addToast = useToastStore((s) => s.addToast);

  const handleClick = (tool: DrawingTool) => {
    if (tool.isClear) {
      setActiveTool(null);
      addToast('Drawings cleared', 'info');
      return;
    }

    if (activeTool === tool.id) {
      setActiveTool(null);
    } else {
      setActiveTool(tool.id);
      addToast('Drawing tools coming in next update', 'info');
    }
  };

  return (
    <div
      className={cn(
        'flex flex-col gap-1 p-1.5 bg-card border border-border rounded-xl',
        className
      )}
    >
      {tools.map((tool) => {
        const Icon = tool.icon;
        const isActive = activeTool === tool.id;
        return (
          <button
            key={tool.id}
            title={tool.label}
            onClick={() => handleClick(tool)}
            className={cn(
              'flex items-center justify-center w-9 h-9 rounded-lg transition-all duration-150',
              tool.isClear
                ? 'text-muted-foreground hover:text-danger hover:bg-danger/10'
                : isActive
                  ? 'bg-primary/15 text-primary border border-primary/25'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
            )}
          >
            <Icon className="w-4 h-4" />
          </button>
        );
      })}
    </div>
  );
};
