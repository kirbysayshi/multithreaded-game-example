
console.log('running in SINGLE THREADED MODE');

var scihalt = require('science-halt');

var cvs = document.querySelector('#stage')
  , ctx = cvs.getContext('2d')
  , resizemon = require('./lib/resizemon')(cvs);

var statshelper = require('./lib/statshelper')
  , renderStats = statshelper()
  , physStats = statshelper();

var BoidData = require('./lib/boiddata')
  , SSI = require('./lib/ssi');

var worker = require('./lib/worker')();

window.addEventListener('message', function(ev) {

  if (ev.data.type === 'new boid') {
    new BoidData(ev.data.update);
    return;
  }

  if (ev.data.type === 'boid updates') {
    for (var i = 0; i < ev.data.updates.length; i++) {
      BoidData.update(ev.data.updates[i])
    }
    physStats.end();
    return;
  }

});

function graphics(dt, ratio) {
  renderStats.begin();
  ctx.clearRect(0, 0, cvs.width, cvs.height);
  BoidData.drawAll(ctx, ratio);
  renderStats.end();
}

function logics(dt) {
  physStats.begin();
  window.postMessage({ type: 'logics', dt: dt }, '*');
}

var ssi = new SSI(1000 / 30, logics, graphics);

var last = Date.now()
  , running = true;

(function anim() {
  if (running) requestAnimationFrame(anim);
  var now = Date.now();
  ssi.update(now - last);
  last = now;
}());

scihalt(function() { running = false; })
