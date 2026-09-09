(function () {
  function ajustar() {
    var stick = document.querySelector('.site-sticky');
    if (!stick) return;
    var alto = stick.offsetHeight;
    document.body.style.paddingTop = alto + 'px';
    document.documentElement.style.scrollPaddingTop = alto + 'px';
  }
  document.addEventListener('DOMContentLoaded', ajustar);
  window.addEventListener('load', ajustar);
  
  var resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(ajustar, 150);
  }, { passive: true });
})();
