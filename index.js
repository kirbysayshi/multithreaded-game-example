
var work = require('webworkify')
  , SSI = require('./lib/ssi')

var cvs = document.querySelector('#stage')
  , ctx = cvs.getContext('2d');

function resize(e) {
  cvs.width = document.body.clientWidth;
  cvs.height = document.body.clientHeight;
}

window.addEventListener('resize', resize, false);
resize();

var renderStats = new Stats();
renderStats.domElement.style.position = 'absolute';
renderStats.domElement.style.right = '0px';
renderStats.domElement.style.top = '0px';
document.body.appendChild( renderStats.domElement );

var physStats = new Stats();
physStats.domElement.style.position = 'absolute';
physStats.domElement.style.right = '0px';
physStats.domElement.style.top = '100px';
document.body.appendChild( physStats.domElement );

var worker = work(require('./lib/worker'));

var knownBoids = {};

worker.addEventListener('message', function(ev) {

  if (ev.data.type === 'new boid') {
    initializeBoidStruct(ev.data.id, ev.data.update);

    // This is for initial debugging purposes.
    drawBoid(knownBoids[ev.data.id], 1);
    return;
  }

  if (ev.data.type === 'boid updates') {
    for (var i = 0; i < ev.data.updates.length; i++) {
      updateBoidStruct(ev.data.updates[i]);
    }
    physStats.end();
    return;
  }

});

function initializeBoidStruct(id, data) {
  // Mark this boid as "known"
  knownBoids[id] = boidStruct(id);
  // Do the same as if we're just updating the boid on a tick.
  var boidData = updateBoidStruct(data);
  // Manually set the previous position to current to avoid interpolating
  // between 0 and current.
  boidData.px = boidData.cx;
  boidData.py = boidData.cy;
}

function boidStruct(id) {
  return {
    id: id,
    px: 0,
    py: 0,
    cx: 0,
    cy: 0,
    radius: 0
  }
}

function updateBoidStruct(data) {
  var boidData = knownBoids[data.id];
  boidData.px = boidData.cx;
  boidData.py = boidData.cy;
  boidData.cx = data.x;
  boidData.cy = data.y;
  boidData.radius = data.radius;
  return boidData;
}

function drawBoid(boid, ratio) {
  var oneMinusRatio = 1 - ratio;
  var x = (boid.cx * ratio) + (boid.px * oneMinusRatio);
  var y = (boid.cy * ratio) + (boid.py * oneMinusRatio);
  ctx.fillStyle = 'rgba(0,0,255, 0.3)';
  ctx.beginPath();
  ctx.arc(x, y, boid.radius, 0, Math.PI*2, false);
  ctx.fill();
}

function graphics(dt, ratio) {
  renderStats.begin();
  var boidIds = Object.keys(knownBoids)
    , boid
    , i;

  ctx.clearRect(0, 0, cvs.width, cvs.height);

  for (i = 0; i < boidIds.length; i++) {
    boid = knownBoids[boidIds[i]];
    drawBoid(boid, ratio);
  }
  renderStats.end();
}

function logics(dt) {
  physStats.begin();
  worker.postMessage({ type: 'logics', dt: dt });
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

document.addEventListener('keydown', function(e) {
  if (e.which == 27) {
    running = false;
    console.log('HALT IN THE NAME OF SCIENCE!');
  }
})