import React, { useState, useRef, useCallback, useMemo } from 'react';
import {
  Code,
  Play,
  Save,
  Trash2,
  ChevronDown,
  ChevronRight,
  BookOpen,
  FileCode,
  Sparkles,
} from 'lucide-react';
import { useToastStore } from '@/stores/toast';

/* ------------------------------------------------------------------ */
/*  Templates                                                          */
/* ------------------------------------------------------------------ */

interface Template {
  name: string;
  code: string;
}

const TEMPLATES: Template[] = [
  {
    name: 'RSI Divergence Detector',
    code: `@indicator(name='RSI Divergence', overlay=false)
length = input(14, 'RSI Length')
overbought = input(70, 'Overbought')
oversold = input(30, 'Oversold')

rsi_val = ta.rsi(close, length)

# Detect bullish divergence
price_lower_low = low < ta.lowest(low, 5)[1]
rsi_higher_low = rsi_val > ta.lowest(rsi_val, 5)[1]
bull_div = price_lower_low and rsi_higher_low and rsi_val < oversold

# Detect bearish divergence
price_higher_high = high > ta.highest(high, 5)[1]
rsi_lower_high = rsi_val < ta.highest(rsi_val, 5)[1]
bear_div = price_higher_high and rsi_lower_high and rsi_val > overbought

plot(rsi_val, 'RSI', color=color.purple)
hline(overbought, 'OB', color=color.red)
hline(oversold, 'OS', color=color.green)
signal(bull_div, 'Bullish Divergence', type=signal.BUY)
signal(bear_div, 'Bearish Divergence', type=signal.SELL)`,
  },
  {
    name: 'EMA Crossover Strategy',
    code: `@indicator(name='EMA Crossover', overlay=true)
fast = input(9, 'Fast Period')
slow = input(21, 'Slow Period')

ema_fast = ta.ema(close, fast)
ema_slow = ta.ema(close, slow)

bullish = ta.crossover(ema_fast, ema_slow)
bearish = ta.crossunder(ema_fast, ema_slow)

plot(ema_fast, 'Fast EMA', color=color.blue)
plot(ema_slow, 'Slow EMA', color=color.orange)
signal(bullish, 'Buy Signal', type=signal.BUY)
signal(bearish, 'Sell Signal', type=signal.SELL)`,
  },
  {
    name: 'Volume Spike Alert',
    code: `@indicator(name='Volume Spike', overlay=false)
lookback = input(20, 'Lookback Period')
threshold = input(2.5, 'Spike Multiplier')

avg_vol = ta.sma(volume, lookback)
vol_ratio = volume / avg_vol
is_spike = vol_ratio > threshold

# Color bars by intensity
bar_color = color.red if vol_ratio > 4 else color.orange if vol_ratio > 3 else color.yellow

plot(vol_ratio, 'Volume Ratio', color=bar_color, type=plot.HISTOGRAM)
hline(threshold, 'Threshold', color=color.white, style=line.DASHED)
signal(is_spike, 'Volume Spike!', type=signal.ALERT)`,
  },
  {
    name: 'Bollinger Squeeze Scanner',
    code: `@indicator(name='Bollinger Squeeze', overlay=false)
bb_length = input(20, 'BB Length')
bb_mult = input(2.0, 'BB Multiplier')
kc_length = input(20, 'KC Length')
kc_mult = input(1.5, 'KC Multiplier')

# Bollinger Bands
bb_basis = ta.sma(close, bb_length)
bb_dev = bb_mult * ta.stdev(close, bb_length)
bb_upper = bb_basis + bb_dev
bb_lower = bb_basis - bb_dev

# Keltner Channels
kc_basis = ta.ema(close, kc_length)
kc_range = kc_mult * ta.atr(kc_length)
kc_upper = kc_basis + kc_range
kc_lower = kc_basis - kc_range

# Squeeze detection
squeeze_on = bb_lower > kc_lower and bb_upper < kc_upper
squeeze_off = not squeeze_on
momentum = ta.linreg(close - ta.sma(close, bb_length), bb_length, 0)

plot(momentum, 'Momentum', color=color.green if momentum > 0 else color.red, type=plot.HISTOGRAM)
signal(squeeze_off and squeeze_on[1], 'Squeeze Released!', type=signal.ALERT)`,
  },
  {
    name: 'Custom Moving Average',
    code: `@indicator(name='Custom MA Ribbon', overlay=true)
ma_type = input('EMA', 'MA Type', options=['SMA', 'EMA', 'WMA'])
p1 = input(10, 'Period 1')
p2 = input(20, 'Period 2')
p3 = input(50, 'Period 3')
p4 = input(100, 'Period 4')
p5 = input(200, 'Period 5')

def get_ma(src, length):
    if ma_type == 'SMA':
        return ta.sma(src, length)
    elif ma_type == 'WMA':
        return ta.wma(src, length)
    else:
        return ta.ema(src, length)

ma1 = get_ma(close, p1)
ma2 = get_ma(close, p2)
ma3 = get_ma(close, p3)
ma4 = get_ma(close, p4)
ma5 = get_ma(close, p5)

plot(ma1, 'MA 10', color=color.blue)
plot(ma2, 'MA 20', color=color.cyan)
plot(ma3, 'MA 50', color=color.yellow)
plot(ma4, 'MA 100', color=color.orange)
plot(ma5, 'MA 200', color=color.red)`,
  },
];

/* ------------------------------------------------------------------ */
/*  Built-in Functions Reference                                       */
/* ------------------------------------------------------------------ */

interface FuncRef {
  name: string;
  description: string;
}

const BUILTIN_FUNCTIONS: { category: string; funcs: FuncRef[] }[] = [
  {
    category: 'ta.*  (Technical Analysis)',
    funcs: [
      { name: 'ta.sma(src, length)', description: 'Simple Moving Average' },
      { name: 'ta.ema(src, length)', description: 'Exponential Moving Average' },
      { name: 'ta.wma(src, length)', description: 'Weighted Moving Average' },
      { name: 'ta.rsi(src, length)', description: 'Relative Strength Index' },
      { name: 'ta.macd(src, fast, slow, signal)', description: 'MACD line, signal, histogram' },
      { name: 'ta.bbands(src, length, mult)', description: 'Bollinger Bands (upper, mid, lower)' },
      { name: 'ta.atr(length)', description: 'Average True Range' },
      { name: 'ta.stdev(src, length)', description: 'Standard Deviation' },
      { name: 'ta.crossover(a, b)', description: 'True when a crosses above b' },
      { name: 'ta.crossunder(a, b)', description: 'True when a crosses below b' },
      { name: 'ta.highest(src, length)', description: 'Highest value in period' },
      { name: 'ta.lowest(src, length)', description: 'Lowest value in period' },
      { name: 'ta.linreg(src, length, offset)', description: 'Linear regression value' },
      { name: 'ta.stoch(close, high, low, length)', description: 'Stochastic %K' },
      { name: 'ta.vwap()', description: 'Volume-Weighted Average Price' },
    ],
  },
  {
    category: 'math.*',
    funcs: [
      { name: 'math.abs(x)', description: 'Absolute value' },
      { name: 'math.max(a, b)', description: 'Maximum of two values' },
      { name: 'math.min(a, b)', description: 'Minimum of two values' },
      { name: 'math.round(x, digits)', description: 'Round to N decimal places' },
      { name: 'math.sqrt(x)', description: 'Square root' },
      { name: 'math.log(x)', description: 'Natural logarithm' },
      { name: 'math.pow(base, exp)', description: 'Power / exponent' },
    ],
  },
  {
    category: 'crypto.*',
    funcs: [
      { name: 'crypto.funding_rate(symbol)', description: 'Current perpetual funding rate' },
      { name: 'crypto.open_interest(symbol)', description: 'Open interest in USD' },
      { name: 'crypto.long_short_ratio(symbol)', description: 'Long/short account ratio' },
      { name: 'crypto.dominance(symbol)', description: 'Market cap dominance %' },
      { name: 'crypto.fear_greed()', description: 'Fear & Greed Index (0-100)' },
      { name: 'crypto.exchange_flow(symbol, exchange)', description: 'Net exchange inflow/outflow' },
    ],
  },
];

/* ------------------------------------------------------------------ */
/*  Syntax highlighting helpers                                        */
/* ------------------------------------------------------------------ */

const KEYWORDS = new Set([
  'if', 'else', 'elif', 'and', 'or', 'not', 'def', 'return', 'for', 'in', 'while', 'true', 'false',
  'True', 'False', 'None', 'import', 'from', 'as',
]);

function highlightLine(text: string): React.ReactNode[] {
  const tokens: React.ReactNode[] = [];
  // Regex to tokenize: comments, strings, decorator, numbers, keywords/identifiers, other
  const regex = /(#[^\n]*)|('''[\s\S]*?'''|"""[\s\S]*?"""|'[^']*'|"[^"]*")|(@\w+)|(\b\d+\.?\d*\b)|(\b\w+\b)|([^\w\s]+|\s+)/g;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    const [_full, comment, str, decorator, num, word, other] = match;
    if (comment) {
      tokens.push(<span key={key++} className="text-muted-foreground/60 italic">{comment}</span>);
    } else if (str) {
      tokens.push(<span key={key++} style={{ color: '#e89b5a' }}>{str}</span>);
    } else if (decorator) {
      tokens.push(<span key={key++} style={{ color: '#c792ea' }}>{decorator}</span>);
    } else if (num) {
      tokens.push(<span key={key++} style={{ color: '#5af5a0' }}>{num}</span>);
    } else if (word) {
      if (KEYWORDS.has(word)) {
        tokens.push(<span key={key++} style={{ color: '#e6b44c' }} className="font-semibold">{word}</span>);
      } else if (word.startsWith('ta') || word.startsWith('math') || word.startsWith('crypto') || word.startsWith('color') || word.startsWith('signal') || word.startsWith('plot') || word.startsWith('line')) {
        tokens.push(<span key={key++} style={{ color: '#82aaff' }}>{word}</span>);
      } else {
        tokens.push(<span key={key++}>{word}</span>);
      }
    } else {
      tokens.push(<span key={key++}>{other}</span>);
    }
  }

  return tokens;
}

/* ------------------------------------------------------------------ */
/*  Saved Scripts helpers                                               */
/* ------------------------------------------------------------------ */

interface SavedScript {
  name: string;
  code: string;
  savedAt: string;
}

const STORAGE_KEY = 'quantis_saved_scripts';

function loadScripts(): SavedScript[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function persistScripts(scripts: SavedScript[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(scripts));
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

const ScriptEditor: React.FC = () => {
  const addToast = useToastStore((s) => s.addToast);

  const [code, setCode] = useState(TEMPLATES[1].code);
  const [scriptName, setScriptName] = useState('Untitled Script');
  const [savedScripts, setSavedScripts] = useState<SavedScript[]>(loadScripts);
  const [templateOpen, setTemplateOpen] = useState(true);
  const [refOpen, setRefOpen] = useState(false);
  const [savedOpen, setSavedOpen] = useState(true);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);

  // Sync scroll between textarea and highlighted overlay
  const handleScroll = useCallback(() => {
    if (textareaRef.current && preRef.current) {
      preRef.current.scrollTop = textareaRef.current.scrollTop;
      preRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  }, []);

  const lines = useMemo(() => code.split('\n'), [code]);

  const handleRun = () => {
    addToast('Script execution coming soon — scripts will run in sandboxed WebAssembly', 'info');
  };

  const handleSave = () => {
    const name = scriptName.trim() || 'Untitled Script';
    const updated = [
      { name, code, savedAt: new Date().toISOString() },
      ...savedScripts.filter((s) => s.name !== name),
    ];
    setSavedScripts(updated);
    persistScripts(updated);
    addToast(`Script "${name}" saved`, 'success');
  };

  const handleDelete = (name: string) => {
    const updated = savedScripts.filter((s) => s.name !== name);
    setSavedScripts(updated);
    persistScripts(updated);
    addToast(`Script "${name}" deleted`, 'info');
  };

  const handleLoadScript = (script: SavedScript) => {
    setCode(script.code);
    setScriptName(script.name);
  };

  const handleLoadTemplate = (template: Template) => {
    setCode(template.code);
    setScriptName(template.name);
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Code className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Script Editor</h1>
            <p className="text-xs text-muted-foreground">Write custom indicators with Quantis Script</p>
          </div>
        </div>
        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
          Available on Pro plan
        </span>
      </div>

      {/* Main area */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left sidebar */}
        <div className="w-72 border-r border-border flex flex-col overflow-y-auto bg-card/50">
          {/* Template library */}
          <div className="border-b border-border">
            <button
              onClick={() => setTemplateOpen(!templateOpen)}
              className="flex items-center justify-between w-full px-4 py-3 text-sm font-semibold text-foreground hover:bg-secondary/50 transition-colors"
            >
              <span className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                Template Library
              </span>
              {templateOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
            {templateOpen && (
              <div className="px-2 pb-3 space-y-1">
                {TEMPLATES.map((t) => (
                  <button
                    key={t.name}
                    onClick={() => handleLoadTemplate(t)}
                    className="flex items-center gap-2 w-full text-left px-3 py-2 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                  >
                    <FileCode className="w-3.5 h-3.5 flex-shrink-0 text-primary/60" />
                    {t.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Saved Scripts */}
          <div className="border-b border-border">
            <button
              onClick={() => setSavedOpen(!savedOpen)}
              className="flex items-center justify-between w-full px-4 py-3 text-sm font-semibold text-foreground hover:bg-secondary/50 transition-colors"
            >
              <span className="flex items-center gap-2">
                <Save className="w-4 h-4 text-primary" />
                Saved Scripts
              </span>
              {savedOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
            {savedOpen && (
              <div className="px-2 pb-3 space-y-1">
                {savedScripts.length === 0 && (
                  <p className="text-xs text-muted-foreground/60 px-3 py-2">No saved scripts yet.</p>
                )}
                {savedScripts.map((s) => (
                  <div
                    key={s.name}
                    className="flex items-center justify-between group px-3 py-2 rounded-lg hover:bg-secondary transition-colors"
                  >
                    <button
                      onClick={() => handleLoadScript(s)}
                      className="text-xs text-muted-foreground hover:text-foreground truncate flex-1 text-left"
                    >
                      {s.name}
                    </button>
                    <button
                      onClick={() => handleDelete(s.name)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-destructive transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Built-in Functions Reference */}
          <div>
            <button
              onClick={() => setRefOpen(!refOpen)}
              className="flex items-center justify-between w-full px-4 py-3 text-sm font-semibold text-foreground hover:bg-secondary/50 transition-colors"
            >
              <span className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-primary" />
                Functions Reference
              </span>
              {refOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
            {refOpen && (
              <div className="px-3 pb-4 space-y-4">
                {BUILTIN_FUNCTIONS.map((cat) => (
                  <div key={cat.category}>
                    <h4 className="text-xs font-bold text-primary/80 mb-2 px-1">{cat.category}</h4>
                    <div className="space-y-1.5">
                      {cat.funcs.map((f) => (
                        <div key={f.name} className="px-2">
                          <code className="text-[11px] text-foreground/90 font-mono block">{f.name}</code>
                          <span className="text-[10px] text-muted-foreground block mt-0.5">{f.description}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Editor */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Toolbar */}
          <div className="flex items-center gap-3 px-4 py-2 border-b border-border bg-card/30">
            <input
              type="text"
              value={scriptName}
              onChange={(e) => setScriptName(e.target.value)}
              className="bg-transparent text-sm font-medium text-foreground border border-border rounded-lg px-3 py-1.5 focus:outline-none focus:border-primary/50 w-64"
              placeholder="Script name..."
            />
            <div className="flex-1" />
            <button
              onClick={handleRun}
              className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-semibold bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 transition-colors"
            >
              <Play className="w-3.5 h-3.5" />
              Run
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-semibold bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 transition-colors"
            >
              <Save className="w-3.5 h-3.5" />
              Save
            </button>
          </div>

          {/* Code editor area */}
          <div className="flex-1 relative overflow-hidden font-mono text-sm">
            {/* Line numbers */}
            <div
              className="absolute left-0 top-0 bottom-0 w-12 bg-card/60 border-r border-border overflow-hidden select-none pointer-events-none z-10"
              aria-hidden
            >
              <div className="py-4 px-1 text-right">
                {lines.map((_, i) => (
                  <div key={i} className="leading-6 text-[11px] text-muted-foreground/50 pr-2">
                    {i + 1}
                  </div>
                ))}
              </div>
            </div>

            {/* Highlighted overlay */}
            <pre
              ref={preRef}
              className="absolute inset-0 pl-14 pr-4 py-4 leading-6 text-sm overflow-auto pointer-events-none whitespace-pre text-foreground"
              aria-hidden
            >
              {lines.map((line, i) => (
                <div key={i} className="leading-6">
                  {highlightLine(line)}
                </div>
              ))}
            </pre>

            {/* Actual textarea */}
            <textarea
              ref={textareaRef}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onScroll={handleScroll}
              spellCheck={false}
              className="absolute inset-0 pl-14 pr-4 py-4 leading-6 text-sm resize-none bg-transparent text-transparent caret-foreground outline-none w-full h-full font-mono whitespace-pre overflow-auto"
            />
          </div>

          {/* Status bar */}
          <div className="flex items-center justify-between px-4 py-1.5 border-t border-border bg-card/30 text-[11px] text-muted-foreground">
            <span>Quantis Script v1.0</span>
            <span>
              {lines.length} line{lines.length !== 1 ? 's' : ''} &middot; {code.length} chars
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScriptEditor;
