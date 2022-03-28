Banner notifications system.

```
import { showNotification } from '@molecules/NotifyManager';

showNotification({
        notifyId: 'Expired',
        schema: 'red',
        content: t('updatePlan.expiredNotify', { plan: capitalize(tariffID) }),
        fixed: true,
        onClick: openUpdateModal,
      });
```
