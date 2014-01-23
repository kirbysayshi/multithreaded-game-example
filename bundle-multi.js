(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var config = require('./config');

module.exports = Boid;

function Boid(x, y, radius) {
  this.id = null;
  this.cpos = { x: x, y: y }
  this.ppos = { x: x, y: y }
  this.acel = { x: 0, y: 0 }
  this.radius = radius;
}

Boid.DAMPING = config.BOID_DAMPING;

Boid.prototype.accelerate = function(dt) {
  this.cpos.x += this.acel.x * dt * dt * 0.001;
  this.cpos.y += this.acel.y * dt * dt * 0.001;
  this.acel.x = 0;
  this.acel.y = 0;
}
 
Boid.prototype.inertia = function(dt) {
  var x = this.cpos.x*2 - this.ppos.x
    , y = this.cpos.y*2 - this.ppos.y;
  this.ppos.x = this.cpos.x;
  this.ppos.y = this.cpos.y;
  this.cpos.x = x;
  this.cpos.y = y;
}

Boid.prototype.collideWith = function(other, preserveInertia) {
  var xdiff = other.cpos.x - this.cpos.x
    , ydiff = other.cpos.y - this.cpos.y
    , r = this.radius + other.radius;
  
  // Test for overlap
  if (xdiff*xdiff + ydiff*ydiff > r*r) return;
  
  // Shortcuts
  var a = this;
  var b = other;
  
  // Calculate X velocities.
  var v1x = a.cpos.x - a.ppos.x;
  var v2x = b.cpos.x - b.ppos.x;

  // Calculate Y velocities.
  var v1y = a.cpos.y - a.ppos.y;
  var v2y = b.cpos.y - b.ppos.y;

  var x = a.cpos.x - b.cpos.x;
  var y = a.cpos.y - b.cpos.y;

  var length2 = x*x + y*y;
  var length = Math.sqrt(length2);
  var target = a.radius + b.radius;
  var factor = (length - target) / length;

  // Move a away.
  a.cpos.x -= x * factor * 0.5;
  a.cpos.y -= y * factor * 0.5;

  // Move b away.
  b.cpos.x += x * factor * 0.5;
  b.cpos.y += y * factor * 0.5;

  if (preserveInertia) {

    // Correct the previous position to compensate.
    var f1 = (Boid.DAMPING * (x * v1x + y * v1y)) / length2;
    var f2 = (Boid.DAMPING * (x * v2x + y * v2y)) / length2;

    v1x += f2 * x - f1 * x;
    v2x += f1 * x - f2 * x;
    v1y += f2 * y - f1 * y;
    v2y += f1 * y - f2 * y;

    a.ppos.x = a.cpos.x - v1x;
    a.ppos.y = a.cpos.y - v1y;
    b.ppos.x = b.cpos.x - v2x;
    b.ppos.y = b.cpos.y - v2y;
  }
}

/**
 * This method can set the state of a boid via a "snapshot", which is simply
 * a flat object. The object, in this demo, is emitted via postMessage from
 * the worker and is generated via `writeToSnapshot`.
 */
Boid.prototype.readFromSnapshot = function(data) {
  this.ppos.x = data.px;
  this.ppos.y = data.py;
  this.cpos.x = data.cx;
  this.cpos.y = data.cy;
  this.radius = data.radius;
  this.id = this.id || data.id;
}

/**
 * Given an object, write the current state of this boid. The property names
 * are changed slightly to ensure the object is flat. This attempts to be as
 * fast as possible, since in Chrome nested objects seem to serialize more
 * slowly than in FF.
 */
Boid.prototype.writeToSnapshot = function(data) {
   data.px = this.ppos.x;
   data.py = this.ppos.y;
   data.cx = this.cpos.x;
   data.cy = this.cpos.y;
   data.radius = this.radius;
   data.id = this.id;
   return data;
}

/**
 * This should only be called from within the renderer process, e.g.
 * the main thread. It requires an interpolation ratio to accurately
 * draw while awaiting a new snapshot from the worker process.
 */
Boid.prototype.draw = function(ctx, ratio) {
  var oneMinusRatio = 1 - ratio;
  var x = (this.cpos.x * ratio) + (this.ppos.x * oneMinusRatio);
  var y = (this.cpos.y * ratio) + (this.ppos.y * oneMinusRatio);
  ctx.fillStyle = 'rgba(0,0,255, 0.3)';
  ctx.beginPath();
  ctx.arc(x, y, this.radius, 0, Math.PI*2, false);
  ctx.fill();
}
},{"./config":3}],2:[function(require,module,exports){

var Boid = require('./boid');

/**
 * Boids are managed via an entity-like system. This is to ensure
 * that in single threaded or multi threaded mode updating a boid
 * is exactly the same. This does mean that in multi threaded mode
 * _two_ BoidManagers will each have copies of all the boids.
 */

module.exports = BoidManager;
function BoidManager() {
  this.knownBoids = {};
}

/**
 * Generate a unique id if needed. These are only guaranteed to be unique
 * within the same execution context (e.g. not unique for worker vs main).
 */

BoidManager.uid = (function() {
  var id = 0;
  return function() {
    return 'boid_' + (++id);
  }
}());

/**
 * Either get or instantiate and get a Boid by id. id can be undefined, and
 * a new Boid will still be created and returned. opt_ctorArgs will cause
 * the Boid constructor to be called again via `apply`.
 */

BoidManager.prototype.getinate = function(opt_id, opt_ctorArgs) {
  var boid = this.knownBoids[opt_id];
  if (!boid) {
    boid = new Boid();
    if (opt_ctorArgs) {
      Boid.apply(boid, opt_ctorArgs);
    }
    boid.id = opt_id || BoidManager.uid();
    this.knownBoids[boid.id] = boid;
  }

  return boid;
}

/**
 * Return an array containing the current known boids at call time.
 * The array will not be updated if boids are created or destroyed.
 */

BoidManager.prototype.all = function() {
  var self = this;
  return Object.keys(this.knownBoids).map(function(id) {
    return self.knownBoids[id];
  });
}

/**
 * Perform a callback on each known boid.
 */

BoidManager.prototype.forEach = function(cb) {
  var boidIds = Object.keys(this.knownBoids)
    , boid
    , i;

  for (i = 0; i < boidIds.length; i++) {
    boid = this.knownBoids[boidIds[i]];
    cb(boid, i);
  }
}

},{"./boid":1}],3:[function(require,module,exports){

module.exports = {

    // How often should the physics be calculated?
    PHYSICS_HZ: 30

    /**
     * How many boids should we generate?
     */
  , BOID_COUNT: 700

    /**
     * How much energy should be lost when colliding? This is fairly low
     * so the boids coalesce quickly.
     */
  , BOID_DAMPING: 0.95

    /**
     * How far away should the boids be generated from the attraction point?
     */
  , BOID_INITIAL_DISTANCE: 600

    /**
     * Where boids be attracting.
     */
  , BOID_ATTRACTION_POINT_X: 400
  , BOID_ATTRACTION_POINT_Y: 200

    /**
     * Boid raidus is randomly generated using a seedable generator. Meaning
     * while the generation is random, it's reproducible between runs if the
     * same seed is used.
     */
  , BOID_MIN_RADIUS: 4
  , BOID_MAX_RADIUS: 8

    /**
     * How potent is the attraction?
     */
  , CENTER_ATTRACTION: 0.1
}
},{}],4:[function(require,module,exports){

module.exports = FixedStep;

/**
 * Given a target delta time, execute a callback only when that target
 * delta time has been execeeded. If more time than the target delta
 * has elapsed since the last call to `update`, then execute the callback
 * multiple times synchronously to compensate.
 *
 * A common use for this is if you put a tab into the background. When focus
 * returns physics will still be up to date, even though they were not being
 * calculated in real time.
 *
 * This object does no time calculations itself, so it relies on accurate
 * elapsed times being passed into `update`.
 */

function FixedStep(targetDT, onStep) {
  this.accumulator = 0;
  this.accumulatorRatio = 0;
  this.onStep = onStep;
  this.targetDT = targetDT || 33.3333;
}

FixedStep.prototype.update = function(dt) {

  this.accumulator += dt;

  // take the current delta, plus what remains from last time,
  // and determine how many logical steps fit.
  var steps = Math.floor(this.accumulator / this.targetDT);

  // Remove what will be consumed this tick.
  if (steps > 0) this.accumulator -= steps * this.targetDT;

  this.accumulatorRatio = this.accumulator / this.targetDT;

  //console.log('steps this update', steps);

  while(steps > 0) {
    this.onStep(this.targetDT);
    steps--;
  }
}

},{}],5:[function(require,module,exports){

/**
 * Call a function as often as possible using either the provided
 * `immediateImplementation` function or `setTimeout`. You could pass,
 * for example, `requestAnimationFrame` or something like `process.nextTick`.
 * The callback is given the delta of time from when the callback was last
 * called (this includes the callback's previous execution time).
 */

module.exports = function(cb, immediateImpl) {
  var last = null
    , running = true;

  // Use whatever is passed in to add to the run loop.
  immediateImpl = immediateImpl || setTimeout;

  function next() {
    if (running) immediateImpl(next);
    var now = Date.now();
    cb(now - last);
    last = now;
  }

  return {
    stop: function() { running = false; },
    start: function() {
      last = Date.now();
      next();
    }
  }
}

},{}],6:[function(require,module,exports){

module.exports = function(cvs) {
  function resize(e) {
    cvs.width = document.body.clientWidth;
    cvs.height = document.body.clientHeight;
  }

  window.addEventListener('resize', resize, false);
  resize();

  return resize;
};
},{}],7:[function(require,module,exports){
var RStats = require('../vendor/rstats');
var rstats = new RStats({
  values: {
    phys: { caption: 'Time per physics update (ms)', over: 30 },
    fps: { caption: 'Frame rate', below: 58 },
    frame: { caption: 'Time spent drawing (ms)' },
    rAF: { caption: 'Time since last rAF (ms)' }
  }
});

module.exports = function(id) {
  if (enabled) return rstats(id);
  else return facade;
}

var enabled = true;
var noop = function() {};
var facade = {
  update: noop,
  set: noop,
  start: noop,
  end: noop,
  frame: noop,
  tick: noop
}

module.exports.toggle = function() {
  enabled = !enabled;
}
},{"../vendor/rstats":13}],8:[function(require,module,exports){

var Alea = require('alea');
var random = new Alea('NOT ENOUGH STONE');

var BoidManager = require('./boidmanager');
var FixedStep = require('./fixedstep');
var repeater = require('./repeater');

var config = require('./config');

// All worker code must be within this function for webworkify
module.exports = function() {

  // Allow this code to be used either as a true worker or
  // single threaded without a worker.
  var postMsg;
  if (typeof window !== 'undefined') {
    // We're running in single threaded mode, so ensure that messages are
    // always posted on the next tick.
    postMsg = function(obj) {
      // NOTE: we're posting to * domain for simplicity here, but to be
      // secure we should be explicit for production code.
      window.postMessage(obj, '*');
    }
  } else {
    // We're running in a worker, so just use the default semantics.
    postMsg = function(obj) {
      postMessage(obj);
    }
  }

  // Only call the simulation at 30 Hz.
  var stepper = new FixedStep(1000 / config.PHYSICS_HZ, update);

  // The worker will manage its own list of boids.
  var boidman = new BoidManager;

  // Initialize the game world

  var maxBoids = config.BOID_COUNT
    , distance = config.BOID_INITIAL_DISTANCE
    , minRadius = config.BOID_MIN_RADIUS
    , maxRadius = config.BOID_MAX_RADIUS
    , theta
    , x
    , y
    , radius
    , boid

  // Make a bunch of boids evenly spaced in a circle.
  for(var i = 0; i < maxBoids; i++) {
    theta = (i/maxBoids) * Math.PI*2;
    x = config.BOID_ATTRACTION_POINT_X + (Math.cos(theta) * distance);
    y = config.BOID_ATTRACTION_POINT_Y + (Math.sin(theta) * distance);
    radius = minRadius + (maxRadius - minRadius) * random();
    boid = boidman.getinate(null, [x, y, radius]);
  }

  function update(dt) {
    var startTime = Date.now();
    var i, boid;

    var boids = boidman.all();

    attractAll(
      config.CENTER_ATTRACTION,
      config.BOID_ATTRACTION_POINT_X,
      config.BOID_ATTRACTION_POINT_Y);

    for (i = 0; i < boids.length; i++) {
      boid = boids[i];
      boid.accelerate(dt);
    }

    collideAll(false);

    for (i = 0; i < boids.length; i++) {
      boid = boids[i];
      boid.inertia(dt);
    }

    collideAll(true);

    // Notify the main thread that all boids have a new position
    var snapshots = [];
    for (i = 0; i < boids.length; i++) {
      // We pass in an empty object. As a future optimization, these objects
      // could be Object.create(null) or object pooled.
      snapshots.push(boids[i].writeToSnapshot({}));
    }

    // TODO: If update is called multiple times via FixedTime, it will emit
    // multiple snapshots. If the render thread is behind, that will look
    // extremely jarring (bump max boids to a high number to see).

    var endTime = Date.now();
    postMsg({
      type: 'step',
      snapshots: snapshots,
      startTime: startTime,
      endTime: endTime
    });
  }

  function collideAll(preserveInertia) {
    var i, j, boidA, boidB;

    var boids = boidman.all();

    for (i = 0; i < boids.length; i++) {
      boidA = boids[i]
      for (j = i + 1; j < boids.length; j++) {
        boidB = boids[j];
        boidA.collideWith(boidB, preserveInertia);
      }
    }
  }

  function attractAll(amount, x, y) {
    var i, boid, dirX, dirY, mag;

    var boids = boidman.all();

    for (i = 0; i < boids.length; i++) {
      boid = boids[i];
      dirX = x - boid.cpos.x;
      dirY = y - boid.cpos.y;

      // normalize
      mag = Math.sqrt(dirX*dirX + dirY*dirY);
      dirX /= mag;
      dirY /= mag;

      boid.acel.x += dirX * amount;
      boid.acel.y += dirY * amount;
    }
  }

  var repeaterCtl = repeater(function(dt) {
    // Call the stepper as often as possible.
    stepper.update(dt);
  })

  repeaterCtl.start();

  // listen for messages from the "main" thread
  addEventListener('message', function(ev) {
    if (ev.data.type === 'HALT') {
      repeaterCtl.stop();
      // This will error in a FF worker, but it's ok since we'll still see it.
      // It just has to be the last line, otherwise other stuff will break
      // (also, we're not starting this up again, so it's fine).
      console.log('halting from worker');
    }
  });
}

},{"./boidmanager":2,"./config":3,"./fixedstep":4,"./repeater":5,"alea":10}],9:[function(require,module,exports){

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

worker.addEventListener('message', function(ev) {

  // A full step contains snapshots.
  if (ev.data.type === 'step') {
    for (var i = 0; i < ev.data.snapshots.length; i++) {
      var snapshot = ev.data.snapshots[i];
      var boid = boidman.getinate(snapshot.id);
      boid.readFromSnapshot(snapshot);
    }

    // TODO: there has to be a better way to do this?
    lastSnapshotReceivedAt = performance.now();

    rstats('phys').set(ev.data.endTime - ev.data.startTime);
    rstats().update();
    return;
  }

});

function graphics(dt) {
  var now = performance.now();
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
  worker.postMessage({ type: 'HALT' });
})

},{"./lib/boidmanager":2,"./lib/config":3,"./lib/repeater":5,"./lib/resizemon":6,"./lib/rstatshelper":7,"./lib/worker":8,"science-halt":11,"webworkify":12}],10:[function(require,module,exports){
(function (root, factory) {
  if (typeof exports === 'object') {
      module.exports = factory();
  } else if (typeof define === 'function' && define.amd) {
      define(factory);
  } else {
      root.Alea = factory();
  }
}(this, function () {

  'use strict';

  // From http://baagoe.com/en/RandomMusings/javascript/

  // importState to sync generator states
  Alea.importState = function(i){
    var random = new Alea();
    random.importState(i);
    return random;
  };

  return Alea;

  function Alea() {
    return (function(args) {
      // Johannes Baagøe <baagoe@baagoe.com>, 2010
      var s0 = 0;
      var s1 = 0;
      var s2 = 0;
      var c = 1;

      if (args.length == 0) {
        args = [+new Date];
      }
      var mash = Mash();
      s0 = mash(' ');
      s1 = mash(' ');
      s2 = mash(' ');

      for (var i = 0; i < args.length; i++) {
        s0 -= mash(args[i]);
        if (s0 < 0) {
          s0 += 1;
        }
        s1 -= mash(args[i]);
        if (s1 < 0) {
          s1 += 1;
        }
        s2 -= mash(args[i]);
        if (s2 < 0) {
          s2 += 1;
        }
      }
      mash = null;

      var random = function() {
        var t = 2091639 * s0 + c * 2.3283064365386963e-10; // 2^-32
        s0 = s1;
        s1 = s2;
        return s2 = t - (c = t | 0);
      };
      random.uint32 = function() {
        return random() * 0x100000000; // 2^32
      };
      random.fract53 = function() {
        return random() + 
          (random() * 0x200000 | 0) * 1.1102230246251565e-16; // 2^-53
      };
      random.version = 'Alea 0.9';
      random.args = args;

      // my own additions to sync state between two generators
      random.exportState = function(){
        return [s0, s1, s2, c];
      };
      random.importState = function(i){
        s0 = +i[0] || 0;
        s1 = +i[1] || 0;
        s2 = +i[2] || 0;
        c = +i[3] || 0;
      };
 
      return random;

    } (Array.prototype.slice.call(arguments)));
  }

  function Mash() {
    var n = 0xefc8249d;

    var mash = function(data) {
      data = data.toString();
      for (var i = 0; i < data.length; i++) {
        n += data.charCodeAt(i);
        var h = 0.02519603282416938 * n;
        n = h >>> 0;
        h -= n;
        h *= n;
        n = h >>> 0;
        h -= n;
        n += h * 0x100000000; // 2^32
      }
      return (n >>> 0) * 2.3283064365386963e-10; // 2^-32
    };

    mash.version = 'Mash 0.9';
    return mash;
  }
}));

},{}],11:[function(require,module,exports){

module.exports = function(onhalt, opt_msg, opt_keycode) {
  document.addEventListener('keydown', function(e) {
    if (e.which == (opt_keycode || 27)) {
      onhalt();
      console.log(opt_msg || 'HALT IN THE NAME OF SCIENCE!');
    }
  })
}
},{}],12:[function(require,module,exports){
var bundleFn = arguments[3];
var sources = arguments[4];
var cache = arguments[5];

var stringify = JSON.stringify;

module.exports = function (fn) {
    var keys = [];
    var wkey;
    var cacheKeys = Object.keys(cache);
    
    for (var i = 0, l = cacheKeys.length; i < l; i++) {
        var key = cacheKeys[i];
        if (cache[key].exports === fn) {
            wkey = key;
            break;
        }
    }
    
    if (!wkey) {
        wkey = Math.floor(Math.pow(16, 8) * Math.random()).toString(16);
        var wcache = {};
        for (var i = 0, l = cacheKeys.length; i < l; i++) {
            var key = cacheKeys[i];
            wcache[key] = key;
        }
        sources[wkey] = [
            Function(['require','module','exports'], '(' + fn + ')(self)'),
            wcache
        ];
    }
    var skey = Math.floor(Math.pow(16, 8) * Math.random()).toString(16);
    
    var scache = {}; scache[wkey] = wkey;
    sources[skey] = [
        Function(['require'],'require(' + stringify(wkey) + ')(self)'),
        scache
    ];
    
    var src = '(' + bundleFn + ')({'
        + Object.keys(sources).map(function (key) {
            return stringify(key) + ':['
                + sources[key][0]
                + ',' + stringify(sources[key][1]) + ']'
            ;
        }).join(',')
        + '},{},[' + stringify(skey) + '])'
    ;
    return new Worker(window.URL.createObjectURL(
        new Blob([src], { type: 'text/javascript' })
    ));
};

},{}],13:[function(require,module,exports){
// performance.now() polyfill from https://gist.github.com/paulirish/5438650

(function(){
 
  // prepare base perf object
  if (typeof window.performance === 'undefined') {
      window.performance = {};
  }
 
  if (!window.performance.now){
    
    var nowOffset = Date.now();
 
    if (performance.timing && performance.timing.navigationStart){
      nowOffset = performance.timing.navigationStart
    }
 
 
    window.performance.now = function now(){
      return Date.now() - nowOffset;
    }
 
  }
 
})();

module.exports = function rStats( settings ) {

    'use strict';

    var element = document.createElement('link');
    element.href = 'http://fonts.googleapis.com/css?family=Roboto+Condensed:400,700,300';
    element.rel = 'stylesheet';
    element.type = 'text/css';
    document.getElementsByTagName('head')[0].appendChild(element)

    var _settings = settings || {},
        _colours = [ '#850700', '#c74900', '#fcb300', '#284280', '#4c7c0c' ];

    if( !_settings.values ) _settings.values = {};
    
    function Graph( _dom, _id ) {

        var _canvas = document.createElement( 'canvas' ),
            _ctx = _canvas.getContext( '2d' ),
            _max = 0,
            _current = 0;

        var _dotCanvas = document.createElement( 'canvas' ),
            _dotCtx = _dotCanvas.getContext( '2d' );
        _dotCanvas.width = 1;
        _dotCanvas.height = 20;
        _dotCtx.fillStyle = '#444444';
        _dotCtx.fillRect( 0, 0, 1, 20 );
        _dotCtx.fillStyle = '#666666';
        _dotCtx.fillRect( 0, 10, 1, 10 );
        _dotCtx.fillStyle = '#ffffff';
        _dotCtx.fillRect( 0, 10, 1, 1 );

        var _alarmCanvas = document.createElement( 'canvas' ),
            _alarmCtx = _alarmCanvas.getContext( '2d' );
        _alarmCanvas.width = 1;
        _alarmCanvas.height = 20;
        _alarmCtx.fillStyle = '#444444';
        _alarmCtx.fillRect( 0, 0, 1, 20 );
        _alarmCtx.fillStyle = '#b70000';
        _alarmCtx.fillRect( 0, 10, 1, 10 );
        _alarmCtx.fillStyle = '#ffffff';
        _alarmCtx.fillRect( 0, 10, 1, 1 );

        function _init() {

            _canvas.width = 200;
            _canvas.height = 10;
            _canvas.style.width = _canvas.width + 'px';
            _canvas.style.height = _canvas.height + 'px';
            _canvas.style.position = 'absolute';
            _canvas.style.right = 0;
            _dom.appendChild( _canvas );

            _ctx.fillStyle = '#444444';
            _ctx.fillRect( 0, 0, _canvas.width, _canvas.height );

        }

        function _draw( v, alarm ) {
            _current += ( v - _current ) * .1;
            _max *= .99;
            if( _current > _max ) _max = _current;
            _ctx.drawImage( _canvas, 1, 0, _canvas.width - 1, _canvas.height, 0, 0, _canvas.width - 1, _canvas.height );
            if( alarm ) {
                _ctx.drawImage( _alarmCanvas, _canvas.width - 1, _canvas.height - _current * _canvas.height / _max - 10 );
            } else {
                _ctx.drawImage( _dotCanvas, _canvas.width - 1, _canvas.height - _current * _canvas.height / _max - 10 );
            }
        }

        _init();

        return {
            draw: _draw
        }

    }

    function StackGraph( _dom, _num ) {

        var _canvas = document.createElement( 'canvas' ),
            _ctx = _canvas.getContext( '2d' ),
            _max = 0,
            _current = 0;

        function _init() {

            _canvas.width = 200;
            _canvas.height = 10 * _num;
            _canvas.style.width = _canvas.width + 'px';
            _canvas.style.height = _canvas.height + 'px';
            _canvas.style.position = 'absolute';
            _canvas.style.right = 0;
            _dom.appendChild( _canvas );

            _ctx.fillStyle = '#444444';
            _ctx.fillRect( 0, 0, _canvas.width, _canvas.height );

        }

        function _draw( v ) {
            _ctx.drawImage( _canvas, 1, 0, _canvas.width - 1, _canvas.height, 0, 0, _canvas.width - 1, _canvas.height );
            var th = 0;
            for( var j in v ) {
                var h = v[ j ] * _canvas.height;
                _ctx.fillStyle = _colours[ j ];
                _ctx.fillRect( _canvas.width - 1, th, 1, h );
                th += h;
            }
        }

        _init();

        return {
            draw: _draw
        }

    }

    function PerfCounter( id, group ) {

        var _id = id,
            _time,
            _value = 0,
            _total = 0,
            _dom = document.createElement( 'div' ),
            _spanId = document.createElement( 'span' ),
            _spanValue = document.createElement( 'span' ),
            _graph = new Graph( _dom, _id ),
            _def = _settings?_settings.values[ _id.toLowerCase() ]:null;

        _dom.style.position = 'relative';
        _dom.style.margin = '2px 0';
        _dom.style.height = '10px';

        _spanId.style.position = 'absolute';
        _spanId.style.left = 0;
        _spanId.style.top = 0;
        _spanId.textContent = ( _def && _def.caption )?_def.caption:_id;

        _spanValue.style.position = 'absolute';
        _spanValue.style.right = '210px';
        _spanValue.style.top = 0;
        _spanValue.style.textAlign = 'right';
        
        _dom.appendChild( _spanId );
        _dom.appendChild( _spanValue );
        if( group ) group.div.appendChild( _dom );
        else _div.appendChild( _dom );

        _time = performance.now();


        function _start(){
            _time = performance.now();
        }

        function _end() {
            _value = performance.now() - _time;
        }

        function _tick() {
            _end();
            _start();
        }

        function _draw() {
            _spanValue.textContent = Math.round( _value * 100 ) / 100;
            var a = ( _def && ( ( _def.below && _value < _def.below ) || ( _def.over && _value > _def.over ) ) );
            _graph.draw( _value, a );
            _dom.style.color = a?'#b70000':'#ffffff';
        }

        function _frame() {
            var t = performance.now();
            var e = t - _time;
            _total++;
            if( e > 1000 ) {
                _value = _total * 1000 / e;
                _total = 0;
                _time = t;
            }
        }

        function _set( v ) {
            _value = v;
        }

        return {
            set: _set,
            start: _start,
            tick: _tick,
            end: _end,
            frame: _frame,
            value: function(){ return _value; },
            draw: _draw
        }

    }

    function sample() {

        var _value = 0;

        function _set( v ) {
            _value = v;
        }

        return {
            set: _set,
            value: function(){ return _value; }
        }

    }

    var _div;

    var _perfCounters = {},
        _samples = {};

    function _perf( id ) {

        id = id.toLowerCase();
        if( id === undefined ) id = 'default';
        if( _perfCounters[ id ] ) return _perfCounters[ id ];

        var group = null;
        if( _settings && _settings.groups ) {
            for( var j in _settings.groups ) {
                var g = _settings.groups[ parseInt( j, 10 ) ];
                if( g.values.indexOf( id.toLowerCase() ) != -1 ) {
                    group = g;
                    continue;
                }
            }
        }

        var p = new PerfCounter( id, group );
        _perfCounters[ id ] = p;
        return p;

    }

    function _init() {

        if( _settings.plugins ) {
            if( !_settings.values ) _settings.values = {};
            if( !_settings.groups ) _settings.groups = [];
            if( !_settings.fractions ) _settings.fractions = [];
            for( var j = 0; j < _settings.plugins.length; j++ ) {
                _settings.plugins[ j ].attach( _perf );
                for( var k in _settings.plugins[ j ].values ) {
                    _settings.values[ k ] = _settings.plugins[ j ].values [ k ];
                }
                _settings.groups = _settings.groups.concat( _settings.plugins[ j ].groups );
                _settings.fractions = _settings.fractions.concat( _settings.plugins[ j ].fractions );
            }
        } else {
            _settings.plugins = {};
        }

        _div = document.createElement( 'div' );
        _div.style.position = 'absolute';
        _div.style.zIndex = 10000;
        _div.style.padding = '10px';
        _div.style.backgroundColor = '#222';
        _div.style.fontSize = '10px';
        _div.style.lineHeight = '1.2em';
        _div.style.width = '350px';
        _div.style.fontFamily = 'Roboto Condensed, tahoma, sans-serif';
        _div.style.left = _div.style.top = 0;
        document.body.appendChild( _div );

        if( !_settings ) return;

        if( _settings.groups ) {
            for( var j in _settings.groups ) {
                var g = _settings.groups[ parseInt( j, 10 ) ];
                var div = document.createElement( 'div' );
                g.div = div;
                var h1 = document.createElement( 'h1' );
                h1.textContent = g.caption;
                h1.style.margin = h1.style.padding = 0;
                h1.style.marginBottom = '5px';
                div.style.marginBottom = '10px';
                h1.style.fontSize = '14px';
                h1.style.color = '#fff'
                _div.appendChild( h1 );
                _div.appendChild( div );
            }
        }

        if( _settings.fractions ) {
            for( var j in _settings.fractions ) {
                var f = _settings.fractions[ parseInt( j, 10 ) ];
                var div = document.createElement( 'div' );
                var legend = document.createElement( 'div' );
                legend.style.position = 'absolute';
                legend.style.lineHeight = '10px';

                var h = 0;
                for( var k in _settings.fractions[ j ].steps ) {
                    var p = document.createElement( 'p' );
                    p.textContent = _settings.fractions[ j ].steps[ k ];
                    p.style.color = _colours[ h ];
                    p.style.width = '120px';
                    p.style.textAlign = 'right';
                    p.style.margin = 0;
                    p.style.padding = 0;
                    legend.appendChild( p );
                    h++;
                }
                div.appendChild( legend );
                div.style.height = h * 10 + 'px';
                div.style.position = 'relative';
                div.style.marginBottom = '5px';
                f.div = div;
                var graph = new StackGraph( div, h );
                f.graph = graph;
                _div.appendChild( div );
            }
        }

    }

    function _update() {
        
        for( var j in _settings.plugins ) {
            _settings.plugins[ j ].update();
        }

        for( var j in _perfCounters ) {
            _perfCounters[ j ].draw();
        }

        if( _settings && _settings.fractions ) {
            for( var j in _settings.fractions ) {
                var f = _settings.fractions[ parseInt( j, 10 ) ];
                var v = [];
                var base = _perfCounters[ f.base.toLowerCase() ];
                if( base ) {
                    base = base.value();
                    for( var k in _settings.fractions[ j ].steps ) {
                        var s = _settings.fractions[ j ].steps[ parseInt( k, 10 ) ].toLowerCase();
                        var val = _perfCounters[ s ];
                        if( val ) {
                            v.push( val.value() / base );
                        }
                    }
                }
                f.graph.draw( v );
            }
        }

    }

    _init();

    return function( id ) {
        if( id ) return _perf( id );
        return {
            update: _update
        }
    }

};
},{}]},{},[9])
//@ sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlcyI6WyIvVXNlcnMvZHJld3AvRHJvcGJveC9qcy9tdWx0aXRocmVhZGVkL25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIvVXNlcnMvZHJld3AvRHJvcGJveC9qcy9tdWx0aXRocmVhZGVkL2xpYi9ib2lkLmpzIiwiL1VzZXJzL2RyZXdwL0Ryb3Bib3gvanMvbXVsdGl0aHJlYWRlZC9saWIvYm9pZG1hbmFnZXIuanMiLCIvVXNlcnMvZHJld3AvRHJvcGJveC9qcy9tdWx0aXRocmVhZGVkL2xpYi9jb25maWcuanMiLCIvVXNlcnMvZHJld3AvRHJvcGJveC9qcy9tdWx0aXRocmVhZGVkL2xpYi9maXhlZHN0ZXAuanMiLCIvVXNlcnMvZHJld3AvRHJvcGJveC9qcy9tdWx0aXRocmVhZGVkL2xpYi9yZXBlYXRlci5qcyIsIi9Vc2Vycy9kcmV3cC9Ecm9wYm94L2pzL211bHRpdGhyZWFkZWQvbGliL3Jlc2l6ZW1vbi5qcyIsIi9Vc2Vycy9kcmV3cC9Ecm9wYm94L2pzL211bHRpdGhyZWFkZWQvbGliL3JzdGF0c2hlbHBlci5qcyIsIi9Vc2Vycy9kcmV3cC9Ecm9wYm94L2pzL211bHRpdGhyZWFkZWQvbGliL3dvcmtlci5qcyIsIi9Vc2Vycy9kcmV3cC9Ecm9wYm94L2pzL211bHRpdGhyZWFkZWQvbXVsdGkuanMiLCIvVXNlcnMvZHJld3AvRHJvcGJveC9qcy9tdWx0aXRocmVhZGVkL25vZGVfbW9kdWxlcy9hbGVhL2FsZWEuanMiLCIvVXNlcnMvZHJld3AvRHJvcGJveC9qcy9tdWx0aXRocmVhZGVkL25vZGVfbW9kdWxlcy9zY2llbmNlLWhhbHQvaW5kZXguanMiLCIvVXNlcnMvZHJld3AvRHJvcGJveC9qcy9tdWx0aXRocmVhZGVkL25vZGVfbW9kdWxlcy93ZWJ3b3JraWZ5L2luZGV4LmpzIiwiL1VzZXJzL2RyZXdwL0Ryb3Bib3gvanMvbXVsdGl0aHJlYWRlZC92ZW5kb3IvcnN0YXRzLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvSEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6RUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQy9CQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDWEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDNUpBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3R0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcERBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dGhyb3cgbmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKX12YXIgZj1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwoZi5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxmLGYuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwidmFyIGNvbmZpZyA9IHJlcXVpcmUoJy4vY29uZmlnJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gQm9pZDtcblxuZnVuY3Rpb24gQm9pZCh4LCB5LCByYWRpdXMpIHtcbiAgdGhpcy5pZCA9IG51bGw7XG4gIHRoaXMuY3BvcyA9IHsgeDogeCwgeTogeSB9XG4gIHRoaXMucHBvcyA9IHsgeDogeCwgeTogeSB9XG4gIHRoaXMuYWNlbCA9IHsgeDogMCwgeTogMCB9XG4gIHRoaXMucmFkaXVzID0gcmFkaXVzO1xufVxuXG5Cb2lkLkRBTVBJTkcgPSBjb25maWcuQk9JRF9EQU1QSU5HO1xuXG5Cb2lkLnByb3RvdHlwZS5hY2NlbGVyYXRlID0gZnVuY3Rpb24oZHQpIHtcbiAgdGhpcy5jcG9zLnggKz0gdGhpcy5hY2VsLnggKiBkdCAqIGR0ICogMC4wMDE7XG4gIHRoaXMuY3Bvcy55ICs9IHRoaXMuYWNlbC55ICogZHQgKiBkdCAqIDAuMDAxO1xuICB0aGlzLmFjZWwueCA9IDA7XG4gIHRoaXMuYWNlbC55ID0gMDtcbn1cbiBcbkJvaWQucHJvdG90eXBlLmluZXJ0aWEgPSBmdW5jdGlvbihkdCkge1xuICB2YXIgeCA9IHRoaXMuY3Bvcy54KjIgLSB0aGlzLnBwb3MueFxuICAgICwgeSA9IHRoaXMuY3Bvcy55KjIgLSB0aGlzLnBwb3MueTtcbiAgdGhpcy5wcG9zLnggPSB0aGlzLmNwb3MueDtcbiAgdGhpcy5wcG9zLnkgPSB0aGlzLmNwb3MueTtcbiAgdGhpcy5jcG9zLnggPSB4O1xuICB0aGlzLmNwb3MueSA9IHk7XG59XG5cbkJvaWQucHJvdG90eXBlLmNvbGxpZGVXaXRoID0gZnVuY3Rpb24ob3RoZXIsIHByZXNlcnZlSW5lcnRpYSkge1xuICB2YXIgeGRpZmYgPSBvdGhlci5jcG9zLnggLSB0aGlzLmNwb3MueFxuICAgICwgeWRpZmYgPSBvdGhlci5jcG9zLnkgLSB0aGlzLmNwb3MueVxuICAgICwgciA9IHRoaXMucmFkaXVzICsgb3RoZXIucmFkaXVzO1xuICBcbiAgLy8gVGVzdCBmb3Igb3ZlcmxhcFxuICBpZiAoeGRpZmYqeGRpZmYgKyB5ZGlmZip5ZGlmZiA+IHIqcikgcmV0dXJuO1xuICBcbiAgLy8gU2hvcnRjdXRzXG4gIHZhciBhID0gdGhpcztcbiAgdmFyIGIgPSBvdGhlcjtcbiAgXG4gIC8vIENhbGN1bGF0ZSBYIHZlbG9jaXRpZXMuXG4gIHZhciB2MXggPSBhLmNwb3MueCAtIGEucHBvcy54O1xuICB2YXIgdjJ4ID0gYi5jcG9zLnggLSBiLnBwb3MueDtcblxuICAvLyBDYWxjdWxhdGUgWSB2ZWxvY2l0aWVzLlxuICB2YXIgdjF5ID0gYS5jcG9zLnkgLSBhLnBwb3MueTtcbiAgdmFyIHYyeSA9IGIuY3Bvcy55IC0gYi5wcG9zLnk7XG5cbiAgdmFyIHggPSBhLmNwb3MueCAtIGIuY3Bvcy54O1xuICB2YXIgeSA9IGEuY3Bvcy55IC0gYi5jcG9zLnk7XG5cbiAgdmFyIGxlbmd0aDIgPSB4KnggKyB5Knk7XG4gIHZhciBsZW5ndGggPSBNYXRoLnNxcnQobGVuZ3RoMik7XG4gIHZhciB0YXJnZXQgPSBhLnJhZGl1cyArIGIucmFkaXVzO1xuICB2YXIgZmFjdG9yID0gKGxlbmd0aCAtIHRhcmdldCkgLyBsZW5ndGg7XG5cbiAgLy8gTW92ZSBhIGF3YXkuXG4gIGEuY3Bvcy54IC09IHggKiBmYWN0b3IgKiAwLjU7XG4gIGEuY3Bvcy55IC09IHkgKiBmYWN0b3IgKiAwLjU7XG5cbiAgLy8gTW92ZSBiIGF3YXkuXG4gIGIuY3Bvcy54ICs9IHggKiBmYWN0b3IgKiAwLjU7XG4gIGIuY3Bvcy55ICs9IHkgKiBmYWN0b3IgKiAwLjU7XG5cbiAgaWYgKHByZXNlcnZlSW5lcnRpYSkge1xuXG4gICAgLy8gQ29ycmVjdCB0aGUgcHJldmlvdXMgcG9zaXRpb24gdG8gY29tcGVuc2F0ZS5cbiAgICB2YXIgZjEgPSAoQm9pZC5EQU1QSU5HICogKHggKiB2MXggKyB5ICogdjF5KSkgLyBsZW5ndGgyO1xuICAgIHZhciBmMiA9IChCb2lkLkRBTVBJTkcgKiAoeCAqIHYyeCArIHkgKiB2MnkpKSAvIGxlbmd0aDI7XG5cbiAgICB2MXggKz0gZjIgKiB4IC0gZjEgKiB4O1xuICAgIHYyeCArPSBmMSAqIHggLSBmMiAqIHg7XG4gICAgdjF5ICs9IGYyICogeSAtIGYxICogeTtcbiAgICB2MnkgKz0gZjEgKiB5IC0gZjIgKiB5O1xuXG4gICAgYS5wcG9zLnggPSBhLmNwb3MueCAtIHYxeDtcbiAgICBhLnBwb3MueSA9IGEuY3Bvcy55IC0gdjF5O1xuICAgIGIucHBvcy54ID0gYi5jcG9zLnggLSB2Mng7XG4gICAgYi5wcG9zLnkgPSBiLmNwb3MueSAtIHYyeTtcbiAgfVxufVxuXG4vKipcbiAqIFRoaXMgbWV0aG9kIGNhbiBzZXQgdGhlIHN0YXRlIG9mIGEgYm9pZCB2aWEgYSBcInNuYXBzaG90XCIsIHdoaWNoIGlzIHNpbXBseVxuICogYSBmbGF0IG9iamVjdC4gVGhlIG9iamVjdCwgaW4gdGhpcyBkZW1vLCBpcyBlbWl0dGVkIHZpYSBwb3N0TWVzc2FnZSBmcm9tXG4gKiB0aGUgd29ya2VyIGFuZCBpcyBnZW5lcmF0ZWQgdmlhIGB3cml0ZVRvU25hcHNob3RgLlxuICovXG5Cb2lkLnByb3RvdHlwZS5yZWFkRnJvbVNuYXBzaG90ID0gZnVuY3Rpb24oZGF0YSkge1xuICB0aGlzLnBwb3MueCA9IGRhdGEucHg7XG4gIHRoaXMucHBvcy55ID0gZGF0YS5weTtcbiAgdGhpcy5jcG9zLnggPSBkYXRhLmN4O1xuICB0aGlzLmNwb3MueSA9IGRhdGEuY3k7XG4gIHRoaXMucmFkaXVzID0gZGF0YS5yYWRpdXM7XG4gIHRoaXMuaWQgPSB0aGlzLmlkIHx8IGRhdGEuaWQ7XG59XG5cbi8qKlxuICogR2l2ZW4gYW4gb2JqZWN0LCB3cml0ZSB0aGUgY3VycmVudCBzdGF0ZSBvZiB0aGlzIGJvaWQuIFRoZSBwcm9wZXJ0eSBuYW1lc1xuICogYXJlIGNoYW5nZWQgc2xpZ2h0bHkgdG8gZW5zdXJlIHRoZSBvYmplY3QgaXMgZmxhdC4gVGhpcyBhdHRlbXB0cyB0byBiZSBhc1xuICogZmFzdCBhcyBwb3NzaWJsZSwgc2luY2UgaW4gQ2hyb21lIG5lc3RlZCBvYmplY3RzIHNlZW0gdG8gc2VyaWFsaXplIG1vcmVcbiAqIHNsb3dseSB0aGFuIGluIEZGLlxuICovXG5Cb2lkLnByb3RvdHlwZS53cml0ZVRvU25hcHNob3QgPSBmdW5jdGlvbihkYXRhKSB7XG4gICBkYXRhLnB4ID0gdGhpcy5wcG9zLng7XG4gICBkYXRhLnB5ID0gdGhpcy5wcG9zLnk7XG4gICBkYXRhLmN4ID0gdGhpcy5jcG9zLng7XG4gICBkYXRhLmN5ID0gdGhpcy5jcG9zLnk7XG4gICBkYXRhLnJhZGl1cyA9IHRoaXMucmFkaXVzO1xuICAgZGF0YS5pZCA9IHRoaXMuaWQ7XG4gICByZXR1cm4gZGF0YTtcbn1cblxuLyoqXG4gKiBUaGlzIHNob3VsZCBvbmx5IGJlIGNhbGxlZCBmcm9tIHdpdGhpbiB0aGUgcmVuZGVyZXIgcHJvY2VzcywgZS5nLlxuICogdGhlIG1haW4gdGhyZWFkLiBJdCByZXF1aXJlcyBhbiBpbnRlcnBvbGF0aW9uIHJhdGlvIHRvIGFjY3VyYXRlbHlcbiAqIGRyYXcgd2hpbGUgYXdhaXRpbmcgYSBuZXcgc25hcHNob3QgZnJvbSB0aGUgd29ya2VyIHByb2Nlc3MuXG4gKi9cbkJvaWQucHJvdG90eXBlLmRyYXcgPSBmdW5jdGlvbihjdHgsIHJhdGlvKSB7XG4gIHZhciBvbmVNaW51c1JhdGlvID0gMSAtIHJhdGlvO1xuICB2YXIgeCA9ICh0aGlzLmNwb3MueCAqIHJhdGlvKSArICh0aGlzLnBwb3MueCAqIG9uZU1pbnVzUmF0aW8pO1xuICB2YXIgeSA9ICh0aGlzLmNwb3MueSAqIHJhdGlvKSArICh0aGlzLnBwb3MueSAqIG9uZU1pbnVzUmF0aW8pO1xuICBjdHguZmlsbFN0eWxlID0gJ3JnYmEoMCwwLDI1NSwgMC4zKSc7XG4gIGN0eC5iZWdpblBhdGgoKTtcbiAgY3R4LmFyYyh4LCB5LCB0aGlzLnJhZGl1cywgMCwgTWF0aC5QSSoyLCBmYWxzZSk7XG4gIGN0eC5maWxsKCk7XG59IiwiXG52YXIgQm9pZCA9IHJlcXVpcmUoJy4vYm9pZCcpO1xuXG4vKipcbiAqIEJvaWRzIGFyZSBtYW5hZ2VkIHZpYSBhbiBlbnRpdHktbGlrZSBzeXN0ZW0uIFRoaXMgaXMgdG8gZW5zdXJlXG4gKiB0aGF0IGluIHNpbmdsZSB0aHJlYWRlZCBvciBtdWx0aSB0aHJlYWRlZCBtb2RlIHVwZGF0aW5nIGEgYm9pZFxuICogaXMgZXhhY3RseSB0aGUgc2FtZS4gVGhpcyBkb2VzIG1lYW4gdGhhdCBpbiBtdWx0aSB0aHJlYWRlZCBtb2RlXG4gKiBfdHdvXyBCb2lkTWFuYWdlcnMgd2lsbCBlYWNoIGhhdmUgY29waWVzIG9mIGFsbCB0aGUgYm9pZHMuXG4gKi9cblxubW9kdWxlLmV4cG9ydHMgPSBCb2lkTWFuYWdlcjtcbmZ1bmN0aW9uIEJvaWRNYW5hZ2VyKCkge1xuICB0aGlzLmtub3duQm9pZHMgPSB7fTtcbn1cblxuLyoqXG4gKiBHZW5lcmF0ZSBhIHVuaXF1ZSBpZCBpZiBuZWVkZWQuIFRoZXNlIGFyZSBvbmx5IGd1YXJhbnRlZWQgdG8gYmUgdW5pcXVlXG4gKiB3aXRoaW4gdGhlIHNhbWUgZXhlY3V0aW9uIGNvbnRleHQgKGUuZy4gbm90IHVuaXF1ZSBmb3Igd29ya2VyIHZzIG1haW4pLlxuICovXG5cbkJvaWRNYW5hZ2VyLnVpZCA9IChmdW5jdGlvbigpIHtcbiAgdmFyIGlkID0gMDtcbiAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiAnYm9pZF8nICsgKCsraWQpO1xuICB9XG59KCkpO1xuXG4vKipcbiAqIEVpdGhlciBnZXQgb3IgaW5zdGFudGlhdGUgYW5kIGdldCBhIEJvaWQgYnkgaWQuIGlkIGNhbiBiZSB1bmRlZmluZWQsIGFuZFxuICogYSBuZXcgQm9pZCB3aWxsIHN0aWxsIGJlIGNyZWF0ZWQgYW5kIHJldHVybmVkLiBvcHRfY3RvckFyZ3Mgd2lsbCBjYXVzZVxuICogdGhlIEJvaWQgY29uc3RydWN0b3IgdG8gYmUgY2FsbGVkIGFnYWluIHZpYSBgYXBwbHlgLlxuICovXG5cbkJvaWRNYW5hZ2VyLnByb3RvdHlwZS5nZXRpbmF0ZSA9IGZ1bmN0aW9uKG9wdF9pZCwgb3B0X2N0b3JBcmdzKSB7XG4gIHZhciBib2lkID0gdGhpcy5rbm93bkJvaWRzW29wdF9pZF07XG4gIGlmICghYm9pZCkge1xuICAgIGJvaWQgPSBuZXcgQm9pZCgpO1xuICAgIGlmIChvcHRfY3RvckFyZ3MpIHtcbiAgICAgIEJvaWQuYXBwbHkoYm9pZCwgb3B0X2N0b3JBcmdzKTtcbiAgICB9XG4gICAgYm9pZC5pZCA9IG9wdF9pZCB8fCBCb2lkTWFuYWdlci51aWQoKTtcbiAgICB0aGlzLmtub3duQm9pZHNbYm9pZC5pZF0gPSBib2lkO1xuICB9XG5cbiAgcmV0dXJuIGJvaWQ7XG59XG5cbi8qKlxuICogUmV0dXJuIGFuIGFycmF5IGNvbnRhaW5pbmcgdGhlIGN1cnJlbnQga25vd24gYm9pZHMgYXQgY2FsbCB0aW1lLlxuICogVGhlIGFycmF5IHdpbGwgbm90IGJlIHVwZGF0ZWQgaWYgYm9pZHMgYXJlIGNyZWF0ZWQgb3IgZGVzdHJveWVkLlxuICovXG5cbkJvaWRNYW5hZ2VyLnByb3RvdHlwZS5hbGwgPSBmdW5jdGlvbigpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuICByZXR1cm4gT2JqZWN0LmtleXModGhpcy5rbm93bkJvaWRzKS5tYXAoZnVuY3Rpb24oaWQpIHtcbiAgICByZXR1cm4gc2VsZi5rbm93bkJvaWRzW2lkXTtcbiAgfSk7XG59XG5cbi8qKlxuICogUGVyZm9ybSBhIGNhbGxiYWNrIG9uIGVhY2gga25vd24gYm9pZC5cbiAqL1xuXG5Cb2lkTWFuYWdlci5wcm90b3R5cGUuZm9yRWFjaCA9IGZ1bmN0aW9uKGNiKSB7XG4gIHZhciBib2lkSWRzID0gT2JqZWN0LmtleXModGhpcy5rbm93bkJvaWRzKVxuICAgICwgYm9pZFxuICAgICwgaTtcblxuICBmb3IgKGkgPSAwOyBpIDwgYm9pZElkcy5sZW5ndGg7IGkrKykge1xuICAgIGJvaWQgPSB0aGlzLmtub3duQm9pZHNbYm9pZElkc1tpXV07XG4gICAgY2IoYm9pZCwgaSk7XG4gIH1cbn1cbiIsIlxubW9kdWxlLmV4cG9ydHMgPSB7XG5cbiAgICAvLyBIb3cgb2Z0ZW4gc2hvdWxkIHRoZSBwaHlzaWNzIGJlIGNhbGN1bGF0ZWQ/XG4gICAgUEhZU0lDU19IWjogMzBcblxuICAgIC8qKlxuICAgICAqIEhvdyBtYW55IGJvaWRzIHNob3VsZCB3ZSBnZW5lcmF0ZT9cbiAgICAgKi9cbiAgLCBCT0lEX0NPVU5UOiA3MDBcblxuICAgIC8qKlxuICAgICAqIEhvdyBtdWNoIGVuZXJneSBzaG91bGQgYmUgbG9zdCB3aGVuIGNvbGxpZGluZz8gVGhpcyBpcyBmYWlybHkgbG93XG4gICAgICogc28gdGhlIGJvaWRzIGNvYWxlc2NlIHF1aWNrbHkuXG4gICAgICovXG4gICwgQk9JRF9EQU1QSU5HOiAwLjk1XG5cbiAgICAvKipcbiAgICAgKiBIb3cgZmFyIGF3YXkgc2hvdWxkIHRoZSBib2lkcyBiZSBnZW5lcmF0ZWQgZnJvbSB0aGUgYXR0cmFjdGlvbiBwb2ludD9cbiAgICAgKi9cbiAgLCBCT0lEX0lOSVRJQUxfRElTVEFOQ0U6IDYwMFxuXG4gICAgLyoqXG4gICAgICogV2hlcmUgYm9pZHMgYmUgYXR0cmFjdGluZy5cbiAgICAgKi9cbiAgLCBCT0lEX0FUVFJBQ1RJT05fUE9JTlRfWDogNDAwXG4gICwgQk9JRF9BVFRSQUNUSU9OX1BPSU5UX1k6IDIwMFxuXG4gICAgLyoqXG4gICAgICogQm9pZCByYWlkdXMgaXMgcmFuZG9tbHkgZ2VuZXJhdGVkIHVzaW5nIGEgc2VlZGFibGUgZ2VuZXJhdG9yLiBNZWFuaW5nXG4gICAgICogd2hpbGUgdGhlIGdlbmVyYXRpb24gaXMgcmFuZG9tLCBpdCdzIHJlcHJvZHVjaWJsZSBiZXR3ZWVuIHJ1bnMgaWYgdGhlXG4gICAgICogc2FtZSBzZWVkIGlzIHVzZWQuXG4gICAgICovXG4gICwgQk9JRF9NSU5fUkFESVVTOiA0XG4gICwgQk9JRF9NQVhfUkFESVVTOiA4XG5cbiAgICAvKipcbiAgICAgKiBIb3cgcG90ZW50IGlzIHRoZSBhdHRyYWN0aW9uP1xuICAgICAqL1xuICAsIENFTlRFUl9BVFRSQUNUSU9OOiAwLjFcbn0iLCJcbm1vZHVsZS5leHBvcnRzID0gRml4ZWRTdGVwO1xuXG4vKipcbiAqIEdpdmVuIGEgdGFyZ2V0IGRlbHRhIHRpbWUsIGV4ZWN1dGUgYSBjYWxsYmFjayBvbmx5IHdoZW4gdGhhdCB0YXJnZXRcbiAqIGRlbHRhIHRpbWUgaGFzIGJlZW4gZXhlY2VlZGVkLiBJZiBtb3JlIHRpbWUgdGhhbiB0aGUgdGFyZ2V0IGRlbHRhXG4gKiBoYXMgZWxhcHNlZCBzaW5jZSB0aGUgbGFzdCBjYWxsIHRvIGB1cGRhdGVgLCB0aGVuIGV4ZWN1dGUgdGhlIGNhbGxiYWNrXG4gKiBtdWx0aXBsZSB0aW1lcyBzeW5jaHJvbm91c2x5IHRvIGNvbXBlbnNhdGUuXG4gKlxuICogQSBjb21tb24gdXNlIGZvciB0aGlzIGlzIGlmIHlvdSBwdXQgYSB0YWIgaW50byB0aGUgYmFja2dyb3VuZC4gV2hlbiBmb2N1c1xuICogcmV0dXJucyBwaHlzaWNzIHdpbGwgc3RpbGwgYmUgdXAgdG8gZGF0ZSwgZXZlbiB0aG91Z2ggdGhleSB3ZXJlIG5vdCBiZWluZ1xuICogY2FsY3VsYXRlZCBpbiByZWFsIHRpbWUuXG4gKlxuICogVGhpcyBvYmplY3QgZG9lcyBubyB0aW1lIGNhbGN1bGF0aW9ucyBpdHNlbGYsIHNvIGl0IHJlbGllcyBvbiBhY2N1cmF0ZVxuICogZWxhcHNlZCB0aW1lcyBiZWluZyBwYXNzZWQgaW50byBgdXBkYXRlYC5cbiAqL1xuXG5mdW5jdGlvbiBGaXhlZFN0ZXAodGFyZ2V0RFQsIG9uU3RlcCkge1xuICB0aGlzLmFjY3VtdWxhdG9yID0gMDtcbiAgdGhpcy5hY2N1bXVsYXRvclJhdGlvID0gMDtcbiAgdGhpcy5vblN0ZXAgPSBvblN0ZXA7XG4gIHRoaXMudGFyZ2V0RFQgPSB0YXJnZXREVCB8fCAzMy4zMzMzO1xufVxuXG5GaXhlZFN0ZXAucHJvdG90eXBlLnVwZGF0ZSA9IGZ1bmN0aW9uKGR0KSB7XG5cbiAgdGhpcy5hY2N1bXVsYXRvciArPSBkdDtcblxuICAvLyB0YWtlIHRoZSBjdXJyZW50IGRlbHRhLCBwbHVzIHdoYXQgcmVtYWlucyBmcm9tIGxhc3QgdGltZSxcbiAgLy8gYW5kIGRldGVybWluZSBob3cgbWFueSBsb2dpY2FsIHN0ZXBzIGZpdC5cbiAgdmFyIHN0ZXBzID0gTWF0aC5mbG9vcih0aGlzLmFjY3VtdWxhdG9yIC8gdGhpcy50YXJnZXREVCk7XG5cbiAgLy8gUmVtb3ZlIHdoYXQgd2lsbCBiZSBjb25zdW1lZCB0aGlzIHRpY2suXG4gIGlmIChzdGVwcyA+IDApIHRoaXMuYWNjdW11bGF0b3IgLT0gc3RlcHMgKiB0aGlzLnRhcmdldERUO1xuXG4gIHRoaXMuYWNjdW11bGF0b3JSYXRpbyA9IHRoaXMuYWNjdW11bGF0b3IgLyB0aGlzLnRhcmdldERUO1xuXG4gIC8vY29uc29sZS5sb2coJ3N0ZXBzIHRoaXMgdXBkYXRlJywgc3RlcHMpO1xuXG4gIHdoaWxlKHN0ZXBzID4gMCkge1xuICAgIHRoaXMub25TdGVwKHRoaXMudGFyZ2V0RFQpO1xuICAgIHN0ZXBzLS07XG4gIH1cbn1cbiIsIlxuLyoqXG4gKiBDYWxsIGEgZnVuY3Rpb24gYXMgb2Z0ZW4gYXMgcG9zc2libGUgdXNpbmcgZWl0aGVyIHRoZSBwcm92aWRlZFxuICogYGltbWVkaWF0ZUltcGxlbWVudGF0aW9uYCBmdW5jdGlvbiBvciBgc2V0VGltZW91dGAuIFlvdSBjb3VsZCBwYXNzLFxuICogZm9yIGV4YW1wbGUsIGByZXF1ZXN0QW5pbWF0aW9uRnJhbWVgIG9yIHNvbWV0aGluZyBsaWtlIGBwcm9jZXNzLm5leHRUaWNrYC5cbiAqIFRoZSBjYWxsYmFjayBpcyBnaXZlbiB0aGUgZGVsdGEgb2YgdGltZSBmcm9tIHdoZW4gdGhlIGNhbGxiYWNrIHdhcyBsYXN0XG4gKiBjYWxsZWQgKHRoaXMgaW5jbHVkZXMgdGhlIGNhbGxiYWNrJ3MgcHJldmlvdXMgZXhlY3V0aW9uIHRpbWUpLlxuICovXG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oY2IsIGltbWVkaWF0ZUltcGwpIHtcbiAgdmFyIGxhc3QgPSBudWxsXG4gICAgLCBydW5uaW5nID0gdHJ1ZTtcblxuICAvLyBVc2Ugd2hhdGV2ZXIgaXMgcGFzc2VkIGluIHRvIGFkZCB0byB0aGUgcnVuIGxvb3AuXG4gIGltbWVkaWF0ZUltcGwgPSBpbW1lZGlhdGVJbXBsIHx8IHNldFRpbWVvdXQ7XG5cbiAgZnVuY3Rpb24gbmV4dCgpIHtcbiAgICBpZiAocnVubmluZykgaW1tZWRpYXRlSW1wbChuZXh0KTtcbiAgICB2YXIgbm93ID0gRGF0ZS5ub3coKTtcbiAgICBjYihub3cgLSBsYXN0KTtcbiAgICBsYXN0ID0gbm93O1xuICB9XG5cbiAgcmV0dXJuIHtcbiAgICBzdG9wOiBmdW5jdGlvbigpIHsgcnVubmluZyA9IGZhbHNlOyB9LFxuICAgIHN0YXJ0OiBmdW5jdGlvbigpIHtcbiAgICAgIGxhc3QgPSBEYXRlLm5vdygpO1xuICAgICAgbmV4dCgpO1xuICAgIH1cbiAgfVxufVxuIiwiXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKGN2cykge1xuICBmdW5jdGlvbiByZXNpemUoZSkge1xuICAgIGN2cy53aWR0aCA9IGRvY3VtZW50LmJvZHkuY2xpZW50V2lkdGg7XG4gICAgY3ZzLmhlaWdodCA9IGRvY3VtZW50LmJvZHkuY2xpZW50SGVpZ2h0O1xuICB9XG5cbiAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ3Jlc2l6ZScsIHJlc2l6ZSwgZmFsc2UpO1xuICByZXNpemUoKTtcblxuICByZXR1cm4gcmVzaXplO1xufTsiLCJ2YXIgUlN0YXRzID0gcmVxdWlyZSgnLi4vdmVuZG9yL3JzdGF0cycpO1xudmFyIHJzdGF0cyA9IG5ldyBSU3RhdHMoe1xuICB2YWx1ZXM6IHtcbiAgICBwaHlzOiB7IGNhcHRpb246ICdUaW1lIHBlciBwaHlzaWNzIHVwZGF0ZSAobXMpJywgb3ZlcjogMzAgfSxcbiAgICBmcHM6IHsgY2FwdGlvbjogJ0ZyYW1lIHJhdGUnLCBiZWxvdzogNTggfSxcbiAgICBmcmFtZTogeyBjYXB0aW9uOiAnVGltZSBzcGVudCBkcmF3aW5nIChtcyknIH0sXG4gICAgckFGOiB7IGNhcHRpb246ICdUaW1lIHNpbmNlIGxhc3QgckFGIChtcyknIH1cbiAgfVxufSk7XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oaWQpIHtcbiAgaWYgKGVuYWJsZWQpIHJldHVybiByc3RhdHMoaWQpO1xuICBlbHNlIHJldHVybiBmYWNhZGU7XG59XG5cbnZhciBlbmFibGVkID0gdHJ1ZTtcbnZhciBub29wID0gZnVuY3Rpb24oKSB7fTtcbnZhciBmYWNhZGUgPSB7XG4gIHVwZGF0ZTogbm9vcCxcbiAgc2V0OiBub29wLFxuICBzdGFydDogbm9vcCxcbiAgZW5kOiBub29wLFxuICBmcmFtZTogbm9vcCxcbiAgdGljazogbm9vcFxufVxuXG5tb2R1bGUuZXhwb3J0cy50b2dnbGUgPSBmdW5jdGlvbigpIHtcbiAgZW5hYmxlZCA9ICFlbmFibGVkO1xufSIsIlxudmFyIEFsZWEgPSByZXF1aXJlKCdhbGVhJyk7XG52YXIgcmFuZG9tID0gbmV3IEFsZWEoJ05PVCBFTk9VR0ggU1RPTkUnKTtcblxudmFyIEJvaWRNYW5hZ2VyID0gcmVxdWlyZSgnLi9ib2lkbWFuYWdlcicpO1xudmFyIEZpeGVkU3RlcCA9IHJlcXVpcmUoJy4vZml4ZWRzdGVwJyk7XG52YXIgcmVwZWF0ZXIgPSByZXF1aXJlKCcuL3JlcGVhdGVyJyk7XG5cbnZhciBjb25maWcgPSByZXF1aXJlKCcuL2NvbmZpZycpO1xuXG4vLyBBbGwgd29ya2VyIGNvZGUgbXVzdCBiZSB3aXRoaW4gdGhpcyBmdW5jdGlvbiBmb3Igd2Vid29ya2lmeVxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbigpIHtcblxuICAvLyBBbGxvdyB0aGlzIGNvZGUgdG8gYmUgdXNlZCBlaXRoZXIgYXMgYSB0cnVlIHdvcmtlciBvclxuICAvLyBzaW5nbGUgdGhyZWFkZWQgd2l0aG91dCBhIHdvcmtlci5cbiAgdmFyIHBvc3RNc2c7XG4gIGlmICh0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJykge1xuICAgIC8vIFdlJ3JlIHJ1bm5pbmcgaW4gc2luZ2xlIHRocmVhZGVkIG1vZGUsIHNvIGVuc3VyZSB0aGF0IG1lc3NhZ2VzIGFyZVxuICAgIC8vIGFsd2F5cyBwb3N0ZWQgb24gdGhlIG5leHQgdGljay5cbiAgICBwb3N0TXNnID0gZnVuY3Rpb24ob2JqKSB7XG4gICAgICAvLyBOT1RFOiB3ZSdyZSBwb3N0aW5nIHRvICogZG9tYWluIGZvciBzaW1wbGljaXR5IGhlcmUsIGJ1dCB0byBiZVxuICAgICAgLy8gc2VjdXJlIHdlIHNob3VsZCBiZSBleHBsaWNpdCBmb3IgcHJvZHVjdGlvbiBjb2RlLlxuICAgICAgd2luZG93LnBvc3RNZXNzYWdlKG9iaiwgJyonKTtcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgLy8gV2UncmUgcnVubmluZyBpbiBhIHdvcmtlciwgc28ganVzdCB1c2UgdGhlIGRlZmF1bHQgc2VtYW50aWNzLlxuICAgIHBvc3RNc2cgPSBmdW5jdGlvbihvYmopIHtcbiAgICAgIHBvc3RNZXNzYWdlKG9iaik7XG4gICAgfVxuICB9XG5cbiAgLy8gT25seSBjYWxsIHRoZSBzaW11bGF0aW9uIGF0IDMwIEh6LlxuICB2YXIgc3RlcHBlciA9IG5ldyBGaXhlZFN0ZXAoMTAwMCAvIGNvbmZpZy5QSFlTSUNTX0haLCB1cGRhdGUpO1xuXG4gIC8vIFRoZSB3b3JrZXIgd2lsbCBtYW5hZ2UgaXRzIG93biBsaXN0IG9mIGJvaWRzLlxuICB2YXIgYm9pZG1hbiA9IG5ldyBCb2lkTWFuYWdlcjtcblxuICAvLyBJbml0aWFsaXplIHRoZSBnYW1lIHdvcmxkXG5cbiAgdmFyIG1heEJvaWRzID0gY29uZmlnLkJPSURfQ09VTlRcbiAgICAsIGRpc3RhbmNlID0gY29uZmlnLkJPSURfSU5JVElBTF9ESVNUQU5DRVxuICAgICwgbWluUmFkaXVzID0gY29uZmlnLkJPSURfTUlOX1JBRElVU1xuICAgICwgbWF4UmFkaXVzID0gY29uZmlnLkJPSURfTUFYX1JBRElVU1xuICAgICwgdGhldGFcbiAgICAsIHhcbiAgICAsIHlcbiAgICAsIHJhZGl1c1xuICAgICwgYm9pZFxuXG4gIC8vIE1ha2UgYSBidW5jaCBvZiBib2lkcyBldmVubHkgc3BhY2VkIGluIGEgY2lyY2xlLlxuICBmb3IodmFyIGkgPSAwOyBpIDwgbWF4Qm9pZHM7IGkrKykge1xuICAgIHRoZXRhID0gKGkvbWF4Qm9pZHMpICogTWF0aC5QSSoyO1xuICAgIHggPSBjb25maWcuQk9JRF9BVFRSQUNUSU9OX1BPSU5UX1ggKyAoTWF0aC5jb3ModGhldGEpICogZGlzdGFuY2UpO1xuICAgIHkgPSBjb25maWcuQk9JRF9BVFRSQUNUSU9OX1BPSU5UX1kgKyAoTWF0aC5zaW4odGhldGEpICogZGlzdGFuY2UpO1xuICAgIHJhZGl1cyA9IG1pblJhZGl1cyArIChtYXhSYWRpdXMgLSBtaW5SYWRpdXMpICogcmFuZG9tKCk7XG4gICAgYm9pZCA9IGJvaWRtYW4uZ2V0aW5hdGUobnVsbCwgW3gsIHksIHJhZGl1c10pO1xuICB9XG5cbiAgZnVuY3Rpb24gdXBkYXRlKGR0KSB7XG4gICAgdmFyIHN0YXJ0VGltZSA9IERhdGUubm93KCk7XG4gICAgdmFyIGksIGJvaWQ7XG5cbiAgICB2YXIgYm9pZHMgPSBib2lkbWFuLmFsbCgpO1xuXG4gICAgYXR0cmFjdEFsbChcbiAgICAgIGNvbmZpZy5DRU5URVJfQVRUUkFDVElPTixcbiAgICAgIGNvbmZpZy5CT0lEX0FUVFJBQ1RJT05fUE9JTlRfWCxcbiAgICAgIGNvbmZpZy5CT0lEX0FUVFJBQ1RJT05fUE9JTlRfWSk7XG5cbiAgICBmb3IgKGkgPSAwOyBpIDwgYm9pZHMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGJvaWQgPSBib2lkc1tpXTtcbiAgICAgIGJvaWQuYWNjZWxlcmF0ZShkdCk7XG4gICAgfVxuXG4gICAgY29sbGlkZUFsbChmYWxzZSk7XG5cbiAgICBmb3IgKGkgPSAwOyBpIDwgYm9pZHMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGJvaWQgPSBib2lkc1tpXTtcbiAgICAgIGJvaWQuaW5lcnRpYShkdCk7XG4gICAgfVxuXG4gICAgY29sbGlkZUFsbCh0cnVlKTtcblxuICAgIC8vIE5vdGlmeSB0aGUgbWFpbiB0aHJlYWQgdGhhdCBhbGwgYm9pZHMgaGF2ZSBhIG5ldyBwb3NpdGlvblxuICAgIHZhciBzbmFwc2hvdHMgPSBbXTtcbiAgICBmb3IgKGkgPSAwOyBpIDwgYm9pZHMubGVuZ3RoOyBpKyspIHtcbiAgICAgIC8vIFdlIHBhc3MgaW4gYW4gZW1wdHkgb2JqZWN0LiBBcyBhIGZ1dHVyZSBvcHRpbWl6YXRpb24sIHRoZXNlIG9iamVjdHNcbiAgICAgIC8vIGNvdWxkIGJlIE9iamVjdC5jcmVhdGUobnVsbCkgb3Igb2JqZWN0IHBvb2xlZC5cbiAgICAgIHNuYXBzaG90cy5wdXNoKGJvaWRzW2ldLndyaXRlVG9TbmFwc2hvdCh7fSkpO1xuICAgIH1cblxuICAgIC8vIFRPRE86IElmIHVwZGF0ZSBpcyBjYWxsZWQgbXVsdGlwbGUgdGltZXMgdmlhIEZpeGVkVGltZSwgaXQgd2lsbCBlbWl0XG4gICAgLy8gbXVsdGlwbGUgc25hcHNob3RzLiBJZiB0aGUgcmVuZGVyIHRocmVhZCBpcyBiZWhpbmQsIHRoYXQgd2lsbCBsb29rXG4gICAgLy8gZXh0cmVtZWx5IGphcnJpbmcgKGJ1bXAgbWF4IGJvaWRzIHRvIGEgaGlnaCBudW1iZXIgdG8gc2VlKS5cblxuICAgIHZhciBlbmRUaW1lID0gRGF0ZS5ub3coKTtcbiAgICBwb3N0TXNnKHtcbiAgICAgIHR5cGU6ICdzdGVwJyxcbiAgICAgIHNuYXBzaG90czogc25hcHNob3RzLFxuICAgICAgc3RhcnRUaW1lOiBzdGFydFRpbWUsXG4gICAgICBlbmRUaW1lOiBlbmRUaW1lXG4gICAgfSk7XG4gIH1cblxuICBmdW5jdGlvbiBjb2xsaWRlQWxsKHByZXNlcnZlSW5lcnRpYSkge1xuICAgIHZhciBpLCBqLCBib2lkQSwgYm9pZEI7XG5cbiAgICB2YXIgYm9pZHMgPSBib2lkbWFuLmFsbCgpO1xuXG4gICAgZm9yIChpID0gMDsgaSA8IGJvaWRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBib2lkQSA9IGJvaWRzW2ldXG4gICAgICBmb3IgKGogPSBpICsgMTsgaiA8IGJvaWRzLmxlbmd0aDsgaisrKSB7XG4gICAgICAgIGJvaWRCID0gYm9pZHNbal07XG4gICAgICAgIGJvaWRBLmNvbGxpZGVXaXRoKGJvaWRCLCBwcmVzZXJ2ZUluZXJ0aWEpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIGF0dHJhY3RBbGwoYW1vdW50LCB4LCB5KSB7XG4gICAgdmFyIGksIGJvaWQsIGRpclgsIGRpclksIG1hZztcblxuICAgIHZhciBib2lkcyA9IGJvaWRtYW4uYWxsKCk7XG5cbiAgICBmb3IgKGkgPSAwOyBpIDwgYm9pZHMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGJvaWQgPSBib2lkc1tpXTtcbiAgICAgIGRpclggPSB4IC0gYm9pZC5jcG9zLng7XG4gICAgICBkaXJZID0geSAtIGJvaWQuY3Bvcy55O1xuXG4gICAgICAvLyBub3JtYWxpemVcbiAgICAgIG1hZyA9IE1hdGguc3FydChkaXJYKmRpclggKyBkaXJZKmRpclkpO1xuICAgICAgZGlyWCAvPSBtYWc7XG4gICAgICBkaXJZIC89IG1hZztcblxuICAgICAgYm9pZC5hY2VsLnggKz0gZGlyWCAqIGFtb3VudDtcbiAgICAgIGJvaWQuYWNlbC55ICs9IGRpclkgKiBhbW91bnQ7XG4gICAgfVxuICB9XG5cbiAgdmFyIHJlcGVhdGVyQ3RsID0gcmVwZWF0ZXIoZnVuY3Rpb24oZHQpIHtcbiAgICAvLyBDYWxsIHRoZSBzdGVwcGVyIGFzIG9mdGVuIGFzIHBvc3NpYmxlLlxuICAgIHN0ZXBwZXIudXBkYXRlKGR0KTtcbiAgfSlcblxuICByZXBlYXRlckN0bC5zdGFydCgpO1xuXG4gIC8vIGxpc3RlbiBmb3IgbWVzc2FnZXMgZnJvbSB0aGUgXCJtYWluXCIgdGhyZWFkXG4gIGFkZEV2ZW50TGlzdGVuZXIoJ21lc3NhZ2UnLCBmdW5jdGlvbihldikge1xuICAgIGlmIChldi5kYXRhLnR5cGUgPT09ICdIQUxUJykge1xuICAgICAgcmVwZWF0ZXJDdGwuc3RvcCgpO1xuICAgICAgLy8gVGhpcyB3aWxsIGVycm9yIGluIGEgRkYgd29ya2VyLCBidXQgaXQncyBvayBzaW5jZSB3ZSdsbCBzdGlsbCBzZWUgaXQuXG4gICAgICAvLyBJdCBqdXN0IGhhcyB0byBiZSB0aGUgbGFzdCBsaW5lLCBvdGhlcndpc2Ugb3RoZXIgc3R1ZmYgd2lsbCBicmVha1xuICAgICAgLy8gKGFsc28sIHdlJ3JlIG5vdCBzdGFydGluZyB0aGlzIHVwIGFnYWluLCBzbyBpdCdzIGZpbmUpLlxuICAgICAgY29uc29sZS5sb2coJ2hhbHRpbmcgZnJvbSB3b3JrZXInKTtcbiAgICB9XG4gIH0pO1xufVxuIiwiXG5jb25zb2xlLmxvZygncnVubmluZyBpbiBNVUxUSSBUSFJFQURFRCBNT0RFJyk7XG5cbnZhciB3b3JrID0gcmVxdWlyZSgnd2Vid29ya2lmeScpXG4gICwgc2NpaGFsdCA9IHJlcXVpcmUoJ3NjaWVuY2UtaGFsdCcpO1xuXG52YXIgY29uZmlnID0gcmVxdWlyZSgnLi9saWIvY29uZmlnJyk7XG5cbnZhciBjdnMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcjc3RhZ2UnKVxuICAsIGN0eCA9IGN2cy5nZXRDb250ZXh0KCcyZCcpXG4gICwgcmVzaXplbW9uID0gcmVxdWlyZSgnLi9saWIvcmVzaXplbW9uJykoY3ZzKTtcblxudmFyIHJzdGF0cyA9IHJlcXVpcmUoJy4vbGliL3JzdGF0c2hlbHBlcicpO1xuXG52YXIgcmVwZWF0ZXIgPSByZXF1aXJlKCcuL2xpYi9yZXBlYXRlcicpO1xuXG52YXIgd29ya2VyID0gd29yayhyZXF1aXJlKCcuL2xpYi93b3JrZXInKSk7XG5cbnZhciBCb2lkTWFuYWdlciA9IHJlcXVpcmUoJy4vbGliL2JvaWRtYW5hZ2VyJyk7XG52YXIgYm9pZG1hbiA9IG5ldyBCb2lkTWFuYWdlcjtcbnZhciBsYXN0U25hcHNob3RSZWNlaXZlZEF0ID0gcGVyZm9ybWFuY2Uubm93KCk7XG5cbndvcmtlci5hZGRFdmVudExpc3RlbmVyKCdtZXNzYWdlJywgZnVuY3Rpb24oZXYpIHtcblxuICAvLyBBIGZ1bGwgc3RlcCBjb250YWlucyBzbmFwc2hvdHMuXG4gIGlmIChldi5kYXRhLnR5cGUgPT09ICdzdGVwJykge1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgZXYuZGF0YS5zbmFwc2hvdHMubGVuZ3RoOyBpKyspIHtcbiAgICAgIHZhciBzbmFwc2hvdCA9IGV2LmRhdGEuc25hcHNob3RzW2ldO1xuICAgICAgdmFyIGJvaWQgPSBib2lkbWFuLmdldGluYXRlKHNuYXBzaG90LmlkKTtcbiAgICAgIGJvaWQucmVhZEZyb21TbmFwc2hvdChzbmFwc2hvdCk7XG4gICAgfVxuXG4gICAgLy8gVE9ETzogdGhlcmUgaGFzIHRvIGJlIGEgYmV0dGVyIHdheSB0byBkbyB0aGlzP1xuICAgIGxhc3RTbmFwc2hvdFJlY2VpdmVkQXQgPSBwZXJmb3JtYW5jZS5ub3coKTtcblxuICAgIHJzdGF0cygncGh5cycpLnNldChldi5kYXRhLmVuZFRpbWUgLSBldi5kYXRhLnN0YXJ0VGltZSk7XG4gICAgcnN0YXRzKCkudXBkYXRlKCk7XG4gICAgcmV0dXJuO1xuICB9XG5cbn0pO1xuXG5mdW5jdGlvbiBncmFwaGljcyhkdCkge1xuICB2YXIgbm93ID0gcGVyZm9ybWFuY2Uubm93KCk7XG4gIHJzdGF0cygnZnJhbWUnKS5zdGFydCgpO1xuICByc3RhdHMoJ0ZQUycpLmZyYW1lKCk7XG4gIHJzdGF0cygnckFGJykudGljaygpO1xuICBjdHguY2xlYXJSZWN0KDAsIDAsIGN2cy53aWR0aCwgY3ZzLmhlaWdodCk7XG4gIHZhciByYXRpbyA9IChub3cgLSBsYXN0U25hcHNob3RSZWNlaXZlZEF0KSAvIDEwMDAgLyBjb25maWcuUEhZU0lDU19IWjtcbiAgdmFyIGJvaWRzID0gYm9pZG1hbi5hbGwoKTtcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBib2lkcy5sZW5ndGg7IGkrKykge1xuICAgIGJvaWRzW2ldLmRyYXcoY3R4LCByYXRpbyk7XG4gIH1cbiAgcnN0YXRzKCdmcmFtZScpLmVuZCgpO1xuICByc3RhdHMoKS51cGRhdGUoKTtcbn1cblxuLy8gQ2FsbCBgZ3JhcGhpY3NgIGFzIG9mdGVuIGFzIHBvc3NpYmxlIHVzaW5nIGByZXF1ZXN0QW5pbWF0aW9uRnJhbWVgLlxudmFyIHJlcGVhdGVyQ3RsID0gcmVwZWF0ZXIoZ3JhcGhpY3MsIHJlcXVlc3RBbmltYXRpb25GcmFtZSk7XG5yZXBlYXRlckN0bC5zdGFydCgpO1xuXG5zY2loYWx0KGZ1bmN0aW9uKCkge1xuICByZXBlYXRlckN0bC5zdG9wKCk7XG4gIHdvcmtlci5wb3N0TWVzc2FnZSh7IHR5cGU6ICdIQUxUJyB9KTtcbn0pXG4iLCIoZnVuY3Rpb24gKHJvb3QsIGZhY3RvcnkpIHtcbiAgaWYgKHR5cGVvZiBleHBvcnRzID09PSAnb2JqZWN0Jykge1xuICAgICAgbW9kdWxlLmV4cG9ydHMgPSBmYWN0b3J5KCk7XG4gIH0gZWxzZSBpZiAodHlwZW9mIGRlZmluZSA9PT0gJ2Z1bmN0aW9uJyAmJiBkZWZpbmUuYW1kKSB7XG4gICAgICBkZWZpbmUoZmFjdG9yeSk7XG4gIH0gZWxzZSB7XG4gICAgICByb290LkFsZWEgPSBmYWN0b3J5KCk7XG4gIH1cbn0odGhpcywgZnVuY3Rpb24gKCkge1xuXG4gICd1c2Ugc3RyaWN0JztcblxuICAvLyBGcm9tIGh0dHA6Ly9iYWFnb2UuY29tL2VuL1JhbmRvbU11c2luZ3MvamF2YXNjcmlwdC9cblxuICAvLyBpbXBvcnRTdGF0ZSB0byBzeW5jIGdlbmVyYXRvciBzdGF0ZXNcbiAgQWxlYS5pbXBvcnRTdGF0ZSA9IGZ1bmN0aW9uKGkpe1xuICAgIHZhciByYW5kb20gPSBuZXcgQWxlYSgpO1xuICAgIHJhbmRvbS5pbXBvcnRTdGF0ZShpKTtcbiAgICByZXR1cm4gcmFuZG9tO1xuICB9O1xuXG4gIHJldHVybiBBbGVhO1xuXG4gIGZ1bmN0aW9uIEFsZWEoKSB7XG4gICAgcmV0dXJuIChmdW5jdGlvbihhcmdzKSB7XG4gICAgICAvLyBKb2hhbm5lcyBCYWFnw7hlIDxiYWFnb2VAYmFhZ29lLmNvbT4sIDIwMTBcbiAgICAgIHZhciBzMCA9IDA7XG4gICAgICB2YXIgczEgPSAwO1xuICAgICAgdmFyIHMyID0gMDtcbiAgICAgIHZhciBjID0gMTtcblxuICAgICAgaWYgKGFyZ3MubGVuZ3RoID09IDApIHtcbiAgICAgICAgYXJncyA9IFsrbmV3IERhdGVdO1xuICAgICAgfVxuICAgICAgdmFyIG1hc2ggPSBNYXNoKCk7XG4gICAgICBzMCA9IG1hc2goJyAnKTtcbiAgICAgIHMxID0gbWFzaCgnICcpO1xuICAgICAgczIgPSBtYXNoKCcgJyk7XG5cbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgYXJncy5sZW5ndGg7IGkrKykge1xuICAgICAgICBzMCAtPSBtYXNoKGFyZ3NbaV0pO1xuICAgICAgICBpZiAoczAgPCAwKSB7XG4gICAgICAgICAgczAgKz0gMTtcbiAgICAgICAgfVxuICAgICAgICBzMSAtPSBtYXNoKGFyZ3NbaV0pO1xuICAgICAgICBpZiAoczEgPCAwKSB7XG4gICAgICAgICAgczEgKz0gMTtcbiAgICAgICAgfVxuICAgICAgICBzMiAtPSBtYXNoKGFyZ3NbaV0pO1xuICAgICAgICBpZiAoczIgPCAwKSB7XG4gICAgICAgICAgczIgKz0gMTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgbWFzaCA9IG51bGw7XG5cbiAgICAgIHZhciByYW5kb20gPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIHQgPSAyMDkxNjM5ICogczAgKyBjICogMi4zMjgzMDY0MzY1Mzg2OTYzZS0xMDsgLy8gMl4tMzJcbiAgICAgICAgczAgPSBzMTtcbiAgICAgICAgczEgPSBzMjtcbiAgICAgICAgcmV0dXJuIHMyID0gdCAtIChjID0gdCB8IDApO1xuICAgICAgfTtcbiAgICAgIHJhbmRvbS51aW50MzIgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHJhbmRvbSgpICogMHgxMDAwMDAwMDA7IC8vIDJeMzJcbiAgICAgIH07XG4gICAgICByYW5kb20uZnJhY3Q1MyA9IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gcmFuZG9tKCkgKyBcbiAgICAgICAgICAocmFuZG9tKCkgKiAweDIwMDAwMCB8IDApICogMS4xMTAyMjMwMjQ2MjUxNTY1ZS0xNjsgLy8gMl4tNTNcbiAgICAgIH07XG4gICAgICByYW5kb20udmVyc2lvbiA9ICdBbGVhIDAuOSc7XG4gICAgICByYW5kb20uYXJncyA9IGFyZ3M7XG5cbiAgICAgIC8vIG15IG93biBhZGRpdGlvbnMgdG8gc3luYyBzdGF0ZSBiZXR3ZWVuIHR3byBnZW5lcmF0b3JzXG4gICAgICByYW5kb20uZXhwb3J0U3RhdGUgPSBmdW5jdGlvbigpe1xuICAgICAgICByZXR1cm4gW3MwLCBzMSwgczIsIGNdO1xuICAgICAgfTtcbiAgICAgIHJhbmRvbS5pbXBvcnRTdGF0ZSA9IGZ1bmN0aW9uKGkpe1xuICAgICAgICBzMCA9ICtpWzBdIHx8IDA7XG4gICAgICAgIHMxID0gK2lbMV0gfHwgMDtcbiAgICAgICAgczIgPSAraVsyXSB8fCAwO1xuICAgICAgICBjID0gK2lbM10gfHwgMDtcbiAgICAgIH07XG4gXG4gICAgICByZXR1cm4gcmFuZG9tO1xuXG4gICAgfSAoQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzKSkpO1xuICB9XG5cbiAgZnVuY3Rpb24gTWFzaCgpIHtcbiAgICB2YXIgbiA9IDB4ZWZjODI0OWQ7XG5cbiAgICB2YXIgbWFzaCA9IGZ1bmN0aW9uKGRhdGEpIHtcbiAgICAgIGRhdGEgPSBkYXRhLnRvU3RyaW5nKCk7XG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGRhdGEubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgbiArPSBkYXRhLmNoYXJDb2RlQXQoaSk7XG4gICAgICAgIHZhciBoID0gMC4wMjUxOTYwMzI4MjQxNjkzOCAqIG47XG4gICAgICAgIG4gPSBoID4+PiAwO1xuICAgICAgICBoIC09IG47XG4gICAgICAgIGggKj0gbjtcbiAgICAgICAgbiA9IGggPj4+IDA7XG4gICAgICAgIGggLT0gbjtcbiAgICAgICAgbiArPSBoICogMHgxMDAwMDAwMDA7IC8vIDJeMzJcbiAgICAgIH1cbiAgICAgIHJldHVybiAobiA+Pj4gMCkgKiAyLjMyODMwNjQzNjUzODY5NjNlLTEwOyAvLyAyXi0zMlxuICAgIH07XG5cbiAgICBtYXNoLnZlcnNpb24gPSAnTWFzaCAwLjknO1xuICAgIHJldHVybiBtYXNoO1xuICB9XG59KSk7XG4iLCJcbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24ob25oYWx0LCBvcHRfbXNnLCBvcHRfa2V5Y29kZSkge1xuICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdrZXlkb3duJywgZnVuY3Rpb24oZSkge1xuICAgIGlmIChlLndoaWNoID09IChvcHRfa2V5Y29kZSB8fCAyNykpIHtcbiAgICAgIG9uaGFsdCgpO1xuICAgICAgY29uc29sZS5sb2cob3B0X21zZyB8fCAnSEFMVCBJTiBUSEUgTkFNRSBPRiBTQ0lFTkNFIScpO1xuICAgIH1cbiAgfSlcbn0iLCJ2YXIgYnVuZGxlRm4gPSBhcmd1bWVudHNbM107XG52YXIgc291cmNlcyA9IGFyZ3VtZW50c1s0XTtcbnZhciBjYWNoZSA9IGFyZ3VtZW50c1s1XTtcblxudmFyIHN0cmluZ2lmeSA9IEpTT04uc3RyaW5naWZ5O1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIChmbikge1xuICAgIHZhciBrZXlzID0gW107XG4gICAgdmFyIHdrZXk7XG4gICAgdmFyIGNhY2hlS2V5cyA9IE9iamVjdC5rZXlzKGNhY2hlKTtcbiAgICBcbiAgICBmb3IgKHZhciBpID0gMCwgbCA9IGNhY2hlS2V5cy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICAgICAgdmFyIGtleSA9IGNhY2hlS2V5c1tpXTtcbiAgICAgICAgaWYgKGNhY2hlW2tleV0uZXhwb3J0cyA9PT0gZm4pIHtcbiAgICAgICAgICAgIHdrZXkgPSBrZXk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgIH1cbiAgICBcbiAgICBpZiAoIXdrZXkpIHtcbiAgICAgICAgd2tleSA9IE1hdGguZmxvb3IoTWF0aC5wb3coMTYsIDgpICogTWF0aC5yYW5kb20oKSkudG9TdHJpbmcoMTYpO1xuICAgICAgICB2YXIgd2NhY2hlID0ge307XG4gICAgICAgIGZvciAodmFyIGkgPSAwLCBsID0gY2FjaGVLZXlzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgICAgICAgICAgdmFyIGtleSA9IGNhY2hlS2V5c1tpXTtcbiAgICAgICAgICAgIHdjYWNoZVtrZXldID0ga2V5O1xuICAgICAgICB9XG4gICAgICAgIHNvdXJjZXNbd2tleV0gPSBbXG4gICAgICAgICAgICBGdW5jdGlvbihbJ3JlcXVpcmUnLCdtb2R1bGUnLCdleHBvcnRzJ10sICcoJyArIGZuICsgJykoc2VsZiknKSxcbiAgICAgICAgICAgIHdjYWNoZVxuICAgICAgICBdO1xuICAgIH1cbiAgICB2YXIgc2tleSA9IE1hdGguZmxvb3IoTWF0aC5wb3coMTYsIDgpICogTWF0aC5yYW5kb20oKSkudG9TdHJpbmcoMTYpO1xuICAgIFxuICAgIHZhciBzY2FjaGUgPSB7fTsgc2NhY2hlW3drZXldID0gd2tleTtcbiAgICBzb3VyY2VzW3NrZXldID0gW1xuICAgICAgICBGdW5jdGlvbihbJ3JlcXVpcmUnXSwncmVxdWlyZSgnICsgc3RyaW5naWZ5KHdrZXkpICsgJykoc2VsZiknKSxcbiAgICAgICAgc2NhY2hlXG4gICAgXTtcbiAgICBcbiAgICB2YXIgc3JjID0gJygnICsgYnVuZGxlRm4gKyAnKSh7J1xuICAgICAgICArIE9iamVjdC5rZXlzKHNvdXJjZXMpLm1hcChmdW5jdGlvbiAoa2V5KSB7XG4gICAgICAgICAgICByZXR1cm4gc3RyaW5naWZ5KGtleSkgKyAnOlsnXG4gICAgICAgICAgICAgICAgKyBzb3VyY2VzW2tleV1bMF1cbiAgICAgICAgICAgICAgICArICcsJyArIHN0cmluZ2lmeShzb3VyY2VzW2tleV1bMV0pICsgJ10nXG4gICAgICAgICAgICA7XG4gICAgICAgIH0pLmpvaW4oJywnKVxuICAgICAgICArICd9LHt9LFsnICsgc3RyaW5naWZ5KHNrZXkpICsgJ10pJ1xuICAgIDtcbiAgICByZXR1cm4gbmV3IFdvcmtlcih3aW5kb3cuVVJMLmNyZWF0ZU9iamVjdFVSTChcbiAgICAgICAgbmV3IEJsb2IoW3NyY10sIHsgdHlwZTogJ3RleHQvamF2YXNjcmlwdCcgfSlcbiAgICApKTtcbn07XG4iLCIvLyBwZXJmb3JtYW5jZS5ub3coKSBwb2x5ZmlsbCBmcm9tIGh0dHBzOi8vZ2lzdC5naXRodWIuY29tL3BhdWxpcmlzaC81NDM4NjUwXG5cbihmdW5jdGlvbigpe1xuIFxuICAvLyBwcmVwYXJlIGJhc2UgcGVyZiBvYmplY3RcbiAgaWYgKHR5cGVvZiB3aW5kb3cucGVyZm9ybWFuY2UgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICB3aW5kb3cucGVyZm9ybWFuY2UgPSB7fTtcbiAgfVxuIFxuICBpZiAoIXdpbmRvdy5wZXJmb3JtYW5jZS5ub3cpe1xuICAgIFxuICAgIHZhciBub3dPZmZzZXQgPSBEYXRlLm5vdygpO1xuIFxuICAgIGlmIChwZXJmb3JtYW5jZS50aW1pbmcgJiYgcGVyZm9ybWFuY2UudGltaW5nLm5hdmlnYXRpb25TdGFydCl7XG4gICAgICBub3dPZmZzZXQgPSBwZXJmb3JtYW5jZS50aW1pbmcubmF2aWdhdGlvblN0YXJ0XG4gICAgfVxuIFxuIFxuICAgIHdpbmRvdy5wZXJmb3JtYW5jZS5ub3cgPSBmdW5jdGlvbiBub3coKXtcbiAgICAgIHJldHVybiBEYXRlLm5vdygpIC0gbm93T2Zmc2V0O1xuICAgIH1cbiBcbiAgfVxuIFxufSkoKTtcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiByU3RhdHMoIHNldHRpbmdzICkge1xuXG4gICAgJ3VzZSBzdHJpY3QnO1xuXG4gICAgdmFyIGVsZW1lbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdsaW5rJyk7XG4gICAgZWxlbWVudC5ocmVmID0gJ2h0dHA6Ly9mb250cy5nb29nbGVhcGlzLmNvbS9jc3M/ZmFtaWx5PVJvYm90bytDb25kZW5zZWQ6NDAwLDcwMCwzMDAnO1xuICAgIGVsZW1lbnQucmVsID0gJ3N0eWxlc2hlZXQnO1xuICAgIGVsZW1lbnQudHlwZSA9ICd0ZXh0L2Nzcyc7XG4gICAgZG9jdW1lbnQuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJ2hlYWQnKVswXS5hcHBlbmRDaGlsZChlbGVtZW50KVxuXG4gICAgdmFyIF9zZXR0aW5ncyA9IHNldHRpbmdzIHx8IHt9LFxuICAgICAgICBfY29sb3VycyA9IFsgJyM4NTA3MDAnLCAnI2M3NDkwMCcsICcjZmNiMzAwJywgJyMyODQyODAnLCAnIzRjN2MwYycgXTtcblxuICAgIGlmKCAhX3NldHRpbmdzLnZhbHVlcyApIF9zZXR0aW5ncy52YWx1ZXMgPSB7fTtcbiAgICBcbiAgICBmdW5jdGlvbiBHcmFwaCggX2RvbSwgX2lkICkge1xuXG4gICAgICAgIHZhciBfY2FudmFzID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ2NhbnZhcycgKSxcbiAgICAgICAgICAgIF9jdHggPSBfY2FudmFzLmdldENvbnRleHQoICcyZCcgKSxcbiAgICAgICAgICAgIF9tYXggPSAwLFxuICAgICAgICAgICAgX2N1cnJlbnQgPSAwO1xuXG4gICAgICAgIHZhciBfZG90Q2FudmFzID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ2NhbnZhcycgKSxcbiAgICAgICAgICAgIF9kb3RDdHggPSBfZG90Q2FudmFzLmdldENvbnRleHQoICcyZCcgKTtcbiAgICAgICAgX2RvdENhbnZhcy53aWR0aCA9IDE7XG4gICAgICAgIF9kb3RDYW52YXMuaGVpZ2h0ID0gMjA7XG4gICAgICAgIF9kb3RDdHguZmlsbFN0eWxlID0gJyM0NDQ0NDQnO1xuICAgICAgICBfZG90Q3R4LmZpbGxSZWN0KCAwLCAwLCAxLCAyMCApO1xuICAgICAgICBfZG90Q3R4LmZpbGxTdHlsZSA9ICcjNjY2NjY2JztcbiAgICAgICAgX2RvdEN0eC5maWxsUmVjdCggMCwgMTAsIDEsIDEwICk7XG4gICAgICAgIF9kb3RDdHguZmlsbFN0eWxlID0gJyNmZmZmZmYnO1xuICAgICAgICBfZG90Q3R4LmZpbGxSZWN0KCAwLCAxMCwgMSwgMSApO1xuXG4gICAgICAgIHZhciBfYWxhcm1DYW52YXMgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnY2FudmFzJyApLFxuICAgICAgICAgICAgX2FsYXJtQ3R4ID0gX2FsYXJtQ2FudmFzLmdldENvbnRleHQoICcyZCcgKTtcbiAgICAgICAgX2FsYXJtQ2FudmFzLndpZHRoID0gMTtcbiAgICAgICAgX2FsYXJtQ2FudmFzLmhlaWdodCA9IDIwO1xuICAgICAgICBfYWxhcm1DdHguZmlsbFN0eWxlID0gJyM0NDQ0NDQnO1xuICAgICAgICBfYWxhcm1DdHguZmlsbFJlY3QoIDAsIDAsIDEsIDIwICk7XG4gICAgICAgIF9hbGFybUN0eC5maWxsU3R5bGUgPSAnI2I3MDAwMCc7XG4gICAgICAgIF9hbGFybUN0eC5maWxsUmVjdCggMCwgMTAsIDEsIDEwICk7XG4gICAgICAgIF9hbGFybUN0eC5maWxsU3R5bGUgPSAnI2ZmZmZmZic7XG4gICAgICAgIF9hbGFybUN0eC5maWxsUmVjdCggMCwgMTAsIDEsIDEgKTtcblxuICAgICAgICBmdW5jdGlvbiBfaW5pdCgpIHtcblxuICAgICAgICAgICAgX2NhbnZhcy53aWR0aCA9IDIwMDtcbiAgICAgICAgICAgIF9jYW52YXMuaGVpZ2h0ID0gMTA7XG4gICAgICAgICAgICBfY2FudmFzLnN0eWxlLndpZHRoID0gX2NhbnZhcy53aWR0aCArICdweCc7XG4gICAgICAgICAgICBfY2FudmFzLnN0eWxlLmhlaWdodCA9IF9jYW52YXMuaGVpZ2h0ICsgJ3B4JztcbiAgICAgICAgICAgIF9jYW52YXMuc3R5bGUucG9zaXRpb24gPSAnYWJzb2x1dGUnO1xuICAgICAgICAgICAgX2NhbnZhcy5zdHlsZS5yaWdodCA9IDA7XG4gICAgICAgICAgICBfZG9tLmFwcGVuZENoaWxkKCBfY2FudmFzICk7XG5cbiAgICAgICAgICAgIF9jdHguZmlsbFN0eWxlID0gJyM0NDQ0NDQnO1xuICAgICAgICAgICAgX2N0eC5maWxsUmVjdCggMCwgMCwgX2NhbnZhcy53aWR0aCwgX2NhbnZhcy5oZWlnaHQgKTtcblxuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gX2RyYXcoIHYsIGFsYXJtICkge1xuICAgICAgICAgICAgX2N1cnJlbnQgKz0gKCB2IC0gX2N1cnJlbnQgKSAqIC4xO1xuICAgICAgICAgICAgX21heCAqPSAuOTk7XG4gICAgICAgICAgICBpZiggX2N1cnJlbnQgPiBfbWF4ICkgX21heCA9IF9jdXJyZW50O1xuICAgICAgICAgICAgX2N0eC5kcmF3SW1hZ2UoIF9jYW52YXMsIDEsIDAsIF9jYW52YXMud2lkdGggLSAxLCBfY2FudmFzLmhlaWdodCwgMCwgMCwgX2NhbnZhcy53aWR0aCAtIDEsIF9jYW52YXMuaGVpZ2h0ICk7XG4gICAgICAgICAgICBpZiggYWxhcm0gKSB7XG4gICAgICAgICAgICAgICAgX2N0eC5kcmF3SW1hZ2UoIF9hbGFybUNhbnZhcywgX2NhbnZhcy53aWR0aCAtIDEsIF9jYW52YXMuaGVpZ2h0IC0gX2N1cnJlbnQgKiBfY2FudmFzLmhlaWdodCAvIF9tYXggLSAxMCApO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBfY3R4LmRyYXdJbWFnZSggX2RvdENhbnZhcywgX2NhbnZhcy53aWR0aCAtIDEsIF9jYW52YXMuaGVpZ2h0IC0gX2N1cnJlbnQgKiBfY2FudmFzLmhlaWdodCAvIF9tYXggLSAxMCApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgX2luaXQoKTtcblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgZHJhdzogX2RyYXdcbiAgICAgICAgfVxuXG4gICAgfVxuXG4gICAgZnVuY3Rpb24gU3RhY2tHcmFwaCggX2RvbSwgX251bSApIHtcblxuICAgICAgICB2YXIgX2NhbnZhcyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICdjYW52YXMnICksXG4gICAgICAgICAgICBfY3R4ID0gX2NhbnZhcy5nZXRDb250ZXh0KCAnMmQnICksXG4gICAgICAgICAgICBfbWF4ID0gMCxcbiAgICAgICAgICAgIF9jdXJyZW50ID0gMDtcblxuICAgICAgICBmdW5jdGlvbiBfaW5pdCgpIHtcblxuICAgICAgICAgICAgX2NhbnZhcy53aWR0aCA9IDIwMDtcbiAgICAgICAgICAgIF9jYW52YXMuaGVpZ2h0ID0gMTAgKiBfbnVtO1xuICAgICAgICAgICAgX2NhbnZhcy5zdHlsZS53aWR0aCA9IF9jYW52YXMud2lkdGggKyAncHgnO1xuICAgICAgICAgICAgX2NhbnZhcy5zdHlsZS5oZWlnaHQgPSBfY2FudmFzLmhlaWdodCArICdweCc7XG4gICAgICAgICAgICBfY2FudmFzLnN0eWxlLnBvc2l0aW9uID0gJ2Fic29sdXRlJztcbiAgICAgICAgICAgIF9jYW52YXMuc3R5bGUucmlnaHQgPSAwO1xuICAgICAgICAgICAgX2RvbS5hcHBlbmRDaGlsZCggX2NhbnZhcyApO1xuXG4gICAgICAgICAgICBfY3R4LmZpbGxTdHlsZSA9ICcjNDQ0NDQ0JztcbiAgICAgICAgICAgIF9jdHguZmlsbFJlY3QoIDAsIDAsIF9jYW52YXMud2lkdGgsIF9jYW52YXMuaGVpZ2h0ICk7XG5cbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIF9kcmF3KCB2ICkge1xuICAgICAgICAgICAgX2N0eC5kcmF3SW1hZ2UoIF9jYW52YXMsIDEsIDAsIF9jYW52YXMud2lkdGggLSAxLCBfY2FudmFzLmhlaWdodCwgMCwgMCwgX2NhbnZhcy53aWR0aCAtIDEsIF9jYW52YXMuaGVpZ2h0ICk7XG4gICAgICAgICAgICB2YXIgdGggPSAwO1xuICAgICAgICAgICAgZm9yKCB2YXIgaiBpbiB2ICkge1xuICAgICAgICAgICAgICAgIHZhciBoID0gdlsgaiBdICogX2NhbnZhcy5oZWlnaHQ7XG4gICAgICAgICAgICAgICAgX2N0eC5maWxsU3R5bGUgPSBfY29sb3Vyc1sgaiBdO1xuICAgICAgICAgICAgICAgIF9jdHguZmlsbFJlY3QoIF9jYW52YXMud2lkdGggLSAxLCB0aCwgMSwgaCApO1xuICAgICAgICAgICAgICAgIHRoICs9IGg7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBfaW5pdCgpO1xuXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBkcmF3OiBfZHJhd1xuICAgICAgICB9XG5cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBQZXJmQ291bnRlciggaWQsIGdyb3VwICkge1xuXG4gICAgICAgIHZhciBfaWQgPSBpZCxcbiAgICAgICAgICAgIF90aW1lLFxuICAgICAgICAgICAgX3ZhbHVlID0gMCxcbiAgICAgICAgICAgIF90b3RhbCA9IDAsXG4gICAgICAgICAgICBfZG9tID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ2RpdicgKSxcbiAgICAgICAgICAgIF9zcGFuSWQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnc3BhbicgKSxcbiAgICAgICAgICAgIF9zcGFuVmFsdWUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnc3BhbicgKSxcbiAgICAgICAgICAgIF9ncmFwaCA9IG5ldyBHcmFwaCggX2RvbSwgX2lkICksXG4gICAgICAgICAgICBfZGVmID0gX3NldHRpbmdzP19zZXR0aW5ncy52YWx1ZXNbIF9pZC50b0xvd2VyQ2FzZSgpIF06bnVsbDtcblxuICAgICAgICBfZG9tLnN0eWxlLnBvc2l0aW9uID0gJ3JlbGF0aXZlJztcbiAgICAgICAgX2RvbS5zdHlsZS5tYXJnaW4gPSAnMnB4IDAnO1xuICAgICAgICBfZG9tLnN0eWxlLmhlaWdodCA9ICcxMHB4JztcblxuICAgICAgICBfc3BhbklkLnN0eWxlLnBvc2l0aW9uID0gJ2Fic29sdXRlJztcbiAgICAgICAgX3NwYW5JZC5zdHlsZS5sZWZ0ID0gMDtcbiAgICAgICAgX3NwYW5JZC5zdHlsZS50b3AgPSAwO1xuICAgICAgICBfc3BhbklkLnRleHRDb250ZW50ID0gKCBfZGVmICYmIF9kZWYuY2FwdGlvbiApP19kZWYuY2FwdGlvbjpfaWQ7XG5cbiAgICAgICAgX3NwYW5WYWx1ZS5zdHlsZS5wb3NpdGlvbiA9ICdhYnNvbHV0ZSc7XG4gICAgICAgIF9zcGFuVmFsdWUuc3R5bGUucmlnaHQgPSAnMjEwcHgnO1xuICAgICAgICBfc3BhblZhbHVlLnN0eWxlLnRvcCA9IDA7XG4gICAgICAgIF9zcGFuVmFsdWUuc3R5bGUudGV4dEFsaWduID0gJ3JpZ2h0JztcbiAgICAgICAgXG4gICAgICAgIF9kb20uYXBwZW5kQ2hpbGQoIF9zcGFuSWQgKTtcbiAgICAgICAgX2RvbS5hcHBlbmRDaGlsZCggX3NwYW5WYWx1ZSApO1xuICAgICAgICBpZiggZ3JvdXAgKSBncm91cC5kaXYuYXBwZW5kQ2hpbGQoIF9kb20gKTtcbiAgICAgICAgZWxzZSBfZGl2LmFwcGVuZENoaWxkKCBfZG9tICk7XG5cbiAgICAgICAgX3RpbWUgPSBwZXJmb3JtYW5jZS5ub3coKTtcblxuXG4gICAgICAgIGZ1bmN0aW9uIF9zdGFydCgpe1xuICAgICAgICAgICAgX3RpbWUgPSBwZXJmb3JtYW5jZS5ub3coKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIF9lbmQoKSB7XG4gICAgICAgICAgICBfdmFsdWUgPSBwZXJmb3JtYW5jZS5ub3coKSAtIF90aW1lO1xuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gX3RpY2soKSB7XG4gICAgICAgICAgICBfZW5kKCk7XG4gICAgICAgICAgICBfc3RhcnQoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIF9kcmF3KCkge1xuICAgICAgICAgICAgX3NwYW5WYWx1ZS50ZXh0Q29udGVudCA9IE1hdGgucm91bmQoIF92YWx1ZSAqIDEwMCApIC8gMTAwO1xuICAgICAgICAgICAgdmFyIGEgPSAoIF9kZWYgJiYgKCAoIF9kZWYuYmVsb3cgJiYgX3ZhbHVlIDwgX2RlZi5iZWxvdyApIHx8ICggX2RlZi5vdmVyICYmIF92YWx1ZSA+IF9kZWYub3ZlciApICkgKTtcbiAgICAgICAgICAgIF9ncmFwaC5kcmF3KCBfdmFsdWUsIGEgKTtcbiAgICAgICAgICAgIF9kb20uc3R5bGUuY29sb3IgPSBhPycjYjcwMDAwJzonI2ZmZmZmZic7XG4gICAgICAgIH1cblxuICAgICAgICBmdW5jdGlvbiBfZnJhbWUoKSB7XG4gICAgICAgICAgICB2YXIgdCA9IHBlcmZvcm1hbmNlLm5vdygpO1xuICAgICAgICAgICAgdmFyIGUgPSB0IC0gX3RpbWU7XG4gICAgICAgICAgICBfdG90YWwrKztcbiAgICAgICAgICAgIGlmKCBlID4gMTAwMCApIHtcbiAgICAgICAgICAgICAgICBfdmFsdWUgPSBfdG90YWwgKiAxMDAwIC8gZTtcbiAgICAgICAgICAgICAgICBfdG90YWwgPSAwO1xuICAgICAgICAgICAgICAgIF90aW1lID0gdDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGZ1bmN0aW9uIF9zZXQoIHYgKSB7XG4gICAgICAgICAgICBfdmFsdWUgPSB2O1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHNldDogX3NldCxcbiAgICAgICAgICAgIHN0YXJ0OiBfc3RhcnQsXG4gICAgICAgICAgICB0aWNrOiBfdGljayxcbiAgICAgICAgICAgIGVuZDogX2VuZCxcbiAgICAgICAgICAgIGZyYW1lOiBfZnJhbWUsXG4gICAgICAgICAgICB2YWx1ZTogZnVuY3Rpb24oKXsgcmV0dXJuIF92YWx1ZTsgfSxcbiAgICAgICAgICAgIGRyYXc6IF9kcmF3XG4gICAgICAgIH1cblxuICAgIH1cblxuICAgIGZ1bmN0aW9uIHNhbXBsZSgpIHtcblxuICAgICAgICB2YXIgX3ZhbHVlID0gMDtcblxuICAgICAgICBmdW5jdGlvbiBfc2V0KCB2ICkge1xuICAgICAgICAgICAgX3ZhbHVlID0gdjtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBzZXQ6IF9zZXQsXG4gICAgICAgICAgICB2YWx1ZTogZnVuY3Rpb24oKXsgcmV0dXJuIF92YWx1ZTsgfVxuICAgICAgICB9XG5cbiAgICB9XG5cbiAgICB2YXIgX2RpdjtcblxuICAgIHZhciBfcGVyZkNvdW50ZXJzID0ge30sXG4gICAgICAgIF9zYW1wbGVzID0ge307XG5cbiAgICBmdW5jdGlvbiBfcGVyZiggaWQgKSB7XG5cbiAgICAgICAgaWQgPSBpZC50b0xvd2VyQ2FzZSgpO1xuICAgICAgICBpZiggaWQgPT09IHVuZGVmaW5lZCApIGlkID0gJ2RlZmF1bHQnO1xuICAgICAgICBpZiggX3BlcmZDb3VudGVyc1sgaWQgXSApIHJldHVybiBfcGVyZkNvdW50ZXJzWyBpZCBdO1xuXG4gICAgICAgIHZhciBncm91cCA9IG51bGw7XG4gICAgICAgIGlmKCBfc2V0dGluZ3MgJiYgX3NldHRpbmdzLmdyb3VwcyApIHtcbiAgICAgICAgICAgIGZvciggdmFyIGogaW4gX3NldHRpbmdzLmdyb3VwcyApIHtcbiAgICAgICAgICAgICAgICB2YXIgZyA9IF9zZXR0aW5ncy5ncm91cHNbIHBhcnNlSW50KCBqLCAxMCApIF07XG4gICAgICAgICAgICAgICAgaWYoIGcudmFsdWVzLmluZGV4T2YoIGlkLnRvTG93ZXJDYXNlKCkgKSAhPSAtMSApIHtcbiAgICAgICAgICAgICAgICAgICAgZ3JvdXAgPSBnO1xuICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgcCA9IG5ldyBQZXJmQ291bnRlciggaWQsIGdyb3VwICk7XG4gICAgICAgIF9wZXJmQ291bnRlcnNbIGlkIF0gPSBwO1xuICAgICAgICByZXR1cm4gcDtcblxuICAgIH1cblxuICAgIGZ1bmN0aW9uIF9pbml0KCkge1xuXG4gICAgICAgIGlmKCBfc2V0dGluZ3MucGx1Z2lucyApIHtcbiAgICAgICAgICAgIGlmKCAhX3NldHRpbmdzLnZhbHVlcyApIF9zZXR0aW5ncy52YWx1ZXMgPSB7fTtcbiAgICAgICAgICAgIGlmKCAhX3NldHRpbmdzLmdyb3VwcyApIF9zZXR0aW5ncy5ncm91cHMgPSBbXTtcbiAgICAgICAgICAgIGlmKCAhX3NldHRpbmdzLmZyYWN0aW9ucyApIF9zZXR0aW5ncy5mcmFjdGlvbnMgPSBbXTtcbiAgICAgICAgICAgIGZvciggdmFyIGogPSAwOyBqIDwgX3NldHRpbmdzLnBsdWdpbnMubGVuZ3RoOyBqKysgKSB7XG4gICAgICAgICAgICAgICAgX3NldHRpbmdzLnBsdWdpbnNbIGogXS5hdHRhY2goIF9wZXJmICk7XG4gICAgICAgICAgICAgICAgZm9yKCB2YXIgayBpbiBfc2V0dGluZ3MucGx1Z2luc1sgaiBdLnZhbHVlcyApIHtcbiAgICAgICAgICAgICAgICAgICAgX3NldHRpbmdzLnZhbHVlc1sgayBdID0gX3NldHRpbmdzLnBsdWdpbnNbIGogXS52YWx1ZXMgWyBrIF07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIF9zZXR0aW5ncy5ncm91cHMgPSBfc2V0dGluZ3MuZ3JvdXBzLmNvbmNhdCggX3NldHRpbmdzLnBsdWdpbnNbIGogXS5ncm91cHMgKTtcbiAgICAgICAgICAgICAgICBfc2V0dGluZ3MuZnJhY3Rpb25zID0gX3NldHRpbmdzLmZyYWN0aW9ucy5jb25jYXQoIF9zZXR0aW5ncy5wbHVnaW5zWyBqIF0uZnJhY3Rpb25zICk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBfc2V0dGluZ3MucGx1Z2lucyA9IHt9O1xuICAgICAgICB9XG5cbiAgICAgICAgX2RpdiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICdkaXYnICk7XG4gICAgICAgIF9kaXYuc3R5bGUucG9zaXRpb24gPSAnYWJzb2x1dGUnO1xuICAgICAgICBfZGl2LnN0eWxlLnpJbmRleCA9IDEwMDAwO1xuICAgICAgICBfZGl2LnN0eWxlLnBhZGRpbmcgPSAnMTBweCc7XG4gICAgICAgIF9kaXYuc3R5bGUuYmFja2dyb3VuZENvbG9yID0gJyMyMjInO1xuICAgICAgICBfZGl2LnN0eWxlLmZvbnRTaXplID0gJzEwcHgnO1xuICAgICAgICBfZGl2LnN0eWxlLmxpbmVIZWlnaHQgPSAnMS4yZW0nO1xuICAgICAgICBfZGl2LnN0eWxlLndpZHRoID0gJzM1MHB4JztcbiAgICAgICAgX2Rpdi5zdHlsZS5mb250RmFtaWx5ID0gJ1JvYm90byBDb25kZW5zZWQsIHRhaG9tYSwgc2Fucy1zZXJpZic7XG4gICAgICAgIF9kaXYuc3R5bGUubGVmdCA9IF9kaXYuc3R5bGUudG9wID0gMDtcbiAgICAgICAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZCggX2RpdiApO1xuXG4gICAgICAgIGlmKCAhX3NldHRpbmdzICkgcmV0dXJuO1xuXG4gICAgICAgIGlmKCBfc2V0dGluZ3MuZ3JvdXBzICkge1xuICAgICAgICAgICAgZm9yKCB2YXIgaiBpbiBfc2V0dGluZ3MuZ3JvdXBzICkge1xuICAgICAgICAgICAgICAgIHZhciBnID0gX3NldHRpbmdzLmdyb3Vwc1sgcGFyc2VJbnQoIGosIDEwICkgXTtcbiAgICAgICAgICAgICAgICB2YXIgZGl2ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCggJ2RpdicgKTtcbiAgICAgICAgICAgICAgICBnLmRpdiA9IGRpdjtcbiAgICAgICAgICAgICAgICB2YXIgaDEgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAnaDEnICk7XG4gICAgICAgICAgICAgICAgaDEudGV4dENvbnRlbnQgPSBnLmNhcHRpb247XG4gICAgICAgICAgICAgICAgaDEuc3R5bGUubWFyZ2luID0gaDEuc3R5bGUucGFkZGluZyA9IDA7XG4gICAgICAgICAgICAgICAgaDEuc3R5bGUubWFyZ2luQm90dG9tID0gJzVweCc7XG4gICAgICAgICAgICAgICAgZGl2LnN0eWxlLm1hcmdpbkJvdHRvbSA9ICcxMHB4JztcbiAgICAgICAgICAgICAgICBoMS5zdHlsZS5mb250U2l6ZSA9ICcxNHB4JztcbiAgICAgICAgICAgICAgICBoMS5zdHlsZS5jb2xvciA9ICcjZmZmJ1xuICAgICAgICAgICAgICAgIF9kaXYuYXBwZW5kQ2hpbGQoIGgxICk7XG4gICAgICAgICAgICAgICAgX2Rpdi5hcHBlbmRDaGlsZCggZGl2ICk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiggX3NldHRpbmdzLmZyYWN0aW9ucyApIHtcbiAgICAgICAgICAgIGZvciggdmFyIGogaW4gX3NldHRpbmdzLmZyYWN0aW9ucyApIHtcbiAgICAgICAgICAgICAgICB2YXIgZiA9IF9zZXR0aW5ncy5mcmFjdGlvbnNbIHBhcnNlSW50KCBqLCAxMCApIF07XG4gICAgICAgICAgICAgICAgdmFyIGRpdiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICdkaXYnICk7XG4gICAgICAgICAgICAgICAgdmFyIGxlZ2VuZCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoICdkaXYnICk7XG4gICAgICAgICAgICAgICAgbGVnZW5kLnN0eWxlLnBvc2l0aW9uID0gJ2Fic29sdXRlJztcbiAgICAgICAgICAgICAgICBsZWdlbmQuc3R5bGUubGluZUhlaWdodCA9ICcxMHB4JztcblxuICAgICAgICAgICAgICAgIHZhciBoID0gMDtcbiAgICAgICAgICAgICAgICBmb3IoIHZhciBrIGluIF9zZXR0aW5ncy5mcmFjdGlvbnNbIGogXS5zdGVwcyApIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHAgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCAncCcgKTtcbiAgICAgICAgICAgICAgICAgICAgcC50ZXh0Q29udGVudCA9IF9zZXR0aW5ncy5mcmFjdGlvbnNbIGogXS5zdGVwc1sgayBdO1xuICAgICAgICAgICAgICAgICAgICBwLnN0eWxlLmNvbG9yID0gX2NvbG91cnNbIGggXTtcbiAgICAgICAgICAgICAgICAgICAgcC5zdHlsZS53aWR0aCA9ICcxMjBweCc7XG4gICAgICAgICAgICAgICAgICAgIHAuc3R5bGUudGV4dEFsaWduID0gJ3JpZ2h0JztcbiAgICAgICAgICAgICAgICAgICAgcC5zdHlsZS5tYXJnaW4gPSAwO1xuICAgICAgICAgICAgICAgICAgICBwLnN0eWxlLnBhZGRpbmcgPSAwO1xuICAgICAgICAgICAgICAgICAgICBsZWdlbmQuYXBwZW5kQ2hpbGQoIHAgKTtcbiAgICAgICAgICAgICAgICAgICAgaCsrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBkaXYuYXBwZW5kQ2hpbGQoIGxlZ2VuZCApO1xuICAgICAgICAgICAgICAgIGRpdi5zdHlsZS5oZWlnaHQgPSBoICogMTAgKyAncHgnO1xuICAgICAgICAgICAgICAgIGRpdi5zdHlsZS5wb3NpdGlvbiA9ICdyZWxhdGl2ZSc7XG4gICAgICAgICAgICAgICAgZGl2LnN0eWxlLm1hcmdpbkJvdHRvbSA9ICc1cHgnO1xuICAgICAgICAgICAgICAgIGYuZGl2ID0gZGl2O1xuICAgICAgICAgICAgICAgIHZhciBncmFwaCA9IG5ldyBTdGFja0dyYXBoKCBkaXYsIGggKTtcbiAgICAgICAgICAgICAgICBmLmdyYXBoID0gZ3JhcGg7XG4gICAgICAgICAgICAgICAgX2Rpdi5hcHBlbmRDaGlsZCggZGl2ICk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgIH1cblxuICAgIGZ1bmN0aW9uIF91cGRhdGUoKSB7XG4gICAgICAgIFxuICAgICAgICBmb3IoIHZhciBqIGluIF9zZXR0aW5ncy5wbHVnaW5zICkge1xuICAgICAgICAgICAgX3NldHRpbmdzLnBsdWdpbnNbIGogXS51cGRhdGUoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZvciggdmFyIGogaW4gX3BlcmZDb3VudGVycyApIHtcbiAgICAgICAgICAgIF9wZXJmQ291bnRlcnNbIGogXS5kcmF3KCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiggX3NldHRpbmdzICYmIF9zZXR0aW5ncy5mcmFjdGlvbnMgKSB7XG4gICAgICAgICAgICBmb3IoIHZhciBqIGluIF9zZXR0aW5ncy5mcmFjdGlvbnMgKSB7XG4gICAgICAgICAgICAgICAgdmFyIGYgPSBfc2V0dGluZ3MuZnJhY3Rpb25zWyBwYXJzZUludCggaiwgMTAgKSBdO1xuICAgICAgICAgICAgICAgIHZhciB2ID0gW107XG4gICAgICAgICAgICAgICAgdmFyIGJhc2UgPSBfcGVyZkNvdW50ZXJzWyBmLmJhc2UudG9Mb3dlckNhc2UoKSBdO1xuICAgICAgICAgICAgICAgIGlmKCBiYXNlICkge1xuICAgICAgICAgICAgICAgICAgICBiYXNlID0gYmFzZS52YWx1ZSgpO1xuICAgICAgICAgICAgICAgICAgICBmb3IoIHZhciBrIGluIF9zZXR0aW5ncy5mcmFjdGlvbnNbIGogXS5zdGVwcyApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciBzID0gX3NldHRpbmdzLmZyYWN0aW9uc1sgaiBdLnN0ZXBzWyBwYXJzZUludCggaywgMTAgKSBdLnRvTG93ZXJDYXNlKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgdmFsID0gX3BlcmZDb3VudGVyc1sgcyBdO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYoIHZhbCApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2LnB1c2goIHZhbC52YWx1ZSgpIC8gYmFzZSApO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGYuZ3JhcGguZHJhdyggdiApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICB9XG5cbiAgICBfaW5pdCgpO1xuXG4gICAgcmV0dXJuIGZ1bmN0aW9uKCBpZCApIHtcbiAgICAgICAgaWYoIGlkICkgcmV0dXJuIF9wZXJmKCBpZCApO1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgdXBkYXRlOiBfdXBkYXRlXG4gICAgICAgIH1cbiAgICB9XG5cbn07Il19
