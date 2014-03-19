var RStats = require('../vendor/rstats');
var rstats = new RStats({
  values: {
    'phys: time': { caption: 'time spent updating (ms)', over: 30 },
    'phys: steps': { caption: 'steps computed this update', over: 30 },
    fps: { caption: 'FPS (avg)', below: 58 },
    render: { caption: 'render duration (ms)' },
    raf: { caption: 'time since last rAF (ms)', over: 17, average: true },
    'msgs: main-recv': { caption: 'received per sec', interpolate: false },
    'msgs: latency': { caption: 'worker to main latency (ms)', interpolate: false },
    'msgs: main-queued': { caption: 'queue length', average: false },
    'msgs: read-time': { caption: 'queue processing (ms)' },
    'msgs: main-processed': { caption: 'number dequeued' },
  },
  groups: [
    {
      caption: 'Message Bus',
      values: [
        'msgs: main-recv',
        'msgs: latency',
        'msgs: main-queued',
        'msgs: read-time',
        'msgs: main-processed'
      ]
    },
    {
      caption: 'Rendering',
      values: ['render', 'raf', 'fps']
    },
    {
      caption: 'Physics',
      values: ['phys: time', 'phys: steps']
    }
  ],
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