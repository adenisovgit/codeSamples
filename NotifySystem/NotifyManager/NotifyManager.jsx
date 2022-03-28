import * as PropTypes from 'prop-types';
import React from 'react';

import Notify from '@atoms/Notify';

const NotifyManager = (props) => {
  const { notifications, stopTimer, restartTimer } = props;

  const handleStopTimer = (id) => () => stopTimer(id);
  const handleRestartTimer = (id) => () => restartTimer(id);

  let elementYPosition = 0;
  return notifications.map((notification, index) => {
    const {
      id,
      schema,
      content,
      closeButton,
      fixed,
      onClick,
      onCloseClick,
      ref,
      show,
    } = notification;
    const elementHeight = 0 || (ref.current && ref.current.offsetHeight);
    const elementY = show ? elementYPosition : 0;
    elementYPosition += show ? elementHeight : 0;
    return (
      <Notify
        key={id}
        y={elementY}
        z={notifications.length - index}
        schema={schema}
        content={content}
        closeButton={closeButton}
        fixed={fixed}
        onClick={onClick}
        onCloseClick={onCloseClick}
        show={show}
        ref={ref}
        onMouseEnter={fixed ? null : handleStopTimer(id)}
        onMouseLeave={fixed ? null : handleRestartTimer(id)}
      />
    );
  });
};

NotifyManager.displayName = 'NotifyManager';

NotifyManager.propTypes = {
  notifications: PropTypes.arrayOf(PropTypes.object).isRequired,
  stopTimer: PropTypes.func.isRequired,
  restartTimer: PropTypes.func.isRequired,
};

export default NotifyManager;
