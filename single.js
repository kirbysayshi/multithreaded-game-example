
console.log('running in SINGLE THREADED MODE');

var scihalt = require('science-halt');

var config = require('./lib/config');

var cvs = document.querySelector('#stage')
  , ctx = cvs.getContext('2d')
  , resizemon = require('./lib/resizemon')(cvs);

var rstats = require('./lib/rstatshelper');

var repeater = require('./lib/repeater');

var worker = require('./lib/worker')();

var BoidManager = require('./lib/boidmanager');
var boidman = new BoidManager;
var lastSnapshotReceivedAt = performance.now();

var mm = require('./lib/messagemanager')();
mm._write = function(msg) {
  rstats('msgs: main-recv').tick();
  rstats('msgs: main-queued').set(rstats('msgs: main-queued').value() + 1);
  this._queue(msg);
}

function message(msg) {

  rstats('msgs: main-queued').set(rstats('msgs: main-queued').value() - 1);

  // A full step contains snapshots.
  if (msg.type === 'step') {
    for (var i = 0; i < msg.snapshots.length; i++) {
      var snapshot = msg.snapshots[i];
      var boid = boidman.getinate(snapshot.id);
      boid.readFromSnapshot(snapshot);
    }

    // TODO: there has to be a better way to do this?
    lastSnapshotReceivedAt = performance.now();

    rstats('phys').set(msg.endTime - msg.startTime);
    return;
  }
}

function graphics(dt) {
  var now = performance.now();

  rstats('msgs: read-time').start();
  var total = mm.read(message);
  rstats('msgs: read-time').end();
  rstats('msgs: main-processed').set(total);

  rstats('frame').start();
  rstats('FPS').frame();
  rstats('rAF').tick();
  ctx.clearRect(0, 0, cvs.width, cvs.height);
  var ratio = (now - lastSnapshotReceivedAt) / 1000 / config.PHYSICS_HZ;
  var boids = boidman.all();
  for (var i = 0; i < boids.length; i++) {
    boids[i].draw(ctx, ratio);
  }
  rstats('frame').end();
  rstats().update();
}

// Call `graphics` as often as possible using `requestAnimationFrame`.
var repeaterCtl = repeater(graphics, requestAnimationFrame);
repeaterCtl.start();

scihalt(function() {
  repeaterCtl.stop();
  mm.write({ type: 'HALT' });
})
