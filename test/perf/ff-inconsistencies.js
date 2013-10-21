function forTheWorker() {
  onmessage = function(ev) {
    postMessage('pong');
  }
}

var jssrc = '(' + forTheWorker.toString() + '())';
var jsblob = new Blob([jssrc], { type: 'text/javascript' });
var jsURL = window.URL.createObjectURL(jsblob);

var w = new Worker(jsURL);

function tick(mode) {
  w.postMessage('ping');
}

var currentDeferred = null;
function useDeferred(deferred) {
  currentDeferred = deferred;
}

w.onmessage = function(ev) {
  if (currentDeferred) currentDeferred.resolve();
}

