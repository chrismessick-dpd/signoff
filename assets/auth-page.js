/* signoff/auth.html: GitHub sends the person back here with a one-time code. Finish the sign-in and
   go back to the page they started from. */
(function () {
  'use strict';
  var title = document.getElementById('title');
  var text = document.getElementById('text');
  var actions = document.getElementById('actions');
  var back = document.getElementById('back');

  window.SignoffAuth.finish().then(function (r) {
    title.textContent = r.login ? 'Signed in as @' + r.login : 'Signed in';
    text.textContent = 'Taking you back…';
    location.replace(r.returnTo);
  }, function (err) {
    title.textContent = 'Sign-in didn’t finish';
    text.textContent = err.message || String(err);
    actions.hidden = false;
    back.focus();
  });
})();
