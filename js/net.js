// Bridge: the shared online.js is an ES module, the rest of the site is plain
// scripts. This hands createOnline to app.js. Firebase itself only loads when a
// room is created or joined.
import { createOnline } from './online.js?v=a3d0418b';
self.CarcNet = { createOnline };
window.dispatchEvent(new Event('carcnet'));
