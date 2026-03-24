/**
 * Auth store — deep branch coverage tests
 *
 * Tests login/register/logout/loadUser/googleLogin with success and error paths.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock API functions
const mockApiLogin = vi.fn();
const mockApiRegister = vi.fn();
const mockApiGoogleLogin = vi.fn();
const mockApiLogout = vi.fn();
const mockGetProfile = vi.fn();
const mockGetToken = vi.fn(() => 'test-token');
const mockClearToken = vi.fn();

vi.mock('@/services/api', () => ({
  login: (...args: any[]) => mockApiLogin(...args),
  register: (...args: any[]) => mockApiRegister(...args),
  googleLogin: (...args: any[]) => mockApiGoogleLogin(...args),
  logout: (...args: any[]) => mockApiLogout(...args),
  getProfile: (...args: any[]) => mockGetProfile(...args),
  getToken: () => mockGetToken(),
  clearToken: () => mockClearToken(),
}));

describe('useAuthStore', () => {
  let useAuthStore: typeof import('@/stores/auth').useAuthStore;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    const mod = await import('@/stores/auth');
    useAuthStore = mod.useAuthStore;
  });

  describe('initial state', () => {
    it('has token from getToken()', () => {
      const state = useAuthStore.getState();
      expect(state.token).toBe('test-token');
    });

    it('is authenticated when token exists', () => {
      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(true);
    });

    it('is not authenticated when no token', async () => {
      mockGetToken.mockReturnValue(null);
      vi.resetModules();
      const mod = await import('@/stores/auth');
      const state = mod.useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
    });

    it('user is null initially', () => {
      expect(useAuthStore.getState().user).toBeNull();
    });

    it('isLoading is false initially', () => {
      expect(useAuthStore.getState().isLoading).toBe(false);
    });

    it('error is null initially', () => {
      expect(useAuthStore.getState().error).toBeNull();
    });
  });

  describe('login', () => {
    it('sets user and token on success', async () => {
      const mockUser = { id: '1', email: 'a@b.com', tier: 'pro' };
      mockApiLogin.mockResolvedValue({ user: mockUser, token: 'new-token' });

      await useAuthStore.getState().login('a@b.com', 'pass');

      const state = useAuthStore.getState();
      expect(state.user).toEqual(mockUser);
      expect(state.token).toBe('new-token');
      expect(state.isAuthenticated).toBe(true);
      expect(state.isLoading).toBe(false);
    });

    it('sets error on failure with Error instance', async () => {
      mockApiLogin.mockRejectedValue(new Error('Invalid credentials'));

      await expect(useAuthStore.getState().login('a@b.com', 'wrong')).rejects.toThrow();

      const state = useAuthStore.getState();
      expect(state.error).toBe('Invalid credentials');
      expect(state.isLoading).toBe(false);
    });

    it('sets generic error on failure with non-Error', async () => {
      mockApiLogin.mockRejectedValue('string error');

      await expect(useAuthStore.getState().login('a@b.com', 'wrong')).rejects.toBeDefined();

      expect(useAuthStore.getState().error).toBe('Login failed');
    });

    it('sets isLoading=true during request', async () => {
      let resolvePromise: Function;
      mockApiLogin.mockReturnValue(new Promise((r) => { resolvePromise = r; }));

      const loginPromise = useAuthStore.getState().login('a@b.com', 'pass');
      expect(useAuthStore.getState().isLoading).toBe(true);

      resolvePromise!({ user: {}, token: 't' });
      await loginPromise;
      expect(useAuthStore.getState().isLoading).toBe(false);
    });
  });

  describe('register', () => {
    it('sets user and token on success', async () => {
      const mockUser = { id: '2', email: 'b@c.com', tier: 'starter' };
      mockApiRegister.mockResolvedValue({ user: mockUser, token: 'reg-token' });

      await useAuthStore.getState().register('b@c.com', 'pass123');

      expect(useAuthStore.getState().user).toEqual(mockUser);
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
    });

    it('sets error on failure with Error instance', async () => {
      mockApiRegister.mockRejectedValue(new Error('Email taken'));

      await expect(useAuthStore.getState().register('b@c.com', 'pass')).rejects.toThrow();
      expect(useAuthStore.getState().error).toBe('Email taken');
    });

    it('sets generic error on failure with non-Error', async () => {
      mockApiRegister.mockRejectedValue(42);

      await expect(useAuthStore.getState().register('b@c.com', 'pass')).rejects.toBeDefined();
      expect(useAuthStore.getState().error).toBe('Registration failed');
    });
  });

  describe('googleLogin', () => {
    it('sets user and token on success', async () => {
      const mockUser = { id: '3', email: 'g@g.com', tier: 'pro' };
      mockApiGoogleLogin.mockResolvedValue({ user: mockUser, token: 'g-token' });

      await useAuthStore.getState().googleLogin('credential-abc');

      expect(useAuthStore.getState().user).toEqual(mockUser);
      expect(useAuthStore.getState().token).toBe('g-token');
    });

    it('sets error on failure', async () => {
      mockApiGoogleLogin.mockRejectedValue(new Error('OAuth failed'));

      await expect(useAuthStore.getState().googleLogin('bad')).rejects.toThrow();
      expect(useAuthStore.getState().error).toBe('OAuth failed');
    });

    it('sets generic error for non-Error rejection', async () => {
      mockApiGoogleLogin.mockRejectedValue(null);

      await expect(useAuthStore.getState().googleLogin('bad')).rejects.toBeDefined();
      expect(useAuthStore.getState().error).toBe('Google login failed');
    });
  });

  describe('logout', () => {
    it('clears user and token', async () => {
      // First log in
      mockApiLogin.mockResolvedValue({ user: { id: '1' }, token: 't' });
      await useAuthStore.getState().login('a@b.com', 'pass');
      expect(useAuthStore.getState().isAuthenticated).toBe(true);

      // Then log out
      mockApiLogout.mockResolvedValue(undefined);
      await useAuthStore.getState().logout();

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.token).toBeNull();
      expect(state.isAuthenticated).toBe(false);
    });
  });

  describe('loadUser', () => {
    it('loads user profile when token exists', async () => {
      mockGetToken.mockReturnValue('valid-token');
      const mockUser = { id: '1', email: 'a@b.com', tier: 'pro' };
      mockGetProfile.mockResolvedValue(mockUser);

      await useAuthStore.getState().loadUser();

      expect(useAuthStore.getState().user).toEqual(mockUser);
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
    });

    it('clears auth when no token', async () => {
      mockGetToken.mockReturnValue(null);

      await useAuthStore.getState().loadUser();

      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      expect(useAuthStore.getState().user).toBeNull();
    });

    it('clears auth on profile fetch error', async () => {
      mockGetToken.mockReturnValue('expired-token');
      mockGetProfile.mockRejectedValue(new Error('Unauthorized'));

      await useAuthStore.getState().loadUser();

      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      expect(useAuthStore.getState().user).toBeNull();
      expect(mockClearToken).toHaveBeenCalled();
    });
  });

  describe('clearError', () => {
    it('clears the error', async () => {
      mockApiLogin.mockRejectedValue(new Error('fail'));
      await useAuthStore.getState().login('a', 'b').catch(() => {});
      expect(useAuthStore.getState().error).toBe('fail');

      useAuthStore.getState().clearError();
      expect(useAuthStore.getState().error).toBeNull();
    });
  });
});
