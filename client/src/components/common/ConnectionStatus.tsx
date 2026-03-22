import React, { useEffect, useState } from 'react';
import { onConnectionStatus, type ConnectionStatus as Status } from '@/services/socket';
import { cn } from '@/utils/cn';

const STATUS_CONFIG: Record<Status, { color: string; label: string; pulse: boolean }> = {
  connected: { color: 'bg-success', label: 'Live', pulse: false },
  connecting: { color: 'bg-primary', label: 'Connecting...', pulse: true },
  reconnecting: { color: 'bg-warning', label: 'Reconnecting...', pulse: true },
  disconnected: { color: 'bg-danger', label: 'Offline', pulse: false },
};

export const ConnectionStatus: React.FC = () => {
  const [status, setStatus] = useState<Status>('disconnected');

  useEffect(() => {
    return onConnectionStatus(setStatus);
  }, []);

  const config = STATUS_CONFIG[status];

  return (
    <div className="flex items-center gap-1.5" title={`WebSocket: ${status}`}>
      <span className={cn('w-2 h-2 rounded-full', config.color, config.pulse && 'animate-pulse')} />
      <span className="text-[10px] text-muted-foreground font-mono">{config.label}</span>
    </div>
  );
};

export default ConnectionStatus;
