import base from 'paths.macro';
import React from 'react';
import { jsxDecorator } from 'storybook-addon-jsx';

import action from '@sbUtils/action';
import getAtomicName from '@sbUtils/getAtomicName';

import { boolean, number, select, withKnobs } from '@storybook/addon-knobs';

import Notify from './index';
import { colorSchema } from './variables';

export const Default = () => {
  const content = 'Well done! One more step and you’re there.';
  const notifyRef = React.useRef(null);
  return (
    <div>
      <Notify
        show={boolean('show', false)}
        closeButton={boolean('closeButton', true)}
        y={number('y', 100)}
        z={10}
        ref={notifyRef}
        onClick={action('onClick')}
        onCloseClick={action('onCloseClick')}
        schema={select('schema', [...Object.keys(colorSchema)])}
        content={content}
      />
    </div>
  );
};

export default {
  title: getAtomicName(base),
  decorators: [jsxDecorator, withKnobs],
};
