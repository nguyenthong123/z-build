import { useNavigate, useLocation } from 'react-router-dom';
import { useCallback } from 'react';

/**
 * Custom hook to handle safe back navigation.
 * It checks if there is a previous entry in the history stack created by the app.
 * If there is, it navigates back (-1).
 * If not (e.g., opened in a new tab or direct URL), it navigates to the provided fallback URL.
 */
export const useAppNavigation = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const goBack = useCallback((fallbackUrl = '/') => {
    // In react-router-dom v6+, location.key is 'default' for the first page load.
    // Any subsequent navigation within the app will generate a unique key.
    if (location.key !== 'default') {
      navigate(-1);
    } else {
      navigate(fallbackUrl, { replace: true });
    }
  }, [navigate, location]);

  return { goBack, navigate };
};
