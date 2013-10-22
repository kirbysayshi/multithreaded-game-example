
var Stats = require('../vendor/stats');

module.exports = function() {
  var s = new Stats();
  s.domElement.style.position = 'absolute';
  s.domElement.style.right = '0px';
  s.domElement.style.top = '0px';
  document.body.appendChild( s.domElement );
  return s;
}