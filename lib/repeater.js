// shims the global to include setimmediate, including workers.
//require('setimmediate');

module.exports = function(cb, immediateImpl) {
  var last = null
    , running = true;

  // Use whatever is passed in to add to the run loop.
  immediateImpl = immediateImpl || setTimeout;

  function next() {
    if (running) immediateImpl(next);
    var now = Date.now();
    cb(now - last);
    last = now;
  }

  return {
    stop: function() { running = false; },
    start: function() {
      last = Date.now();
      next();
    }
  }
}
