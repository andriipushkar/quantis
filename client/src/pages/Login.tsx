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
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-gold-gradient flex items-center justify-center mb-4">
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
