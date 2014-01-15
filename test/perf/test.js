function forTheWorker() {

  var id = 0;
  var mode = '';

  onmessage = function(ev) {
    if (ev.data.mode) mode = ev.data.mode;
    postUpdates();
  }

  function makeUpdate() {
    var msg = {
      type: 'boid update',
      id: ++id,
      x: Math.random(),
      y: Math.random(),
      radius: 8
    };
    return msg;
  }

  function makeNonFlatUpdate() {
    var msg = {
      type: 'boid update',
      id: ++id,
      pos: {
        x: Math.random(),
        y: Math.random(),
      },
      radius: 8
    };
    return msg;
  }

  function makeStringUpdate() {
    var msg = 'type:boid update'
      + ',id:' + (++id)
      + ',x:' + Math.random()
      + ',y:' + Math.random()
      + ',radius:' + 8;
    return msg;
  }

  function postUpdates() {
    var i, max = 400, msgs;
    if (mode === 'batched') {
      msgs = [];
      for(i = 0; i < max; i++) {
        msgs.push(makeUpdate());
      }
      postMessage({ type: 'boid updates', updates: msgs });
    }

    if (mode === 'batched non-flat') {
      msgs = [];
      for(i = 0; i < max; i++) {
        msgs.push(makeNonFlatUpdate());
      }
      postMessage({ type: 'non-flat boid updates', updates: msgs });
    }

    if (mode === 'batched string') {
      msgs = [];
      for(i = 0; i < max; i++) {
        msgs.push(makeStringUpdate());
      }
      postMessage({ type: 'boid updates', updates: msgs });
    }

    if (mode === 'batched string no structure') {
      msgs = []
      for(i = 0; i < max; i++) {
        msgs.push(makeStringUpdate());
      }
      postMessage(msgs.join('+'));
    }

    if (mode === 'singles') {
      for(i = 0; i < max; i++) {
        postMessage(makeUpdate());
      }
    }

    if (mode === 'singles string') {
      for(i = 0; i < max; i++) {
        postMessage(makeStringUpdate());
      }
    }

    postMessage('updateend');
  }
}

var jssrc = '(' + forTheWorker.toString() + '())';
var jsblob = new Blob([jssrc], { type: 'text/javascript' });
var jsURL = window.URL.createObjectURL(jsblob);

var w = new Worker(jsURL);

function tick(mode) {
  w.postMessage({ mode: mode });
}

var currentDeferred = null;
function useDeferred(deferred) {
  currentDeferred = deferred;
}

w.onmessage = function(ev) {
  if (currentDeferred && ev.data === 'updateend') {
    currentDeferred.resolve(ev.data);
    return;
  }

  // For local testing when currentDeferred is not defined
  if (ev.data === 'updateend') return;

  var parsed;

  // Single string encoded
  //if (typeof ev.data === 'string') {
  //  parsed = parseString(ev.data);
  //  //console.log('parsed', parsed);
  //  return;
  //}

  // Multiple encoded strings
  if (ev.data.updates && typeof ev.data.updates[0] === 'string') {
    for (var i = 0; i < ev.data.updates.length; i++) {
      parsed = parseString(ev.data.updates[i]);
      //console.log('parsed', parsed);
    }
    return;
  }

  // Single string with multiple encoded updates
  if (typeof ev.data === 'string') {
    parsed = parseMultipleString(ev.data);
    //console.log('parsed', parsed);
    return;
  }

  console.log('data', ev.data);
}

function parseString(str) {
  var parts = str.split(',');
  var obj = {};
  var part;
  for(var i = 0; i < parts.length; i++) {
    part = parts[i].split(':');
    obj[part[0]] = part[1];
  }
  return obj;
}

function parseMultipleString(str) {
  var parts = str.split('+');
  var i = 0, all = [];
  while(i < parts.length) {
    all.push(parseString(parts[i]));
    i++;
  }
  return all;
}