import { uniqueId } from 'lodash';
import base from 'paths.macro';
import React from 'react';
import { jsxDecorator } from 'storybook-addon-jsx';

import action from '@sbUtils/action';
import getAtomicName from '@sbUtils/getAtomicName';

import { withKnobs } from '@storybook/addon-knobs';

import { colorSchema } from '@atoms/Notify/variables';

import Button from '../Button';

// eslint-disable-next-line import/extensions
import showNotification from './notifySystem.jsx';

import './NotifyManager.scss';

const colorSchemas = Object.keys(colorSchema);

export const Default = () => {
  const notifs = [];

  const shoot = (args) => {
    const notifyId = uniqueId();
    const schema = colorSchemas[Math.floor(Math.random() * 4) + 1];
    const content = `${notifyId} Welcome to the real world ${args.content || ''}`;
    const notify = { notifyId, schema, ...args, content };
    notifs.push(notify);
    showNotification(notify);
  };

  const addNotification = () => {
    shoot({
      closeButton: true,
      fixed: false,
      onClick: action('addNotification'),
    });
  };

  const addNoCloseNotification = () => {
    shoot({
      closeButton: false,
      fixed: false,
      onClick: action('addNoCloseNotification'),
    });
  };

  const addFixedNotification = () => {
    shoot({
      closeButton: true,
      fixed: true,
      onClick: action('addFixedNotification'),
    });
  };

  const addLongNotification = () => {
    // noinspection SpellCheckingInspection
    shoot({
      closeButton: true,
      fixed: false,
      onClick: action('addLongNotification'),
      content:
        // eslint-disable-next-line max-len
        'Welcome to the real world Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua',
    });
  };

  const repeatRandomNotification = () => {
    const indexToRepeat = notifs.length - Math.floor(Math.random() * 3) - 1;
    showNotification(notifs[indexToRepeat]);
  };

  return (
    <div className="fieldN">
      <Button color="blue" narrow text="Notification" onClick={addNotification} />
      <Button color="blue" narrow text="noClose" onClick={addNoCloseNotification} />
      <Button color="blue" narrow text="Fixed" onClick={addFixedNotification} />
      <Button color="blue" narrow text="Long" onClick={addLongNotification} />
      <Button
        color="green"
        narrow
        text="Repeat random notification"
        onClick={repeatRandomNotification}
      />
    </div>
  );
};

export default {
  title: getAtomicName(base),
  decorators: [jsxDecorator, withKnobs],
};
