import { Capacitor, registerPlugin } from '@capacitor/core';
export const stepsAvailable = Capacitor.getPlatform() === 'android';
const plugin = registerPlugin('GramixSteps');
export const readSteps = (uid, method = 'getToday') => plugin[method]({ uid });
export const watchSteps = listener => plugin.addListener('stepsChanged', listener);
export const pauseSteps = uid => plugin.pause({ uid });
