
var Stats = require('../vendor/stats');

var lastPosition = 0;

module.exports = function(title) {
  var s = new Stats();

  if (title) {
    var titleDiv = document.createElement('div');
    titleDiv.textContent = title;
    titleDiv.style.cssText = 'padding:0 0 0 3px;text-align:left;background-color:#002;color:#0ff;font-family:Helvetica,Arial,sans-serif;font-size:9px;font-weight:bold;line-height:15px';
    s.domElement.insertBefore(titleDiv, s.domElement.querySelector('#fps'));
  }

  s.domElement.style.position = 'absolute';
  s.domElement.style.right = '0px';
  s.domElement.style.top = lastPosition + 'px';
  lastPosition += 100;
  document.body.appendChild( s.domElement );
  return s;
}