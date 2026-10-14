import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useAuth } from '../../../context/AuthContext';
import {
  fetchAdsConfig,
  fetchMyEntitlement,
} from '../services/subscriptionService';

const EntitlementContext = createContext(null);

const EMPTY_ENTITLEMENT = {
  adFreeActive: false,
  subscriptionStatus: 'none',
  currentPeriodEnd: null,
  currentPeriodStart: null,
  renewalStatus: 'none',
  cancelAtPeriodEnd: false,
  canceledAt: null,
  platform: null,
  provider: null,
  planCode: null,
};

const EMPTY_ADS = {
  adFreeActive: false,
  provider: 'none',
  adsenseClientId: '',
  placements: {
    home_feed: false,
    community_feed: false,
    marketplace_browse: false,
    feed_banner: false,
  },
  slots: {},
  nonRemovableCategories: [],
};

export function EntitlementProvider({ children }) {
  const { user } = useAuth();
  const [entitlement, setEntitlement] = useState(EMPTY_ENTITLEMENT);
  const [ads, setAds] = useState(EMPTY_ADS);
  const [loading, setLoading] = useState(true);

  const refreshEntitlement = useCallback(async () => {
    if (!user) {
      setEntitlement(EMPTY_ENTITLEMENT);
      try {
        const data = await fetchAdsConfig();
        setAds(data?.ads || EMPTY_ADS);
      } catch {
        setAds(EMPTY_ADS);
      } finally {
        setLoading(false);
      }
      return EMPTY_ENTITLEMENT;
    }

    setLoading(true);
    try {
      const [entData, adsData] = await Promise.all([
        fetchMyEntitlement(),
        fetchAdsConfig(),
      ]);
      const next = entData?.entitlement || EMPTY_ENTITLEMENT;
      setEntitlement(next);
      setAds(adsData?.ads || EMPTY_ADS);
      return next;
    } catch {
      setEntitlement(EMPTY_ENTITLEMENT);
      setAds(EMPTY_ADS);
      return EMPTY_ENTITLEMENT;
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refreshEntitlement();
  }, [refreshEntitlement]);

  // Refresh when the tab becomes visible again (resume / foreground).
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        refreshEntitlement();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [refreshEntitlement]);

  const value = useMemo(
    () => ({
      entitlement,
      ads,
      loading,
      adFreeActive: Boolean(entitlement?.adFreeActive || ads?.adFreeActive),
      refreshEntitlement,
      shouldShowPlacement: (placementId) =>
        Boolean(ads?.placements?.[placementId]) &&
        !Boolean(entitlement?.adFreeActive || ads?.adFreeActive),
    }),
    [entitlement, ads, loading, refreshEntitlement]
  );

  return (
    <EntitlementContext.Provider value={value}>
      {children}
    </EntitlementContext.Provider>
  );
}

export function useEntitlement() {
  const ctx = useContext(EntitlementContext);
  if (!ctx) {
    throw new Error('useEntitlement must be used within EntitlementProvider');
  }
  return ctx;
}
