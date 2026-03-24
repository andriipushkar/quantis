import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/auth';
import { useThemeStore } from '@/stores/theme';
import {
  updateProfile,
  setup2FA,
  verify2FA,
  connectTelegram,
  disconnectTelegram,
  getTelegramStatus,
  sendTelegramTest,
} from '@/services/api';
import { Input } from '@/components/common/Input';
import { Button } from '@/components/common/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/common/Card';
import { useToastStore } from '@/stores/toast';
import {
  User as UserIcon,
  Palette,
  Globe,
  Shield,
  AlertTriangle,
  Sun,
  Moon,
  LogOut,
  Smartphone,
  MessageCircle,
  Check,
  Copy,
} from 'lucide-react';

const TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Berlin',
  'Europe/Kiev',
  'Europe/Moscow',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Shanghai',
  'Asia/Tokyo',
  'Asia/Singapore',
  'Australia/Sydney',
  'Pacific/Auckland',
];

const Settings: React.FC = () => {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const loadUser = useAuthStore((s) => s.loadUser);
  const { theme, setTheme } = useThemeStore();
  const addToast = useToastStore((s) => s.addToast);

  const [displayName, setDisplayName] = useState(user?.display_name || '');
  const [timezone, setTimezone] = useState(user?.timezone || 'UTC');
  const { i18n } = useTranslation();
  const [language, setLanguage] = useState(user?.language || i18n.language || 'en');
  const [saving, setSaving] = useState(false);

  // 2FA state
  const [is2FAEnabled, setIs2FAEnabled] = useState(false);
  const [totpSecret, setTotpSecret] = useState('');
  const [totpQrUrl, setTotpQrUrl] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [setting2FA, setSetting2FA] = useState(false);
  const [verifying2FA, setVerifying2FA] = useState(false);

  // Telegram state
  const [telegramConnected, setTelegramConnected] = useState(false);
  const [telegramChatId, setTelegramChatId] = useState('');
  const [telegramInput, setTelegramInput] = useState('');
  const [telegramLoading, setTelegramLoading] = useState(false);

  useEffect(() => {
    if (user) {
      setDisplayName(user.display_name || '');
      setTimezone(user.timezone || 'UTC');
      setLanguage(user.language || 'en');
    }
  }, [user]);

  useEffect(() => {
    getTelegramStatus()
      .then((status) => {
        setTelegramConnected(status.connected);
        setTelegramChatId(status.chatId || '');
      })
      .catch(() => {});
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateProfile({
        display_name: displayName || null,
        timezone,
        language,
      });
      await loadUser();
      addToast('Settings saved successfully.', 'success');
    } catch {
      addToast('Failed to save settings.', 'danger');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Settings</h1>

      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserIcon className="w-4 h-4" />
            Profile
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            label="Display Name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your name"
          />
          <Input
            label="Email"
            value={user?.email || ''}
            readOnly
            className="opacity-60 cursor-not-allowed"
          />
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-muted-foreground">Timezone</label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="flex h-10 w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary transition-all duration-200"
            >
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Appearance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="w-4 h-4" />
            Appearance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <label
              className={`flex items-center gap-3 cursor-pointer rounded-lg border px-4 py-3 transition-all duration-200 flex-1 ${
                theme === 'dark'
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:border-muted-foreground'
              }`}
            >
              <input
                type="radio"
                name="theme"
                value="dark"
                checked={theme === 'dark'}
                onChange={() => setTheme('dark')}
                className="sr-only"
              />
              <Moon className="w-5 h-5 text-primary" />
              <div>
                <p className="text-sm font-medium text-foreground">Dark</p>
                <p className="text-xs text-muted-foreground">Easier on the eyes</p>
              </div>
            </label>
            <label
              className={`flex items-center gap-3 cursor-pointer rounded-lg border px-4 py-3 transition-all duration-200 flex-1 ${
                theme === 'light'
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:border-muted-foreground'
              }`}
            >
              <input
                type="radio"
                name="theme"
                value="light"
                checked={theme === 'light'}
                onChange={() => setTheme('light')}
                className="sr-only"
              />
              <Sun className="w-5 h-5 text-primary" />
              <div>
                <p className="text-sm font-medium text-foreground">Light</p>
                <p className="text-xs text-muted-foreground">Classic look</p>
              </div>
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Language */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="w-4 h-4" />
            Language
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1.5">
            <select
              value={language}
              onChange={(e) => { setLanguage(e.target.value); i18n.changeLanguage(e.target.value); }}
              className="flex h-10 w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary transition-all duration-200"
            >
              <option value="en">English</option>
              <option value="uk">Українська</option>
              <option value="de">Deutsch</option>
              <option value="es">Español</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Save button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} isLoading={saving}>
          Save Changes
        </Button>
      </div>

      {/* Account */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Account
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button variant="outline" disabled>
            Change Password
          </Button>
          <Button variant="ghost" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-2" />
            Log Out
          </Button>
        </CardContent>
      </Card>

      {/* Two-Factor Authentication */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="w-4 h-4" />
            Two-Factor Authentication
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <div
              className={`w-2.5 h-2.5 rounded-full ${
                is2FAEnabled ? 'bg-success' : 'bg-muted-foreground'
              }`}
            />
            <span className="text-sm text-foreground">
              {is2FAEnabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>

          {!is2FAEnabled && !totpSecret && (
            <Button
              variant="outline"
              isLoading={setting2FA}
              onClick={async () => {
                setSetting2FA(true);
                try {
                  const data = await setup2FA();
                  setTotpSecret(data.secret);
                  setTotpQrUrl(data.qrCodeUrl);
                  addToast('Scan the QR code with your authenticator app.', 'success');
                } catch {
                  addToast('Failed to set up 2FA.', 'danger');
                } finally {
                  setSetting2FA(false);
                }
              }}
            >
              Enable 2FA
            </Button>
          )}

          {totpSecret && !is2FAEnabled && (
            <div className="space-y-3">
              <div className="rounded-lg border border-border bg-secondary/50 p-4 space-y-2">
                <p className="text-xs text-muted-foreground">
                  Scan this URL with your authenticator app, or enter the secret manually:
                </p>
                <div className="flex items-center gap-2">
                  <code className="text-xs text-primary bg-primary/10 px-2 py-1 rounded break-all flex-1">
                    {totpSecret}
                  </code>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(totpSecret);
                      addToast('Secret copied to clipboard.', 'success');
                    }}
                    className="p-1.5 rounded hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
                <p className="text-xs text-muted-foreground break-all">{totpQrUrl}</p>
              </div>

              <div className="flex gap-2">
                <Input
                  placeholder="6-digit code"
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="max-w-[160px]"
                />
                <Button
                  variant="outline"
                  isLoading={verifying2FA}
                  disabled={totpCode.length !== 6}
                  onClick={async () => {
                    setVerifying2FA(true);
                    try {
                      await verify2FA(totpCode);
                      setIs2FAEnabled(true);
                      setTotpSecret('');
                      setTotpQrUrl('');
                      setTotpCode('');
                      addToast('2FA enabled successfully.', 'success');
                    } catch {
                      addToast('Failed to verify code.', 'danger');
                    } finally {
                      setVerifying2FA(false);
                    }
                  }}
                >
                  <Check className="w-4 h-4 mr-1" />
                  Verify
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Telegram */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="w-4 h-4" />
            Telegram
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <div
              className={`w-2.5 h-2.5 rounded-full ${
                telegramConnected ? 'bg-success' : 'bg-muted-foreground'
              }`}
            />
            <span className="text-sm text-foreground">
              {telegramConnected ? `Connected (${telegramChatId})` : 'Not connected'}
            </span>
          </div>

          {!telegramConnected ? (
            <div className="flex gap-2">
              <Input
                placeholder="Telegram Chat ID"
                value={telegramInput}
                onChange={(e) => setTelegramInput(e.target.value)}
                className="max-w-[240px]"
              />
              <Button
                variant="outline"
                isLoading={telegramLoading}
                disabled={!telegramInput.trim()}
                onClick={async () => {
                  setTelegramLoading(true);
                  try {
                    await connectTelegram(telegramInput.trim());
                    setTelegramConnected(true);
                    setTelegramChatId(telegramInput.trim());
                    setTelegramInput('');
                    addToast('Telegram connected successfully.', 'success');
                  } catch {
                    addToast('Failed to connect Telegram.', 'danger');
                  } finally {
                    setTelegramLoading(false);
                  }
                }}
              >
                Connect
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  try {
                    await sendTelegramTest();
                    addToast('Test message sent.', 'success');
                  } catch {
                    addToast('Failed to send test message.', 'danger');
                  }
                }}
              >
                Send Test
              </Button>
              <Button
                variant="ghost"
                size="sm"
                isLoading={telegramLoading}
                onClick={async () => {
                  setTelegramLoading(true);
                  try {
                    await disconnectTelegram();
                    setTelegramConnected(false);
                    setTelegramChatId('');
                    addToast('Telegram disconnected.', 'success');
                  } catch {
                    addToast('Failed to disconnect.', 'danger');
                  } finally {
                    setTelegramLoading(false);
                  }
                }}
              >
                Disconnect
              </Button>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Connect your Telegram account to receive signal alerts and notifications directly in your chat.
          </p>
        </CardContent>
      </Card>

      {/* Legal Links */}
      <Card>
        <CardHeader>
          <CardTitle>Legal</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Link
              to="/terms"
              className="text-sm text-primary hover:underline transition-colors"
            >
              Terms of Service
            </Link>
            <Link
              to="/privacy"
              className="text-sm text-primary hover:underline transition-colors"
            >
              Privacy Policy
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-danger/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-danger">
            <AlertTriangle className="w-4 h-4" />
            Danger Zone
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Once you delete your account, there is no going back. Please be certain.
          </p>
          <Button variant="destructive" disabled>
            Delete Account
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default Settings;
