import React, { useEffect, useState } from 'react';
import { Bell, Plus, Trash2 } from 'lucide-react';
import { getAlerts, createAlert, deleteAlert, type Alert } from '@/services/api';
import { useAuthStore } from '@/stores/auth';
import { cn } from '@/utils/cn';

const Alerts: React.FC = () => {
  const { isAuthenticated } = useAuthStore();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);

  const fetchAlerts = async () => {
    if (!isAuthenticated) { setLoading(false); return; }
    try {
      const data = await getAlerts();
      setAlerts(data);
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { fetchAlerts(); }, [isAuthenticated]);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreating(true);
    try {
      await createAlert({
        name: name.trim(),
        conditions: { type: 'price_above', symbol: 'BTCUSDT', value: 70000 },
        channels: ['push'],
      });
      setName('');
      setShowCreate(false);
      fetchAlerts();
    } catch { /* ignore */ }
    setCreating(false);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteAlert(id);
      setAlerts((prev) => prev.filter((a) => a.id !== id));
    } catch { /* ignore */ }
  };

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Bell className="w-10 h-10 text-muted-foreground" />
        <p className="text-muted-foreground">Login to manage your alerts</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-foreground">Alerts</h1>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" />
          Create Alert
        </button>
      </div>

      {showCreate && (
        <div className="bg-card border border-border rounded-xl p-5 space-y-3">
          <input
            type="text"
            placeholder="Alert name (e.g. BTC above $70k)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full h-10 px-4 bg-secondary border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={creating || !name.trim()}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50"
            >
              {creating ? 'Creating...' : 'Create'}
            </button>
            <button
              onClick={() => setShowCreate(false)}
              className="px-4 py-2 rounded-lg bg-secondary text-foreground text-sm hover:bg-secondary/80"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Bell className="w-6 h-6 text-primary animate-pulse" />
        </div>
      ) : alerts.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <Bell className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">No alerts yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {alerts.map((alert) => (
            <div key={alert.id} className="bg-card border border-border rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">{alert.name}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {alert.is_active ? 'Active' : 'Paused'} &middot; Created {new Date(alert.created_at).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={cn(
                  'w-2 h-2 rounded-full',
                  alert.is_active ? 'bg-success' : 'bg-muted-foreground'
                )} />
                <button
                  onClick={() => handleDelete(alert.id)}
                  className="p-2 rounded-lg text-muted-foreground hover:text-danger hover:bg-danger/10 transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Alerts;
