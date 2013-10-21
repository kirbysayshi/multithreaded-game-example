
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



var worker = work(require('./lib/worker'));

var knownBoids = {};

worker.addEventListener('message', function(ev) {

  if (ev.data.type === 'new boid') {
    knownBoids[ev.data.id] = boidStruct(ev.data.id);
    return;
  }

  if (ev.data.type === 'boid update') {
    updateBoidStruct(ev.data);
    return;
  }

});


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
  var boidIds = Object.keys(knownBoids)
    , boid
    , i;

  ctx.clearRect(0, 0, cvs.width, cvs.height);

  for (i = 0; i < boidIds.length; i++) {
    boid = knownBoids[boidIds[i]];
    drawBoid(boid, ratio);
  }
}

function logics(dt) {
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