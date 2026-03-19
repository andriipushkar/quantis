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

const registerSchema = z
  .object({
    email: z.string().min(1, 'emailRequired').email('invalidEmail'),
    password: z.string().min(8, 'passwordMinLength'),
    confirmPassword: z.string().min(1, 'passwordRequired'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'passwordsMustMatch',
    path: ['confirmPassword'],
  });

type RegisterForm = z.infer<typeof registerSchema>;

const Register: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { register: registerUser, isLoading, error, clearError } = useAuthStore();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterForm) => {
    try {
      clearError();
      await registerUser(data.email, data.password);
      navigate('/');
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
          <p className="text-muted-foreground text-sm mt-1">{t('auth.createAccount')}</p>
        </div>

        <Card className="border-border/50">
          <CardContent className="p-6">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {error && (
                <div className="bg-danger/10 border border-danger/25 rounded-lg px-4 py-3 text-sm text-danger">
                  {t('auth.registerError')}
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

              <Input
                label={t('auth.confirmPassword')}
                type="password"
                placeholder="••••••••"
                error={errors.confirmPassword ? t(`auth.${errors.confirmPassword.message}`) : undefined}
                {...register('confirmPassword')}
              />

              <Button
                type="submit"
                className="w-full"
                isLoading={isLoading}
              >
                {t('auth.register')}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <span className="text-sm text-muted-foreground">
                {t('auth.hasAccount')}{' '}
                <Link
                  to="/login"
                  className="text-primary hover:text-primary/80 font-medium transition-colors"
                >
                  {t('auth.signIn')}
                </Link>
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Register;
