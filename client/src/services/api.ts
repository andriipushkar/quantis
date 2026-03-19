const BASE_URL = '/api/v1';

function getToken(): string | null {
  return localStorage.getItem('quantis_token');
}

function setToken(token: string): void {
  localStorage.setItem('quantis_token', token);
}

function clearToken(): void {
  localStorage.removeItem('quantis_token');
}

async function request<T>(endpoint: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const { method = 'GET', body } = options;
  const token = getToken();

  const config: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  };

  if (body) config.body = JSON.stringify(body);

  let response = await fetch(`${BASE_URL}${endpoint}`, config);

  if (response.status === 401 && token) {
    try {
      const refreshRes = await fetch(`${BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      if (refreshRes.ok) {
        const rd = await refreshRes.json();
        setToken(rd.data.accessToken);
        (config.headers as Record<string, string>).Authorization = `Bearer ${rd.data.accessToken}`;
        response = await fetch(`${BASE_URL}${endpoint}`, config);
      } else {
        clearToken();
        throw new Error('Session expired');
      }
    } catch {
      clearToken();
      throw new Error('Session expired');
    }
  }

  const json = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(json.error || `HTTP ${response.status}`);
  }

  return json;
}

const api = {
  get: <T>(url: string) => request<T>(url),
  post: <T>(url: string, body?: unknown) => request<T>(url, { method: 'POST', body }),
  put: <T>(url: string, body?: unknown) => request<T>(url, { method: 'PUT', body }),
  delete: <T>(url: string) => request<T>(url, { method: 'DELETE' }),
};

// --- Types ---

export interface User {
  id: string;
  email: string;
  tier: string;
  language: string;
  display_name: string | null;
  timezone: string;
  experience_level: string;
  ui_mode: string;
  referral_code: string;
  created_at: string;
}

export interface TickerData {
  symbol: string;
  exchange: string;
  price: number;
  change24h: number;
  volume: number;
  timestamp: number;
}

export interface ScreenerItem {
  symbol: string;
  exchange: string;
  price: number;
  change24h: number;
  volume: number;
  rsi: number;
  trend: 'bullish' | 'bearish' | 'neutral';
}

export interface OHLCV {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TradingPair {
  id: number;
  symbol: string;
  base_asset: string;
  quote_asset: string;
  exchange: string;
  is_active: boolean;
}

export interface Signal {
  id: string;
  pair: string;
  exchange: string;
  type: 'buy' | 'sell' | 'close';
  strategy: string;
  strength: 'weak' | 'medium' | 'strong';
  confidence: number;
  entry_price: number;
  stop_loss: number;
  tp1: number;
  tp2: number;
  tp3: number;
  sources_json: string[];
  reasoning: string;
  timeframe: string;
  status: string;
  created_at: string;
}

export interface Alert {
  id: string;
  name: string;
  conditions_json: unknown;
  channels_json: string[];
  is_active: boolean;
  cooldown_seconds: number;
  last_triggered_at: string | null;
  created_at: string;
}

// --- Auth ---

export async function login(payload: { email: string; password: string }) {
  const res = await api.post<{ success: boolean; data: { user: User; accessToken: string; refreshToken: string } }>(
    '/auth/login', payload
  );
  setToken(res.data.accessToken);
  return { user: res.data.user, token: res.data.accessToken };
}

export async function register(payload: { email: string; password: string }) {
  const res = await api.post<{ success: boolean; data: { user: User; accessToken: string; refreshToken: string } }>(
    '/auth/register', payload
  );
  setToken(res.data.accessToken);
  return { user: res.data.user, token: res.data.accessToken };
}

export async function logout() {
  try { await api.post('/auth/logout'); } catch { /* ignore */ }
  clearToken();
}

export async function getProfile(): Promise<User> {
  const res = await api.get<{ success: boolean; data: User }>('/auth/me');
  return res.data;
}

export async function updateProfile(data: Partial<User>): Promise<User> {
  await api.put('/auth/me', data);
  return getProfile();
}

// --- Market ---

export async function getPairs(): Promise<TradingPair[]> {
  const res = await api.get<{ success: boolean; data: TradingPair[] }>('/market/pairs');
  return res.data;
}

export async function getTickers(): Promise<Record<string, TickerData>> {
  const res = await api.get<{ success: boolean; data: Record<string, TickerData> }>('/market/ticker');
  return res.data;
}

export async function getTicker(symbol: string): Promise<TickerData> {
  const res = await api.get<{ success: boolean; data: TickerData }>(`/market/ticker/${symbol}`);
  return res.data;
}

export async function getScreener(params?: Record<string, string>): Promise<ScreenerItem[]> {
  const qs = params ? '?' + new URLSearchParams(params).toString() : '';
  const res = await api.get<{ success: boolean; data: ScreenerItem[] }>(`/market/screener${qs}`);
  return res.data;
}

export interface FearGreedData {
  score: number;
  label: string;
  components: {
    rsi_avg: number;
    bullish_pct: number;
    volume_score: number;
    funding_score: number;
  };
  timestamp: number;
}

export async function getFearGreed(): Promise<FearGreedData> {
  const res = await api.get<{ success: boolean; data: FearGreedData }>('/market/fear-greed');
  return res.data;
}

export async function getOHLCV(symbol: string, timeframe: string = '1m', limit: number = 500): Promise<OHLCV[]> {
  const res = await api.get<{ success: boolean; data: OHLCV[] }>(
    `/market/ohlcv/${symbol}?timeframe=${timeframe}&limit=${limit}`
  );
  return res.data;
}

// --- Signals ---

export async function getSignals(): Promise<Signal[]> {
  const res = await api.get<{ success: boolean; data: { rows: Signal[] } }>('/analysis/signals');
  return res.data?.rows || [];
}

// --- Alerts ---

export async function getAlerts(): Promise<Alert[]> {
  const res = await api.get<{ success: boolean; data: Alert[] }>('/alerts');
  return res.data || [];
}

export async function createAlert(data: { name: string; conditions: unknown; channels: string[] }) {
  return api.post('/alerts', data);
}

export async function deleteAlert(id: string) {
  return api.delete(`/alerts/${id}`);
}

export { setToken, clearToken, getToken };
