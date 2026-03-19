import React, { useEffect, useState } from 'react';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';
import type { ToastType } from '@/stores/toast';

interface ToastProps {
  message: string;
  type: ToastType;
  onClose: () => void;
}

const iconMap: Record<ToastType, React.FC<{ className?: string }>> = {
  success: CheckCircle,
  danger: AlertCircle,
  info: Info,
};

const colorMap: Record<ToastType, string> = {
  success: 'text-success border-success/30 bg-success/10',
  danger: 'text-danger border-danger/30 bg-danger/10',
  info: 'text-primary border-primary/30 bg-primary/10',
};

export const Toast: React.FC<ToastProps> = ({ message, type, onClose }) => {
  const [visible, setVisible] = useState(false);
  const Icon = iconMap[type];

  useEffect(() => {
    // Trigger slide-in on mount
    const frame = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onClose, 300);
    }, 4700); // slightly before store removes it
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div
      className={`flex items-center gap-3 border rounded-lg px-4 py-3 shadow-lg backdrop-blur-sm transition-all duration-300 ${colorMap[type]} ${
        visible
          ? 'translate-x-0 opacity-100'
          : 'translate-x-8 opacity-0'
      }`}
    >
      <Icon className="w-5 h-5 shrink-0" />
      <span className="text-sm text-foreground flex-1">{message}</span>
      <button
        onClick={() => {
          setVisible(false);
          setTimeout(onClose, 300);
        }}
        className="text-muted-foreground hover:text-foreground transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
