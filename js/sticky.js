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
  window.addEventListener('resize', ajustar);
})();
