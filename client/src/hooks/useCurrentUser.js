import { useEffect, useState } from 'react';
import api from '../components/api';

export function useCurrentUser() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    api.get('/auth/me')
      .then((response) => {
        if (!isMounted) return;
        setUser(response.data ?? null);
        setError(null);
      })
      .catch((err) => {
        if (!isMounted) return;
        setUser(null);
        setError(err);
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return {
    user,
    loading,
    error,
    role: user?.role ?? null,
    roleLabel: user?.roleLabel ?? user?.role ?? '',
    fullName: user ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() : '',
  };
}

export default useCurrentUser;
