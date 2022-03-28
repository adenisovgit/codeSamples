import cn from 'classnames';
import * as PropTypes from 'prop-types';
import React, { forwardRef, memo, useCallback } from 'react';
import { Transition } from 'react-transition-group';

import Icon from '../Icon';

import {
  notifyClassName,
  notifyCloseButtonDivClassName,
  notifyCloseButtonPrefixClassName,
  notifyContentClassName,
  notifySchemaIconClassName,
  notifySchemaPrefixClassName,
} from './classNames';
import { colorSchema, timeoutEnter, timeoutExit, transitionStylesNotify } from './variables';

const iconCloseName = 'Icons/close';

const Notify = forwardRef((props, ref) => {
  const {
    schema,
    show,
    y,
    z,
    closeButton,
    fixed,
    onCloseClick,
    onClick,
    content,
    ...restProps
  } = props;

  const computedClassNames = cn(notifyClassName, `${notifySchemaPrefixClassName}${schema}`);

  const handleClick = useCallback(
    (e) => {
      e.stopPropagation();
      if (typeof onClick === 'function') {
        onClick(e);
      }
    },
    [onClick],
  );

  const handleCloseClick = useCallback(
    (e) => {
      e.stopPropagation();
      if (typeof onCloseClick === 'function') {
        onCloseClick(e);
      }
    },
    [onCloseClick],
  );

  return (
    <Transition
      in={show}
      timeout={{
        enter: timeoutEnter,
        exit: timeoutExit,
      }}
      appear
      mountOnEnter
      unmountOnExit
    >
      {(state) => (
        <div
          className={computedClassNames}
          role="button"
          onClick={handleClick}
          ref={ref}
          {...restProps}
          style={{
            ...transitionStylesNotify(z, y)[state],
          }}
          data-cy="notify-bar"
        >
          <div className={notifyContentClassName}>
            <div className={notifySchemaIconClassName}>
              <Icon name={colorSchema[schema].iconName} />
            </div>
            {content}
          </div>
          <div className={notifyCloseButtonDivClassName}>
            <div className={`${notifyCloseButtonPrefixClassName}${schema}`}>
              {closeButton && (
                <Icon
                  className={`${notifyCloseButtonPrefixClassName}${schema}`}
                  name={iconCloseName}
                  onClick={handleCloseClick}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </Transition>
  );
});

export default memo(Notify);

Notify.displayName = 'Notify';

Notify.defaultProps = {
  schema: Object.keys(colorSchema)[0],
  show: false,
  y: 0,
  z: 1,
  closeButton: true,
  fixed: false,
  onCloseClick: null,
  onClick: null,
  content: null,
};

Notify.propTypes = {
  schema: PropTypes.oneOf(Object.keys(colorSchema)),
  show: PropTypes.bool,
  y: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  z: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  closeButton: PropTypes.bool,
  fixed: PropTypes.bool,
  onCloseClick: PropTypes.func,
  onClick: PropTypes.func,
  content: PropTypes.node,
};
