
console.log('running in SINGLE THREADED MODE');

var scihalt = require('science-halt');

var cvs = document.querySelector('#stage')
  , ctx = cvs.getContext('2d')
  , resizemon = require('./lib/resizemon')(cvs);

var statshelper = require('./lib/statshelper')
  , renderStats = statshelper('RENDER')
  , physStats = statshelper('PHYS');

var repeater = require('./lib/repeater');

var worker = require('./lib/worker')();

var BoidManager = require('./lib/boidmanager');
var boidman = new BoidManager;
var interpolationRatio = null;

window.addEventListener('message', function(ev) {

  console.log('msg', ev.data.type, ev.data);

  if (ev.data.type === 'step') {
    for (var i = 0; i < ev.data.snapshots.length; i++) {
      var snapshot = ev.data.snapshots[i];
      var boid = boidman.getinate(snapshot.id);
      boid.readFromSnapshot(snapshot);
    }

    //console.log('step', ev.data);
    physStats.begin(ev.data.startTime);
    physStats.end(ev.data.endTime);
    return;
  }

  // A tick implies that the worker checked to see if it was time
  // for an update.
  if (ev.data.type === 'tick') {
    interpolationRatio = ev.data.interpolationRatio;
    return;
  }

});

function graphics(dt, ratio) {
  renderStats.begin();
  ctx.clearRect(0, 0, cvs.width, cvs.height);
  var boids = boidman.all();
  for (var i = 0; i < boids.length; i++) {
    boids[i].draw(ctx, interpolationRatio);
  }
  renderStats.end();
}

// Call `graphics` as often as possible using `requestAnimationFrame`.
var repeaterCtl = repeater(graphics, requestAnimationFrame);
repeaterCtl.start();

scihalt(function() {
  repeaterCtl.stop();
  window.postMessage({ type: 'HALT' }, '*');
})
