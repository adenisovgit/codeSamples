import * as enzyme from 'enzyme';
import { identity } from 'lodash';
import React from 'react';

import { describe, expect, it } from '@jest/globals';

import Notify from './Notify';

describe('Notify.jsx', () => {
  it('basic usage', () => {
    const component = enzyme.render(
      <Notify
        show
        closeButton
        y={1}
        z={10}
        onClick={identity}
        onCloseClick={identity}
        schema="green"
        content="content"
      />,
    );
    expect(component).toMatchSnapshot();
  });
});
