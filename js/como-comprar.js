/* Oud & Oro - Página "Cómo Comprar" (FAQ accordion + WhatsApp) */

const botonGeneral = document.getElementById('general-wa');
const mensajeGeneral = "Hola, estaba viendo la página de cómo comprar y me gustaría recibir asesoramiento sobre las fragancias árabes.";
botonGeneral.href = `https://wa.me/${numeroWhatsApp}?text=${encodeURIComponent(mensajeGeneral)}`;

const botonComoComprar = document.getElementById('como-comprar-wa');
if (botonComoComprar) botonComoComprar.href = botonGeneral.href;

const enlaceHeader = document.getElementById('header-wa');
if (enlaceHeader) enlaceHeader.href = botonGeneral.href;

const observador = new IntersectionObserver((entradas) => {
    entradas.forEach(entrada => {
        if (entrada.isIntersecting) {
            entrada.target.classList.add('is-visible');
            observador.unobserve(entrada.target);
        }
    });
}, { threshold: 0.15 });
document.querySelectorAll('.scroll-reveal').forEach(el => observador.observe(el));
