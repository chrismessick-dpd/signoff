/* Suite flows lab (signoff/lab/flows.html): the hub's Tool Structure page with every view, the Project tree
   included, and a theme switch. The code and styles are the hub's (assets/structure.js, structure.css). */
(function () {
  'use strict';
  window.SignoffStructure.mount(document.getElementById('lab'), {
    img: '../../signoff_pl/assets/demo-previews/', theme: true, storeKey: 'signoff.lab.flows.view'
  });
})();
