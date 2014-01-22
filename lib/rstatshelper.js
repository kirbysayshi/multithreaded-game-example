var RStats = require('../vendor/rstats');
var rstats = new RStats({
  values: {
    phys: { caption: 'Time per physics update (ms)', over: 30 },
    fps: { caption: 'Frame rate', below: 58 },
    frame: { caption: 'Time spent drawing (ms)' },
    rAF: { caption: 'Time since last rAF (ms)' }
  }
});

module.exports = function(id) {
  if (enabled) return rstats(id);
  else return facade;
}

var enabled = true;
var noop = function() {};
var facade = {
  update: noop,
  set: noop,
  start: noop,
  end: noop,
  frame: noop,
  tick: noop
}

module.exports.toggle = function() {
  enabled = !enabled;
}