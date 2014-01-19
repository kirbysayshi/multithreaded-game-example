
/**
 * Call a function as often as possible using either the provided
 * `immediateImplementation` function or `setTimeout`. You could pass,
 * for example, `requestAnimationFrame` or something like `process.nextTick`.
 * The callback is given the delta of time from when the callback was last
 * called (this includes the callback's previous execution time).
 */

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
