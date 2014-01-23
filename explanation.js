/*































Pulling energy out of a pocket universe...
In JS.

























We're talking about games.







































  ad8888ba,     ,a8888a,     88888888888  88888888ba    ad88888ba
 8P'    "Y8   ,8P"'  `"Y8,   88           88      "8b  d8"     "8b
d8           ,8P        Y8,  88           88      ,8P  Y8,
88,dd888bb,  88          88  88aaaaa      88aaaaaa8P'  `Y8aaaaa,
88P'    `8b  88          88  88"""""      88""""""'      `"""""8b,
88       d8  `8b        d8'  88           88                   `8b
88a     a8P   `8ba,  ,ad8'   88           88           Y8a     a8P
 "Y88888P"      "Y8888P"     88           88            "Y88888P"































This means 16ms per frame!



    88    ad8888ba,
  ,d88   8P'    "Y8
888888  d8
    88  88,dd888bb,  88,dPYba,,adPYba,   ,adPPYba,
    88  88P'    `8b  88P'   "88"    "8a  I8[    ""
    88  88       d8  88      88      88   `"Y8ba,
    88  88a     a8P  88      88      88  aa    ]8I
    88   "Y88888P"   88      88      88  `"YbbdP"'



















Games are on a tight schedule. They:

- are advanced one step at a time
- determine how much time has passed since the last step
- do stuff to make cool things happen on screen
- wait for the next step






























        Ideal GameLoop

        Hardware says GO!
 0 ms - ┬
      - │ Process Input (keyboard, mouse, gamepad, network)
      - ┴
      - ┬
      - │ Update Everything
      - │
      - │
      - │
      - │
      - │
      - ┴
      - ┬
      - │ Draw everything
      - │
      - │
16 ms - ┴
        Hardware says TIME'S UP, SCANLINES ARE LEAVING THE STATION!



P.S. The NES (released in the US in 1985) ran at 60fps.
P.P.S. Some games, like God of War, render in HD but at 30fps.















          Update (Detail)

      - ┬
      - │ Sync remote state with local
      - ┴
      - ┬
      - │ Apply inputs to game world
      - ┴
      - ┬
      - │ A.I. / Pathfinding
      - ┴
      - ┬
      - │ Pretty noises?
      - ┴
      - ┬
      - │ Physics (entity movement, constraints, particles, etc.)
      - ┴
      - ┬
      - │ Dispatch current state to server
      - ┴



















        What Actually Happens In A Browser

        requestAnimationFrame GO
 0 ms - ┬
      - │ BROWSER STUFF (Major GC Cycle, Network stuff, Add-Ons, and MORE!)
      - | Also process browser events, like postMessage, keypress, etc.
      - | Just sprinkle this stuff everywhere. It's delicious.
      - ┴
      - ┬
      - │ Process Input (keyboard, mouse, gamepad, network)
      - | Minor GC
      - ┴
      - ┬
      - │ Update
      - | Minor GC (Possibly Major if you're not careful in FF!)
      - |
      - |
      - │
      - │
16 ms - │
      - ┴
      - ┬
      - │ Draw everything
      - │ If you touch the DOM, get ready for layout!
      - │
      - ┴
      - ┬
      - │ MORE BROWSER STUFF
      - | Recalculate Style
      - | Layout (in)validation
      - | Compositing / Painting
      - ┴
      -
33 ms -





















I8,        8        ,8I  88                                         88     ad88  ad88888ba
`8b       d8b       d8'  88                         ,d              88    d8"   d8"     "8b
 "8,     ,8"8,     ,8"   88                         88              88    88    ""      a8P
  Y8     8P Y8     8P    88,dPPYba,   ,adPPYYba,  MM88MMM           88  MM88MMM      ,a8P"
  `8b   d8' `8b   d8'    88P'    "8a  ""     `Y8    88              88    88        d8"
   `8a a8'   `8a a8'     88       88  ,adPPPPP88    88              88    88        ""
    `8a8'     `8a8'      88       88  88,    ,88    88,             88    88        aa
     `8'       `8'       88       88  `"8bbdP"Y8    "Y888           88    88        88




Instead of:

BROWSER STUFF
Process Input
Update
Draw everything
Recalculate Style
Layout (in)validation
Painting


Do:

BROWSER STUFF                             Handle Inputs from last time
Dispatch Input                            Update the world (A.I, physics, etc.)
Draw everything                           Dispatch world changes
Recalculate Style
Layout (in)validation
Painting

















88        88    ,ad8888ba,   I8,        8        ,8I   ad88888ba
88        88   d8"'    `"8b  `8b       d8b       d8'  d8"     "8b
88        88  d8'        `8b  "8,     ,8"8,     ,8"   ""      a8P
88aaaaaaaa88  88          88   Y8     8P Y8     8P         ,a8P"
88""""""""88  88          88   `8b   d8' `8b   d8'        d8"
88        88  Y8,        ,8P    `8a a8'   `8a a8'         ""
88        88   Y8a.    .a8P      `8a8'     `8a8'          aa
88        88    `"Y8888Y"'        `8'       `8'           88





































An anomaly in the fabric of space time.
An unnatural occurance.

A ZPM (Zero Point Module)?

A parallel universe?

































































__          __  _      __          __        _
\ \        / / | |     \ \        / /       | |
 \ \  /\  / /__| |__    \ \  /\  / /__  _ __| | _____ _ __ ___
  \ \/  \/ / _ \ '_ \    \ \/  \/ / _ \| '__| |/ / _ \ '__/ __|
   \  /\  /  __/ |_) |    \  /\  / (_) | |  |   <  __/ |  \__ \
    \/  \/ \___|_.__/      \/  \/ \___/|_|  |_|\_\___|_|  |___/




*/
var worker = new Worker('path/to/some.js');
worker.onmessage = function(ev) { }
worker.addEventListener('message', function(ev) { })
/*

Inside a worker you have some standard stuff:

setTimeout
setInterval
new Date()
postMessage

BUT NO DOM. (That might change in the future with transferrable canvas.)































        Browser Thread                                                   Worker Thread

 0 ms - ┬                                                         0 ms - ┬
      - │ Process Browser/Message Queue                                - │ Process Message Queue
      - | Accept snapshots from worker                                 - | Accept input from main thread
      - ┴                                                              - ┴
      - ┬                                                              - ┬
      - │ Dispatch Input to Worker (keyboard, mouse, gamepad)          - │ Apply inputs to game world
      - ┴                                                              - | A.I.
      - ┬                                                              - | Physics
      - │ Draw the interpolated world between the newest snapshot      - │ Dispatch snapshot of world
      - │ and the _previous_ snapshop                                  - |
      - │                                                              - │
      - │                                                              - │
      - │                                                              - │
      - ┴                                                              - │
      - ┬                                                              - │
      - │ MORE BROWSER STUFF                                           - │
16 ms - ┴                                                        16 ms - │
                                                                       - │
                                                                       - │
                                                                       - |
                                                                       - │ BEHOLD
                                                                       - │ THE
                                                                       - │ WILD
                                                                       - │ EXPANSE
                                                                       - │ OF
                                                                       - │ A
                                                                       - │ PARALLEL
                                                                       - │ UNIVERSE!
                                                                       - │ SO MUCH TIME!
                                                                       - │
                                                                  33ms - ┴













A few key pieces:



































INDEPENDENT PHYSICS VS RENDERING
================================

If the time between updates is greater than 1 physics step
(usually because rendering took too long), then perform multiple
physics steps to advance the world to "where it should be".

Games do this all the time, and it looks like it's catching up.

Especially after explosions.

If our timestep is 33.3333ms:

Delta   Total     What Does the Engine Say?
 0ms  :  0ms      We just started. Seriously dude, chill.
15ms  :  15ms     not enough for physics update
17ms  :  33ms     not enough for physics update
33ms  :  66.66ms  2 physics ticks instead of one!

Example 2: Background tabs via rAF


































Entity System (e.g a system to manage "things")
===============================================

To make a new thing, you use a string / numeric id:
*/

// Instead of:
var boid = new Boid(x, y, radius);


// Do this once...
var boidman = new BoidManager;


// And then make a new boid:
var x = 10;
var y = 10;
var radius = 2;
var boid = boidman.getinate(null, [x, y, radius]);
console.log(boid.id);
// => "boid_1"


// And then somewhere else in your code...
var boid = boidman.getinate("boid_1");
console.log(boid.x);
// => 10

/*
Summary: A way to grab an existing instance of an object, quickly.

























Snapshot?
=========

A simple way to represent the current state of an entity (Boid, in these examples).

An entity is "snapshottable" if it has two methods:
*/





























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

/*




























I AM TWO PEOPLE
===============

We end up with two copies of the world, one for each thread.

You write an entity so it looks like this:
*/


function Drew() {
  this.lastName = 'Petersen';
  this.age = 27.5;
  this.id = null; // This would be assigned by the manager.
}


// These will only ever be called from the main thread or "world".
Drew.prototype.readFromSnapshot = function(data) {
  this.lastName = data.lastName;
  this.age = data.age;
  this.id = this.id || data.id;
}

Drew.prototype.draw = function(ctx, ratio) {}


// These will only ever be called from the worker thread, or "parallel universe".
Drew.prototype.writeToSnapshot = function(data) {
  data.lastName = this.lastName;
  data.age = this.age;
  data.id = this.id;
  return data;
}

Drew.prototype.update = function() {
  this.age += 0.001;
}
























/*

The Worker Emits One Set of Snapshots every 30ms
================================================

*/

var startTime = Date.now();

// ... bunch of world update code, physics, etc...

var snapshots = [];
for (i = 0; i < boids.length; i++) {
  // We pass in an empty object. As a future optimization, these objects
  // could be Object.create(null) or object pooled.
  snapshots.push(boids[i].writeToSnapshot({}));
}

var endTime = Date.now();

// This is a standard web worker API.
postMessage({
  type: 'step',
  snapshots: snapshots,
  startTime: startTime,
  endTime: endTime
});


























/*

And the Main Thread Just Listens
================================

*/


worker.addEventListener('message', function(ev) {

  // A full step contains snapshots.
  if (ev.data.type === 'step') {
    for (var i = 0; i < ev.data.snapshots.length; i++) {
      var snapshot = ev.data.snapshots[i];
      var boid = boidman.getinate(snapshot.id);
      boid.readFromSnapshot(snapshot);
    }

    lastSnapshotReceivedAt = performance.now();
    return;
  }

});



































/*


Wait a minute....


































The worker only emits a snapshot every...



 ad888888b,   ad888888b,        ad888888b,   ad888888b,   ad888888b,
d8"     "88  d8"     "88       d8"     "88  d8"     "88  d8"     "88
        a8P          a8P               a8P          a8P          a8P
     aad8"        aad8"             aad8"        aad8"        aad8"   88,dPYba,,adPYba,   ,adPPYba,
     ""Y8,        ""Y8,             ""Y8,        ""Y8,        ""Y8,   88P'   "88"    "8a  I8[    ""
        "8b          "8b               "8b          "8b          "8b  88      88      88   `"Y8ba,
Y8,     a88  Y8,     a88  888  Y8,     a88  Y8,     a88  Y8,     a88  88      88      88  aa    ]8I
 "Y888888P'   "Y888888P'  888   "Y888888P'   "Y888888P'   "Y888888P'  88      88      88  `"YbbdP"'








































But the main thread has to render every...



    88    ad8888ba,
  ,d88   8P'    "Y8
888888  d8
    88  88,dd888bb,  88,dPYba,,adPYba,   ,adPPYba,
    88  88P'    `8b  88P'   "88"    "8a  I8[    ""
    88  88       d8  88      88      88   `"Y8ba,
    88  88a     a8P  88      88      88  aa    ]8I
    88   "Y88888P"   88      88      88  `"YbbdP"'














































This makes no sense!
How can we render what is not there?
We'll just be drawing the same thing in the same place!
And it will be boring.

http://codepen.io/kirbysayshi/pen/iwxvk






















INTERPOLATION!
==============

In the main thread, we store:

- the newest snapshot
- the snapshot before that
- how much time has passed since the newest snapshot

When everything is drawn we do this:
*/

var ratio = (now - lastSnapshotReceivedAt) / 1000 / config.PHYSICS_HZ;

/*
This gives a ratio (%) of how many physics ticks have passed assuming the
next snapshot arrives on time.

                                                          Worker is here
Worker Time                                               | (0 + ratio*30ms)
-30ms                 -16ms                   0           |
--|---------------------|---------------------|-----------|---------
Snapshot A                                  Snapshot B


              Rendering is here
Main Thread   | (B time + ratio * 30ms)
Snapshot A    |                             Snapshot B
--|-----------|---------|---------------------|----------------------------



http://codepen.io/kirbysayshi/pen/tfDmk





















Single vs Multi
===============

*/

// Within the worker...

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



/*





























TO THE DEMOS
....

































Other Cool Stuff:

browserify
webworkify
rstats.js
beefy































Anecdote
=========

Don't do this:
*/

// worker.js
var lastTime = Date.now();
setInterval(function() {
  var now = Date.now();
  // Tell the main thread how much time has passed.
  postMessage({ type: 'tick', delta: now - lastTime });
  lastTime = now;
}, 10);


// main.js
worker.addEventListener('message', function(ev) {
  // Do something with ev.delta
})

/*

YOU WILL LOCK YOUR MAIN THREAD IN MOST BROWSERS.
























