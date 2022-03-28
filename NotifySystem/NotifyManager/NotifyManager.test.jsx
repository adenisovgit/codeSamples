import * as enzyme from 'enzyme';
import { identity } from 'lodash';
import React from 'react';

import { describe, expect, it } from '@jest/globals';

import { showNotification } from './index';
import NotifyManager from './NotifyManager';

const notifications = [
  {
    notifyId: 1,
    id: 31415,
    schema: 'green',
    content: 'abrakadabra',
    closeButton: true,
    fixed: false,
    ref: React.createRef(),
  },
];
describe('NotifyManager.jsx', () => {
  it('Test rendering', () => {
    const component = enzyme.mount(
      <NotifyManager notifications={notifications} stopTimer={identity} restartTimer={identity} />,
    );
    expect(component).toMatchSnapshot();
  });

  it('Testing for stopTimer', (done) => {
    function stopTimer(data) {
      try {
        expect(data).toBe(notifications[0].id);
        done();
      } catch (error) {
        done(error);
      }
    }
    const component = enzyme.shallow(
      <NotifyManager notifications={notifications} stopTimer={stopTimer} restartTimer={identity} />,
    );
    const notif = component.find({ content: notifications[0].content });

    notif.simulate('mouseenter');
  });

  it('Testing for restartTimer', (done) => {
    function restartTimer(data) {
      try {
        expect(data).toBe(notifications[0].id);
        done();
      } catch (error) {
        done(error);
      }
    }
    const component = enzyme.shallow(
      <NotifyManager
        notifications={notifications}
        stopTimer={identity}
        restartTimer={restartTimer}
      />,
    );
    const notif = component.find({ content: notifications[0].content });
    notif.simulate('mouseleave');
  });
});

describe('notifySystem.jsx', () => {
  it('Test notification rendering', () => {
    showNotification({
      notifyId: 2134,
      schema: 'green',
      content: 'avadakedavra',
    });
    document.querySelector('.notify--schema-green');
  });
});
