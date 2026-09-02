/* Oud & Oro - Recomendador de fragancias */

let productos = [];
let respuestas = {};
let pasoActual = 1;
const TOTAL_PASOS = 4;
let listaActual = [];

function normalizar(texto) {
    return texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function formatearPrecio(numero) {
    return '$' + numero.toLocaleString('es-AR') + ' ARS';
}

/* ===== Navegación del quiz ===== */
const quiz = document.getElementById('quiz');
const pasos = Array.from(document.querySelectorAll('.quiz-paso'));
const progress = document.getElementById('quiz-progress');
const btnAtras = document.getElementById('quiz-atras');
const btnReiniciar = document.getElementById('quiz-reiniciar');
const btnNuevoReiniciar = document.getElementById('reco-reiniciar');

function actualizarPaso() {
    pasos.forEach((p, i) => {
        p.hidden = (i + 1) !== pasoActual;
    });
    progress.textContent = `Pregunta ${pasoActual} de ${TOTAL_PASOS}`;
    btnAtras.hidden = pasoActual === 1;
    btnReiniciar.hidden = true;
    window.scrollTo({ top: quiz.offsetTop - 80, behavior: 'smooth' });
}

quiz.addEventListener('click', (e) => {
    const opt = e.target.closest('.quiz-option');
    if (!opt) return;
    const field = opt.getAttribute('data-field');
    const value = opt.getAttribute('data-value');
    respuestas[field] = value;

    if (pasoActual < TOTAL_PASOS) {
        pasoActual++;
        actualizarPaso();
    } else {
        mostrarResultados();
    }
});

btnAtras.addEventListener('click', () => {
    if (pasoActual > 1) {
        pasoActual--;
        actualizarPaso();
    }
});

btnReiniciar.addEventListener('click', reiniciarQuiz);
btnNuevoReiniciar.addEventListener('click', reiniciarQuiz);

function reiniciarQuiz() {
    respuestas = {};
    pasoActual = 1;
    actualizarPaso();
    document.getElementById('quiz').hidden = false;
    document.getElementById('reco-resultados').hidden = true;
}

/* ===== Lógica de recomendación ===== */
function calcularPuntaje(p) {
    const nota = normalizar(p.notas + ' ' + p.nombre + ' ' + p.inspirado);
    const marca = normalizar(p.marca);
    let score = 0;

    const aroma = respuestas.aroma;
    if (aroma === 'dulce') {
        ['vainilla', 'caramelo', 'ambar', 'praline', 'datiles', 'tonka', 'azucar'].forEach(k => {
            if (nota.includes(k)) score += 3;
        });
    } else if (aroma === 'amaderado') {
        ['oud', 'sandalo', 'azafran', 'cedro', 'madera', 'cuero', 'pachuli', 'ambar'].forEach(k => {
            if (nota.includes(k)) score += 3;
        });
    } else if (aroma === 'fresco') {
        ['bergamota', 'limon', 'citrico', 'menta', 'acuatico', 'marinas', 'mandarina', 'toronja'].forEach(k => {
            if (nota.includes(k)) score += 3;
        });
    } else if (aroma === 'floral') {
        ['rosa', 'jazmin', 'orquidea', 'floral', 'geranio', 'violeta', 'nenufar'].forEach(k => {
            if (nota.includes(k)) score += 3;
        });
    }

    const ocasion = respuestas.ocasion;
    if (ocasion === 'noche') {
        ['ambar', 'oud', 'cuero', 'tabaco', 'vainilla', 'especias'].forEach(k => { if (nota.includes(k)) score += 2; });
    } else if (ocasion === 'dia') {
        ['citrico', 'lavanda', 'frescos', 'acuatico'].forEach(k => { if (nota.includes(k)) score += 2; });
    } else if (ocasion === 'invierno') {
        ['ambar', 'vainilla', 'especias', 'canela', 'tabaco', 'cuero'].forEach(k => { if (nota.includes(k)) score += 2; });
    } else if (ocasion === 'verano') {
        ['citrico', 'coco', 'tropical', 'acuatico', 'marinas', 'menta'].forEach(k => { if (nota.includes(k)) score += 2; });
    }

    const intensidad = respuestas.intensidad;
    if (intensidad === 'fuerte') {
        ['extrait', 'elixir', 'intense', 'absolu', 'extrait de parfum'].forEach(k => { if (nota.includes(k)) score += 2; });
    } else if (intensidad === 'suave') {
        ['eau', 'cologne', 'suave'].forEach(k => { if (nota.includes(k)) score += 2; });
    }

    const estilo = respuestas.estilo;
    if (estilo === 'unica') {
        ['original', 'extrait'].forEach(k => { if (nota.includes(k)) score += 1; });
    }

    return score;
}

function mostrarResultados() {
    const conScore = productos.map(p => ({ p, score: calcularPuntaje(p) }));
    conScore.sort((a, b) => b.score - a.score);

    const mejores = conScore.filter(x => x.score > 0).slice(0, 4);
    const usados = mejores.length ? mejores.map(m => m.p) : [];
    if (usados.length < 4) {
        const faltan = 4 - usados.length;
        const yaUsados = new Set(usados);
        const extra = conScore.filter(x => !yaUsados.has(x.p)).slice(0, faltan).map(m => m.p);
        usados.push(...extra);
    }

    listaActual = usados;
    document.getElementById('quiz').hidden = true;
    const resultados = document.getElementById('reco-resultados');
    resultados.hidden = false;

    const grid = document.getElementById('reco-grid');
    grid.innerHTML = usados.map((p, i) => `
        <div class="product-card card-reveal" data-index="${i}" role="button" tabindex="0" aria-label="Ver ${p.marca} ${p.nombre}" style="transition-delay: ${Math.min(i * 0.06, 0.3)}s">
            <div class="img-container">
                <img src="${p.imagen}" alt="${p.marca} ${p.nombre}" loading="lazy">
            </div>
            <div>
                <div class="product-house">${p.marca}</div>
                <h3 class="product-title">${p.nombre}</h3>
                <p class="product-notes">${p.notas}</p>
                <div class="product-price">${formatearPrecio(p.precio)} <span style="font-size: 0.75em; color: var(--text-dim); font-weight: 500;">(${p.formato} ${p.tamano})</span></div>
            </div>
            <div class="product-select">Elegir formato</div>
        </div>
    `).join('');
    requestAnimationFrame(() => {
        grid.querySelectorAll('.card-reveal:not(.is-visible)').forEach(el => el.classList.add('is-visible'));
    });

    document.getElementById('reco-resultado-nota').textContent =
        `Según tus preferencias (${respuestas.aroma}, ${respuestas.ocasion}, ${respuestas.intensidad}), estas son las fragancias que mejor se adaptan a vos. ${obtenerSugerencia()}`;
    window.scrollTo({ top: resultados.offsetTop - 60, behavior: 'smooth' });
}

function obtenerSugerencia() {
    if (respuestas.aroma === 'dulce') return 'Si amás el dulce, probalas primero con un decant de 10ml.';
    if (respuestas.aroma === 'amaderado') return 'El oud y las maderas son ideales para dejar huella.';
    if (respuestas.aroma === 'fresco') return 'Las notas cítricas son perfectas para el día y el calor.';
    if (respuestas.aroma === 'floral') return 'Las florales son elegantes y versátiles.';
    return '';
}

document.getElementById('reco-grid').addEventListener('click', (e) => {
    const card = e.target.closest('.product-card');
    if (!card) return;
    abrirModal(parseInt(card.getAttribute('data-index'), 10));
});
document.getElementById('reco-grid').addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const card = e.target.closest('.product-card');
    if (!card) return;
    e.preventDefault();
    abrirModal(parseInt(card.getAttribute('data-index'), 10));
});

/* ===== Modal + carrito (compartido) ===== */
let formatoElegido = '10ml';

function calcularPrecios(p) {
    return {
        '5ml': Math.round(p.precio * 0.08 * 1.2 * 1.2),
        '10ml': Math.round(p.precio * 0.15 * 1.2),
        'botella': p.precio
    };
}

function abrirModal(indice) {
    const p = listaActual[indice];
    if (!p) return;
    const precios = calcularPrecios(p);
    formatoElegido = '10ml';

    document.getElementById('modal-contenido').innerHTML = `
        <div class="modal-img"><img src="${p.imagen}" alt="${p.marca} ${p.nombre}"></div>
        <div class="modal-house">${p.marca}</div>
        <h3 class="modal-title" id="modal-titulo">${p.nombre}</h3>
        <p class="modal-info"><strong>Inspirado en:</strong> ${p.inspirado}</p>
        <p class="modal-notas"><strong>Notas:</strong> ${p.notas}</p>
        <div class="modal-opciones">
            <div class="opcion-label">Elegí tu formato:</div>
            <div class="opcion-selector" data-formato="5ml"><span class="nombre">5ml · Decant</span><span class="precio">${formatearPrecio(precios['5ml'])}</span></div>
            <div class="opcion-selector seleccionado" data-formato="10ml"><span class="nombre">10ml · Decant</span><span class="precio">${formatearPrecio(precios['10ml'])}</span></div>
            <div class="opcion-selector" data-formato="botella"><span class="nombre">Botella completa (${p.tamano})</span><span class="precio">${formatearPrecio(precios['botella'])}</span></div>
        </div>
        <button class="cta-btn modal-wa" id="modal-wa-btn">Añadir al carrito</button>
    `;

    const overlay = document.getElementById('modal-producto');
    overlay.classList.add('abierto');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    overlay.querySelectorAll('.opcion-selector').forEach(op => {
        op.addEventListener('click', () => {
            overlay.querySelectorAll('.opcion-selector').forEach(o => o.classList.remove('seleccionado'));
            op.classList.add('seleccionado');
            formatoElegido = op.getAttribute('data-formato');
        });
    });
    document.getElementById('modal-wa-btn').addEventListener('click', () => {
        agregarAlCarrito(p, formatoElegido);
        cerrarModal();
    });
}

function agregarAlCarrito(p, formato) {
    const clave = formato;
    const precio = calcularPrecios(p)[clave];
    const formatoTexto = clave === 'botella'
        ? `Botella completa (${p.tamano})`
        : `${clave} Decant`;
    const mensaje = `Hola, me interesa esta fragancia:\n\n• ${p.marca} ${p.nombre} — ${formatoTexto} (${formatearPrecio(precio)})\n\n¿Me confirmás disponibilidad y el proceso de compra?`;
    window.open(`https://wa.me/${numeroWhatsApp}?text=${encodeURIComponent(mensaje)}`, '_blank');
}

function cerrarModal() {
    const overlay = document.getElementById('modal-producto');
    overlay.classList.remove('abierto');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
}
document.getElementById('modal-cerrar').addEventListener('click', cerrarModal);
document.getElementById('modal-producto').addEventListener('click', (e) => {
    if (e.target === document.getElementById('modal-producto')) cerrarModal();
});
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.getElementById('modal-producto').classList.contains('abierto')) {
        cerrarModal();
    }
});

/* ===== WhatsApp general ===== */
const botonGeneral = document.getElementById('general-wa');
const mensajeGeneral = "Hola, estaba viendo el recomendador de fragancias y me gustaría recibir asesoramiento sobre las fragancias árabes.";
botonGeneral.href = `https://wa.me/${numeroWhatsApp}?text=${encodeURIComponent(mensajeGeneral)}`;

const enlaceHeader = document.getElementById('header-wa');
if (enlaceHeader) enlaceHeader.href = botonGeneral.href;

/* ===== Scroll reveal ===== */
const observador = new IntersectionObserver((entradas) => {
    entradas.forEach(entrada => {
        if (entrada.isIntersecting) {
            entrada.target.classList.add('is-visible');
            observador.unobserve(entrada.target);
        }
    });
}, { threshold: 0.15 });
document.querySelectorAll('.scroll-reveal').forEach(el => observador.observe(el));

/* ===== Carga de datos ===== */
fetch('./data/productos.json')
    .then(r => {
        if (!r.ok) throw new Error('No se pudo cargar el catálogo (' + r.status + ')');
        return r.json();
    })
    .then(data => {
        productos = data;
        actualizarPaso();
    })
    .catch(err => {
        console.error(err);
    });
