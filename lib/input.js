var kb = require('kb-controls');
var config = require('./config');
var ctl = kb(config.controlMap);

module.exports = function init(transport) {
  var mouseX = 0, mouseY = 0;
  document.addEventListener('mousemove', function(e) {
    mouseX = e.clientX;
    mouseY = e.clientY;
  });

  return {
    poll: function() {
      var kbstate = Object.keys(ctl).reduce(function(accum, curr) {
        var val = ctl[curr];
        if (val == 0 || val == 1) {
          accum[curr] = val;
        }
        return accum;
      }, {})
      console.log(ctl);
      transport({ type: 'input', pointerX: mouseX, pointerY: mouseX, kb: kbstate });
    }
  }
}