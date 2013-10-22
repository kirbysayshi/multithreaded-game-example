
var Stats = require('../vendor/stats');

var lastPosition = 0;

module.exports = function() {
  var s = new Stats();
  s.domElement.style.position = 'absolute';
  s.domElement.style.right = '0px';
  s.domElement.style.top = lastPosition + 'px';
  lastPosition += 100;
  document.body.appendChild( s.domElement );
  return s;
}