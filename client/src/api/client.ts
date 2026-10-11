export class ApiError extends Error {
  status: number;
  details?: any;

  constructor(message: string, status: number, details?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

/**
 * Attempts silent session refresh using the server-managed HttpOnly refresh token cookie.
 */
export async function silentRefreshSession(): Promise<{ token: string; user: any } | null> {
  try {
    const res = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
      credentials: 'include', // Automatically sends HttpOnly milk_refresh_token cookie
    });

    if (res.ok) {
      const data = await res.json();
      localStorage.setItem('milk_token', data.token);
      if (data.user) {
        localStorage.setItem('milk_user', JSON.stringify(data.user));
      }
      return data;
    }
  } catch (err) {
    // Network or server issue
  }
  return null;
}

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem('milk_token');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest', // Anti-CSRF protection header
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let response = await fetch(endpoint, {
    credentials: 'include', // Ensure cookies are included in all API calls
    ...options,
    headers,
  });

  // Handle 401 Unauthorized with automatic silent refresh
  if (response.status === 401) {
    const isAuthEndpoint =
      endpoint.includes('/api/auth/login') ||
      endpoint.includes('/api/auth/refresh') ||
      endpoint.includes('/api/auth/register-family') ||
      endpoint.includes('/api/auth/setup-pin');

    if (!isAuthEndpoint) {
      const refreshed = await silentRefreshSession();
      if (refreshed) {
        // Retry original request with newly issued access token
        headers['Authorization'] = `Bearer ${refreshed.token}`;
        response = await fetch(endpoint, {
          credentials: 'include',
          ...options,
          headers,
        });
      }
    }

    if (response.status === 401) {
      localStorage.removeItem('milk_token');
      localStorage.removeItem('milk_user');
      window.dispatchEvent(new Event('milk_unauthorized'));
      throw new ApiError('Session expired. Please log in again.', 401);
    }
  }

  const contentType = response.headers.get('content-type');
  let data: any = null;

  if (contentType && contentType.includes('application/json')) {
    data = await response.json();
  }

  if (!response.ok) {
    const errorMsg = data?.error || response.statusText || 'Request failed';
    throw new ApiError(errorMsg, response.status, data?.details);
  }

  return data as T;
}
