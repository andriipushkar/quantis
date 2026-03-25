import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, Send, Bot, User, ChevronDown, ChevronUp, Sun, RefreshCw } from 'lucide-react';
import { cn } from '@/utils/cn';

interface CopilotContext {
  symbol: string;
  price: number;
  rsi: number | null;
  ema9: number | null;
  ema21: number | null;
  trend: string;
  fearGreed: number;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  context?: CopilotContext;
  timestamp: Date;
}

interface MorningBriefData {
  brief: string;
  generatedAt: string;
  context: {
    btcPrice?: number;
    ethPrice?: number;
    sentiment?: number;
    topGainers?: { symbol: string; change: number }[];
    topLosers?: { symbol: string; change: number }[];
  };
}

const SYMBOLS = [
  'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT',
  'ADAUSDT', 'DOGEUSDT', 'AVAXUSDT', 'DOTUSDT', 'MATICUSDT',
];

const SUGGESTED_QUESTIONS = [
  'What do you think about BTC?',
  'Is ETH oversold?',
  'Give me trade ideas',
  'Explain RSI divergence',
];

function getToken(): string | null {
  return localStorage.getItem('quantis_token');
}

const Copilot: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [loading, setLoading] = useState(false);
  const [symbolOpen, setSymbolOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Morning Brief state
  const [brief, setBrief] = useState<MorningBriefData | null>(null);
  const [briefLoading, setBriefLoading] = useState(true);
  const [briefOpen, setBriefOpen] = useState(() => !localStorage.getItem('quantis_brief_read'));

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Fetch morning brief on mount
  const fetchBrief = async () => {
    setBriefLoading(true);
    try {
      const token = getToken();
      const res = await fetch('/api/v1/copilot/morning-brief', {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const json = await res.json();
      if (json.success) {
        setBrief(json.data);
      }
    } catch {
      // silent – brief section will stay empty
    } finally {
      setBriefLoading(false);
    }
  };

  useEffect(() => {
    fetchBrief();
  }, []);

  const handleBriefToggle = () => {
    const next = !briefOpen;
    setBriefOpen(next);
    if (!next) {
      localStorage.setItem('quantis_brief_read', '1');
    }
  };

  const sendMessage = async (question: string) => {
    if (!question.trim() || loading) return;

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: question.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev.slice(-49), userMsg]);
    setInput('');
    setLoading(true);

    try {
      const token = getToken();
      const res = await fetch('/api/v1/copilot/ask', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ question: question.trim(), symbol }),
      });

      const json = await res.json();

      if (json.success) {
        const assistantMsg: Message = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: json.data.answer,
          context: json.data.context,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev.slice(-49), assistantMsg]);
      } else {
        const errorMsg: Message = {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: json.error || 'Something went wrong. Please try again.',
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev.slice(-49), errorMsg]);
      }
    } catch {
      const errorMsg: Message = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: 'Failed to connect to the server. Please try again.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev.slice(-49), errorMsg]);
    }

    setLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const formatPrice = (n: number) => {
    if (n === 0) return '$0';
    return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const todayStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-border">
        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
          <Bot className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-foreground">AI Copilot</h1>
          <p className="text-xs text-muted-foreground">Technical analysis assistant</p>
        </div>
      </div>

      {/* Morning Brief Card */}
      <div className="px-4 pt-4">
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {/* Brief Header */}
          <button
            onClick={handleBriefToggle}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-secondary/30 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Sun className="w-4 h-4 text-yellow-400" />
              <span className="text-sm font-semibold text-foreground">Morning Brief</span>
              <span className="text-xs text-muted-foreground">{todayStr}</span>
            </div>
            <div className="flex items-center gap-2">
              {!briefLoading && brief && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    fetchBrief();
                  }}
                  className="p-1 rounded hover:bg-secondary transition-colors"
                  title="Refresh brief"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              )}
              {briefOpen ? (
                <ChevronUp className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              )}
            </div>
          </button>

          {/* Brief Content */}
          {briefOpen && (
            <div className="px-4 pb-4 border-t border-border/50">
              {briefLoading ? (
                <div className="space-y-3 pt-3">
                  <div className="h-4 bg-secondary rounded animate-pulse w-3/4" />
                  <div className="h-4 bg-secondary rounded animate-pulse w-full" />
                  <div className="h-4 bg-secondary rounded animate-pulse w-5/6" />
                  <div className="h-4 bg-secondary rounded animate-pulse w-2/3" />
                  <div className="flex gap-2 mt-3">
                    <div className="h-6 w-24 bg-secondary rounded-full animate-pulse" />
                    <div className="h-6 w-24 bg-secondary rounded-full animate-pulse" />
                    <div className="h-6 w-20 bg-secondary rounded-full animate-pulse" />
                  </div>
                </div>
              ) : brief ? (
                <div className="space-y-3 pt-3">
                  {/* Brief text */}
                  <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                    {brief.brief}
                  </p>

                  {/* Context badges */}
                  {brief.context && (
                    <div className="flex flex-wrap gap-1.5">
                      {brief.context.btcPrice != null && (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-secondary text-foreground">
                          BTC {formatPrice(brief.context.btcPrice)}
                        </span>
                      )}
                      {brief.context.ethPrice != null && (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-secondary text-foreground">
                          ETH {formatPrice(brief.context.ethPrice)}
                        </span>
                      )}
                      {brief.context.sentiment != null && (
                        <span
                          className={cn(
                            'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium',
                            brief.context.sentiment >= 60
                              ? 'bg-success/10 text-success'
                              : brief.context.sentiment <= 40
                                ? 'bg-danger/10 text-danger'
                                : 'bg-secondary text-muted-foreground'
                          )}
                        >
                          Sentiment {brief.context.sentiment}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Top Gainers & Losers */}
                  {brief.context && (
                    <div className="flex flex-wrap gap-1.5">
                      {brief.context.topGainers?.slice(0, 3).map((g) => (
                        <span
                          key={g.symbol}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-success/10 text-success"
                        >
                          {g.symbol} +{g.change.toFixed(1)}%
                        </span>
                      ))}
                      {brief.context.topLosers?.slice(0, 3).map((l) => (
                        <span
                          key={l.symbol}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-danger/10 text-danger"
                        >
                          {l.symbol} {l.change.toFixed(1)}%
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Generated timestamp */}
                  <p className="text-[10px] text-muted-foreground">
                    Generated {new Date(brief.generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground pt-3">
                  Unable to load morning brief. Try refreshing.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-6">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <MessageSquare className="w-8 h-8 text-primary" />
            </div>
            <div className="text-center">
              <h2 className="text-lg font-semibold text-foreground mb-1">Ask anything about crypto</h2>
              <p className="text-sm text-muted-foreground">Get AI-powered technical analysis and market insights</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  className="text-left px-4 py-3 rounded-lg border border-border bg-card text-sm text-foreground hover:border-primary/50 hover:bg-primary/5 transition-all duration-200"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              'flex gap-3 max-w-[85%]',
              msg.role === 'user' ? 'ml-auto flex-row-reverse' : 'mr-auto'
            )}
          >
            <div
              className={cn(
                'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
                msg.role === 'user' ? 'bg-primary/20' : 'bg-card border border-border'
              )}
            >
              {msg.role === 'user' ? (
                <User className="w-4 h-4 text-primary" />
              ) : (
                <Bot className="w-4 h-4 text-muted-foreground" />
              )}
            </div>

            <div className="flex flex-col gap-2">
              {/* Context badges for assistant messages */}
              {msg.role === 'assistant' && msg.context && (
                <div className="flex flex-wrap gap-1.5">
                  {msg.context.price > 0 && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-secondary text-foreground">
                      {msg.context.symbol} {formatPrice(msg.context.price)}
                    </span>
                  )}
                  {msg.context.rsi !== null && (
                    <span
                      className={cn(
                        'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
                        msg.context.rsi < 30
                          ? 'bg-success/10 text-success'
                          : msg.context.rsi > 70
                            ? 'bg-danger/10 text-danger'
                            : 'bg-secondary text-muted-foreground'
                      )}
                    >
                      RSI {msg.context.rsi}
                    </span>
                  )}
                  <span
                    className={cn(
                      'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
                      msg.context.trend === 'bullish'
                        ? 'bg-success/10 text-success'
                        : msg.context.trend === 'bearish'
                          ? 'bg-danger/10 text-danger'
                          : 'bg-secondary text-muted-foreground'
                    )}
                  >
                    {msg.context.trend}
                  </span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-secondary text-muted-foreground">
                    F&G {msg.context.fearGreed}
                  </span>
                </div>
              )}

              {/* Message bubble */}
              <div
                className={cn(
                  'rounded-xl px-4 py-3 text-sm leading-relaxed',
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-card border border-border text-foreground'
                )}
              >
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>

              <span className="text-[10px] text-muted-foreground px-1">
                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
        ))}

        {/* Loading indicator */}
        {loading && (
          <div className="flex gap-3 mr-auto max-w-[85%]">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-card border border-border flex-shrink-0">
              <Bot className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="bg-card border border-border rounded-xl px-4 py-3">
              <div className="flex gap-1">
                <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar */}
      <div className="border-t border-border p-4">
        <div className="flex items-center gap-2">
          {/* Symbol selector */}
          <div className="relative">
            <button
              onClick={() => setSymbolOpen(!symbolOpen)}
              className="flex items-center gap-1 px-3 py-2.5 rounded-lg border border-border bg-secondary text-sm text-foreground hover:border-primary/50 transition-colors"
            >
              <span className="font-medium">{symbol.replace('USDT', '')}</span>
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
            {symbolOpen && (
              <div className="absolute bottom-full mb-1 left-0 w-36 bg-card border border-border rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                {SYMBOLS.map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      setSymbol(s);
                      setSymbolOpen(false);
                    }}
                    className={cn(
                      'w-full text-left px-3 py-2 text-sm hover:bg-secondary transition-colors',
                      s === symbol ? 'text-primary font-medium' : 'text-foreground'
                    )}
                  >
                    {s.replace('USDT', '')}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Text input */}
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about market analysis..."
            className="flex-1 h-10 px-4 rounded-lg border border-border bg-secondary text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary transition-all duration-200"
            disabled={loading}
          />

          {/* Send button */}
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || loading}
            className={cn(
              'w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-200',
              input.trim() && !loading
                ? 'bg-primary text-primary-foreground hover:opacity-90'
                : 'bg-secondary text-muted-foreground cursor-not-allowed'
            )}
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Copilot;
