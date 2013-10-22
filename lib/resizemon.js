
module.exports = function(cvs) {
  function resize(e) {
    cvs.width = document.body.clientWidth;
    cvs.height = document.body.clientHeight;
  }

  window.addEventListener('resize', resize, false);
  resize();

  return resize;
};