// noinspection ES6PreferShortImport
import {
  darkGreen,
  green,
  lightGreen,
  notifyBlue,
  notifyYellowColor,
  red,
  yellow,
} from '../../../variables/colors';

export const colorSchema = {
  blue: {
    background: notifyBlue,
    color: notifyBlue,
    closeButtonColor: notifyBlue,
    iconName: 'Notifications/exclamation_blue',
  },
  green: {
    background: lightGreen,
    color: darkGreen,
    closeButtonColor: green,
    iconName: 'Notifications/checkmark_rounded',
  },
  red: {
    background: red,
    color: red,
    closeButtonColor: red,
    iconName: 'Notifications/exclamation_red',
  },
  yellow: {
    background: yellow,
    color: notifyYellowColor,
    closeButtonColor: notifyYellowColor,
    iconName: 'Notifications/exclamation_triangled',
  },
};

export const transitionTiming = 300;
export const timeoutEnter = 10;
export const timeoutExit = transitionTiming;
const timingFunction = 'linear';
const translateYValue = 70;

export const transitionStylesNotify = (z, y) => ({
  entering: {
    zIndex: z,
    opacity: 0,
    transform: `translateY(${y - translateYValue}px)`,
  },
  entered: {
    zIndex: z,
    opacity: 1,
    transform: `translateY(${y}px)`,
    transition: `opacity ${transitionTiming}ms ${timingFunction}, 
      transform ${transitionTiming}ms ${timingFunction}`,
  },
  exiting: {
    zIndex: z,
    opacity: 0,
    transition: `opacity ${transitionTiming}ms ${timingFunction}, 
      transform ${transitionTiming}ms ${timingFunction}`,
    transform: `translateY(${y - translateYValue}px)`,
  },
  exited: {},
});
