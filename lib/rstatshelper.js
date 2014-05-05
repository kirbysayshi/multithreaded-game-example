var config = require('./config');

var RStats = require('../vendor/rstats');
var wcolor = 'rgb(235, 255, 0)';
var rstats = new RStats({
  values: {
    'phys: time': { caption: 'time spent this step', over: 1000 / config.PHYSICS_HZ, warningColor: wcolor },
    'phys: steps': { caption: 'steps this update' },
    'phys: steps-computed-time': { caption: 'time spent updating (ms)', over: 1000 / config.PHYSICS_HZ, warningColor: wcolor },
    fps: { caption: 'FPS (avg)', below: 58, warningColor: wcolor },
    render: { caption: 'render duration (ms)' },
    raf: { caption: 'time since last rAF (ms)', over: 17, average: true, warningColor: wcolor },
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
      values: ['phys: time', 'phys: steps', 'phys: steps-computed-time']
    }
  ],
  /*fractions: [
    { base: 'phys: steps-computed-time', steps: ['phys: time'] }
  ],*/
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
