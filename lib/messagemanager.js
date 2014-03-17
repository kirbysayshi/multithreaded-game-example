
var _instance = null;
module.exports = function() {
  if (!_instance) {
    _instance = new MessageManager;
  }

  return _instance;
}

// This should probably just be a duplex stream.

function MessageManager() {
  var _self = this;
  this._buffer = [];
}

MessageManager.prototype._queue = function(msg) {
  this._buffer.push(msg);
}

MessageManager.prototype._write = function() {
  throw new Error('NotImplemented');
}

MessageManager.prototype.write = function(msg) {
  this._write(msg);
}

MessageManager.prototype.read = function(cb) {
  var msg, total = 0;
  while(msg = this._buffer.shift()) {
    cb(msg);
    total += 1;
  }

  return total;
}