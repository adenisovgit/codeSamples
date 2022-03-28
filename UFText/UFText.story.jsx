import path from 'path';

import base from 'paths.macro';
import React from 'react';
import { jsxDecorator } from 'storybook-addon-jsx';

import getAtomicName from '@sbUtils/getAtomicName';

import { withKnobs } from '@storybook/addon-knobs';

export const FakeStory = () => <div style={{ width: '100vw', height: '100vh' }} />;

export default {
  title: getAtomicName(path.dirname(base)),
  decorators: [jsxDecorator, withKnobs],
};
