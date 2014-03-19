var RStats = require('../vendor/rstats');
var rstats = new RStats({
  values: {
    phys: { caption: 'Physics update (ms)', over: 30 },
    fps: { caption: 'Frame rate (avg per sec)', below: 58 },
    frame: { caption: 'Render Time (ms)' },
    raf: { caption: 'Time since last rAF (ms)', average: true },
    'msgs: main-recv': { interpolate: false },
    'msgs: latency': { interpolate: false }
  },
  CSSPath: 'vendor/'
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