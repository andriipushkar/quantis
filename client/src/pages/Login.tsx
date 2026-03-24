import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent } from '@/components/common/Card';
import { Input } from '@/components/common/Input';
import { Button } from '@/components/common/Button';
import { useAuthStore } from '@/stores/auth';
import { useThemeStore } from '@/stores/theme';
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton';

const loginSchema = z.object({
  email: z.string().min(1, 'emailRequired').email('invalidEmail'),
  password: z.string().min(1, 'passwordRequired'),
});

type LoginForm = z.infer<typeof loginSchema>;

const Login: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { login, isLoading, error, clearError } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    try {
      clearError();
      await login(data.email, data.password);
      navigate('/dashboard');
    } catch {
      // Error is handled by the store
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative">
      {/* Top-right controls */}
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <button onClick={toggleTheme} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-all" title="Toggle theme">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">{theme === 'dark' ? <circle cx="12" cy="12" r="5" strokeWidth={2}/> : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />}</svg>
        </button>
        <button onClick={() => { const langs = ['en','uk','de','es']; const idx = langs.indexOf(i18n.language); i18n.changeLanguage(langs[(idx+1)%langs.length]); }} className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-all text-xs font-medium">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" strokeWidth={2}/><path strokeWidth={2} d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>
          <span>{{ en: 'EN', uk: 'UA', de: 'DE', es: 'ES' }[i18n.language] || 'EN'}</span>
        </button>
      </div>
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-gold-bronze-gradient flex items-center justify-center mb-4">
            <span className="text-black font-bold text-xl">Q</span>
          </div>
          <h1 className="text-primary font-bold text-2xl tracking-wide">Quantis</h1>
          <p className="text-muted-foreground text-sm mt-1">{t('auth.welcomeBack')}</p>
        </div>

        <Card className="border-border/50">
          <CardContent className="p-6">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {error && (
                <div className="bg-danger/10 border border-danger/25 rounded-lg px-4 py-3 text-sm text-danger">
                  {t('auth.loginError')}
                </div>
              )}

              <Input
                label={t('auth.email')}
                type="email"
                placeholder="you@example.com"
                error={errors.email ? t(`auth.${errors.email.message}`) : undefined}
                {...register('email')}
              />

              <Input
                label={t('auth.password')}
                type="password"
                placeholder="••••••••"
                error={errors.password ? t(`auth.${errors.password.message}`) : undefined}
                {...register('password')}
              />

              <div className="flex justify-end">
                <button
                  type="button"
                  className="text-xs text-primary hover:text-primary/80 transition-colors"
                >
                  {t('auth.forgotPassword')}
                </button>
              </div>

              <Button
                type="submit"
                className="w-full"
                isLoading={isLoading}
              >
                {t('auth.login')}
              </Button>
            </form>

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-card px-2 text-muted-foreground">{t('auth.or', 'or')}</span>
              </div>
            </div>

            {/* Google Sign-In */}
            <GoogleSignInButton text="signin_with" />

            <div className="mt-6 text-center">
              <span className="text-sm text-muted-foreground">
                {t('auth.noAccount')}{' '}
                <Link
                  to="/register"
                  className="text-primary hover:text-primary/80 font-medium transition-colors"
                >
                  {t('auth.signUp')}
                </Link>
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Login;
