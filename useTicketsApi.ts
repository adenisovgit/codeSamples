import { useState, useEffect } from 'react';
import { ticketsApiFetch, ticketsOpenApiFetch } from 'services/ticketsApi';
import { API_USE_MOCK } from '../utils/constants/UrlConstants';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const useTicketsApi = <T>(service: any, params?: any, initialData?: T, mockData?: any) => {
  const [data, setData] = useState<T | null>(initialData || null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<boolean>(false);

  useEffect(() => {
    const fetchAndSet = async () => {
      setLoading(true);
      let response;
      if (API_USE_MOCK) {
        response = await ticketsApiFetch(mockData);
      } else {
        response = await ticketsOpenApiFetch(service, params);
      }
      setData(response);
    };
    fetchAndSet()
      .catch((err) => {
        console.error(err);
        setError(true);
      })
      .finally(() => setLoading(false));
  }, [mockData, params, service]);

  return [data, loading, error] as [T, boolean, boolean];
};
