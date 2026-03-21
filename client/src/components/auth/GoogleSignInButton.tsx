import React, { useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth';

// Google Identity Services types
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            auto_select?: boolean;
            context?: string;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: {
              theme?: 'outline' | 'filled_blue' | 'filled_black';
              size?: 'large' | 'medium' | 'small';
              width?: number;
              text?: 'signin_with' | 'signup_with' | 'continue_with';
              shape?: 'rectangular' | 'pill' | 'circle' | 'square';
              logo_alignment?: 'left' | 'center';
              locale?: string;
            }
          ) => void;
        };
      };
    };
  }
}

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

interface GoogleSignInButtonProps {
  text?: 'signin_with' | 'signup_with' | 'continue_with';
  onSuccess?: () => void;
}

export const GoogleSignInButton: React.FC<GoogleSignInButtonProps> = ({
  text = 'continue_with',
  onSuccess,
}) => {
  const buttonRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { googleLogin } = useAuthStore();

  const handleCredentialResponse = useCallback(
    async (response: { credential: string }) => {
      try {
        await googleLogin(response.credential);
        onSuccess?.();
        navigate('/dashboard');
      } catch {
        // Error handled by store
      }
    },
    [googleLogin, navigate, onSuccess]
  );

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;

    const initGoogle = () => {
      if (!window.google || !buttonRef.current) return;

      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleCredentialResponse,
      });

      window.google.accounts.id.renderButton(buttonRef.current, {
        theme: 'filled_black',
        size: 'large',
        width: 350,
        text,
        shape: 'rectangular',
        logo_alignment: 'center',
      });
    };

    // If script already loaded
    if (window.google) {
      initGoogle();
      return;
    }

    // Load Google Identity Services script
    const existingScript = document.querySelector('script[src*="accounts.google.com/gsi/client"]');
    if (existingScript) {
      existingScript.addEventListener('load', initGoogle);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = initGoogle;
    document.head.appendChild(script);
  }, [handleCredentialResponse, text]);

  if (!GOOGLE_CLIENT_ID) return null;

  return <div ref={buttonRef} className="flex justify-center" />;
};

export default GoogleSignInButton;
