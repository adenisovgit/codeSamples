import { useEffect, useState } from 'react';

export interface zafClient {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  get: (key: string) => Promise<any>;
}
export const useZafClient = () => {
  const [zafClient, zetZafClient] = useState<zafClient>();
  useEffect(() => {
    if (zafClient) {
      return;
    }

    if (!zafClient) {
      const client = window.ZAFClient.init();

      if (!client) {
        console.error('could not init Zendesk API');
        return;
      }
      zetZafClient(client);
      client.invoke('resize', { width: '100%', height: '600px' });
    }
  }, [zafClient]);

  return zafClient;
};
