import { identity, uniqueId } from 'lodash';
import React from 'react';
import ReactDOM from 'react-dom';

import { notifyLayerClassName } from '@atoms/Notify/classNames';
import { transitionTiming } from '@atoms/Notify/variables';

import { createDomInjecter, createElement } from '@utils/DOM';

import NotifyManager from './NotifyManager';

const notifyLayerNode = createElement('div', { class: notifyLayerClassName });
const injectNotifyLayerNode = createDomInjecter(notifyLayerNode);

const notifyTimeout = 3000;
const notifications = [];

const stopTimer = (id) => {
  const notifyIndex = notifications.findIndex((el) => el.id === id);
  if (notifyIndex < 0) {
    return;
  }
  clearTimeout(notifications[notifyIndex].timerId);
};

const restartTimer = (id) => {
  const notify = notifications.find((el) => el.id === id);
  if (!notify) {
    return;
  }
  // eslint-disable-next-line no-use-before-define
  notify.timerId = setTimeout(hideNotification(id), notifyTimeout / 2);
};

const updateNotifies = () => {
  ReactDOM.render(
    <NotifyManager
      notifications={notifications}
      stopTimer={stopTimer}
      restartTimer={restartTimer}
    />,
    notifyLayerNode,
  );
};

const deleteNotification = (id) => () => {
  const notifyIndex = notifications.findIndex((el) => el.id === id);
  if (notifyIndex < 0) {
    return;
  }
  stopTimer(id);
  notifications.splice(notifyIndex, 1);
  updateNotifies();
};

const hideNotification = (notifyID) => () => {
  const notifyIndex = notifications.findIndex(({ id }) => id === notifyID);
  if (notifyIndex < 0) {
    return;
  }
  notifications[notifyIndex].show = false;
  setTimeout(deleteNotification(notifyID), transitionTiming);
  updateNotifies();
};

export default function showNotification({
  notifyId,
  schema,
  content,
  closeButton = true,
  fixed = false,
  onClick = identity,
}) {
  injectNotifyLayerNode();

  const notificationsToRemove = notifications.filter((notif) => notif.notifyId === notifyId);
  notificationsToRemove.forEach((notif) => {
    clearTimeout(notif.timerId);
    hideNotification(notif.id)();
  });

  const ref = React.createRef();
  const id = uniqueId();
  const closeTimerId = !fixed && setTimeout(hideNotification(id), notifyTimeout);
  const notificationObject = {
    id,
    notifyId,
    schema,
    content,
    closeButton,
    fixed,
    onClick,
    ref,
    onCloseClick: hideNotification(id),
    show: true,
    timerId: closeTimerId,
  };
  notifications.push(notificationObject);
  updateNotifies();
}
