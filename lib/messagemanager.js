
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
  this._unreceived = [];
}

MessageManager.prototype._queue = function(msg) {
  this._buffer.push(msg);
}

MessageManager.prototype.length = function(msg) {
  return this._buffer.length;
}

MessageManager.prototype._write = function() {
  throw new Error('NotImplemented');
}

MessageManager.prototype.write = function(msg) {
  this._write(msg);
}

MessageManager.prototype.read = function(cb) {
  var msg, ret, total = 0;

  while(msg = this._buffer.shift()) {
    ret = cb(msg);
    if (ret !== true) {
      this._unreceived.push(msg);
    } else {
      total += 1;
    }
  }

  // Swap the arrays to prevent allocations.
  var oldBuffer = this._buffer;
  this._buffer = this._unreceived;
  this._unreceived = oldBuffer;

  return total;
}