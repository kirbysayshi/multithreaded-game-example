var RStats = require('../vendor/rstats');
var rstats = new RStats({
  values: {
    phys: { caption: 'Time per physics update (ms)', over: 30 },
    fps: { caption: 'Frame rate', below: 60 },
    frame: { caption: 'Time spent drawing (ms)' },
    rAF: { caption: 'Time since last rAF (ms)' }
  }
});

module.exports = rstats;