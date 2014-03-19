
console.log('running in MULTI THREADED MODE');

var work = require('webworkify')
  , scihalt = require('science-halt');

var config = require('./lib/config');

var cvs = document.querySelector('#stage')
  , ctx = cvs.getContext('2d')
  , resizemon = require('./lib/resizemon')(cvs);

var rstats = require('./lib/rstatshelper');

var repeater = require('./lib/repeater');

var worker = work(require('./lib/worker'));

var BoidManager = require('./lib/boidmanager');
var boidman = new BoidManager;
var lastSnapshotReceivedAt = performance.now();

var mm = require('./lib/messagemanager')();
worker.addEventListener('message', function(ev) {
  mm._queue(ev.data);
  rstats('msgs: main-recv').flow(1);
  rstats('msgs: latency').set(Date.now() - ev.data.postedAt);
});
mm._write = function(msg) {
  worker.postMessage(msg);
}

function message(msg) {

  // A full step contains snapshots.
  if (msg.type === 'physics:step') {
    for (var i = 0; i < msg.snapshots.length; i++) {
      var snapshot = msg.snapshots[i];
      var boid = boidman.getinate(snapshot.id);
      boid.readFromSnapshot(snapshot);
    }

    // TODO: there has to be a better way to do this?
    lastSnapshotReceivedAt = performance.now();

    rstats('phys: time').set(msg.computedTime);
    return true; // mark message as received
  }

  if (msg.type === 'physics:timing') {
    rstats('phys: steps').set(msg.steps);
    rstats('phys: steps-computed-time').set(msg.computedTime);
    return true;
  }
}

function graphics(dt) {
  var now = performance.now();

  rstats('msgs: read-time').start();
  var total = mm.read(message);
  rstats('msgs: read-time').end();
  rstats('msgs: main-processed').set(total);

  rstats('render').start();
  ctx.clearRect(0, 0, cvs.width, cvs.height);
  var ratio = (now - lastSnapshotReceivedAt) / 1000 / config.PHYSICS_HZ;
  var boids = boidman.all();
  for (var i = 0; i < boids.length; i++) {
    boids[i].draw(ctx, ratio);
  }
  rstats('render').end();
}

function graph() {
  rstats('raf').tick();
  rstats('FPS').frame();
  rstats('msgs: main-recv').flow(0);
  rstats('msgs: main-queued').set(mm.length());
  rstats().update();
}

// Call `graphics` as often as possible using `requestAnimationFrame`.
var gfxCtl = repeater(graphics, requestAnimationFrame);
gfxCtl.start();

scihalt(function() {
  gfxCtl.stop();
  mm.write({ type: 'HALT' });
});

var graphCtl = repeater(graph, requestAnimationFrame);
graphCtl.start();

scihalt(function() {
  graphCtl.stop();
}, 'GRAPH!', 81);


