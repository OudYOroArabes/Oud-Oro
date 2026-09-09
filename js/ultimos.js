/* Oud & Oro - Página de últimos agregados */

const FAV_KEY = 'oudOroFavoritos';

function normalizar(texto) {
    return texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function idProducto(p) {
    return normalizar(p.marca) + '::' + normalizar(p.nombre);
}

function formatearPrecio(numero) {
    return '$' + numero.toLocaleString('es-AR') + ' ARS';
}

function obtenerFavoritos() {
    try {
        return JSON.parse(localStorage.getItem(FAV_KEY)) || [];
    } catch (e) {
        return [];
    }
}

function guardarFavoritos(lista) {
    localStorage.setItem(FAV_KEY, JSON.stringify(lista));
}

function favExiste(id) {
    return obtenerFavoritos().includes(id);
}

function calcularPrecios(p) {
    return {
        '5ml': Math.round(p.precio * 0.08 * 1.2 * 1.2),
        '10ml': Math.round(p.precio * 0.15 * 1.2),
        'botella': p.precio
    };
}

let listaActual = [];
let formatoElegido = '10ml';
let visibles = 0;
const LOTE = 12;

const grid = document.getElementById('ult-grid');
const botonVerMas = document.getElementById('ult-ver-mas');

function marcarCorazones() {
    const favs = obtenerFavoritos();
    grid.querySelectorAll('.fav-corazon').forEach(el => {
        el.classList.toggle('activo', favs.includes(el.getAttribute('data-id')));
    });
}

function cardHTML(p, i, conDelay) {
    const el = document.createElement('div');
    el.className = 'product-card card-reveal';
    el.dataset.index = i;
    el.setAttribute('role', 'button');
    el.setAttribute('tabindex', '0');
    el.setAttribute('aria-label', `Ver ${p.marca} ${p.nombre}`);
    if (conDelay) el.style.transitionDelay = `${Math.min(i * 0.05, 0.15)}s`;
    const cargarInmediato = conDelay && i < 4;
    el.innerHTML = `
        <span class="fav-corazon" data-id="${idProducto(p)}" role="button" tabindex="0" aria-label="Guardar ${p.nombre} en favoritos">♥</span>
        <div class="img-container">
            <img src="${p.imagen}" alt="${p.marca} ${p.nombre}" loading="${cargarInmediato ? 'eager' : 'lazy'}" decoding="async">
        </div>
        <div>
            <div class="product-house">${p.marca}</div>
            <h3 class="product-title">${p.nombre}</h3>
            <p class="product-notes">${formatearPrecio(p.precio)} · Botella completa ${p.tamano}</p>
            <div class="product-price">${formatearPrecio(p.precio)}</div>
        </div>
        <div class="product-select">Elegir formato</div>
    `;
    return el;
}

function anexar(lote, conDelay) {
    const fragmento = document.createDocumentFragment();
    for (let i = 0; i < lote.length; i++) {
        fragmento.appendChild(cardHTML(lote[i], visibles - lote.length + i, conDelay));
    }
    grid.appendChild(fragmento);
    marcarCorazones();

    const nuevas = grid.querySelectorAll('.card-reveal:not(.is-visible)');
    requestAnimationFrame(() => {
        nuevas.forEach(el => el.classList.add('is-visible'));
    });
}

function renderizar() {
    grid.innerHTML = '';
    visibles = Math.min(LOTE, listaActual.length);
    anexar(listaActual.slice(0, visibles), true);
    botonVerMas.hidden = visibles >= listaActual.length;
}

function cargarMas() {
    const desde = visibles;
    const hasta = Math.min(visibles + LOTE, listaActual.length);
    visibles = hasta;
    anexar(listaActual.slice(desde, hasta), false);

    const restantes = listaActual.length - visibles;
    if (restantes > 0) {
        botonVerMas.hidden = false;
        botonVerMas.textContent = `Ver más perfumes (${restantes})`;
    } else {
        botonVerMas.hidden = true;
    }
}

grid.addEventListener('click', (e) => {
    const corazon = e.target.closest('.fav-corazon');
    if (corazon) {
        e.stopPropagation();
        e.preventDefault();
        const id = corazon.getAttribute('data-id');
        let favs = obtenerFavoritos();
        if (favs.includes(id)) {
            favs = favs.filter(f => f !== id);
        } else {
            favs.push(id);
        }
        guardarFavoritos(favs);
        corazon.classList.toggle('activo');
        return;
    }
    const card = e.target.closest('.product-card');
    if (!card) return;
    abrirModal(parseInt(card.getAttribute('data-index'), 10));
});

grid.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const card = e.target.closest('.product-card');
    if (!card) return;
    e.preventDefault();
    abrirModal(parseInt(card.getAttribute('data-index'), 10));
});

botonVerMas.addEventListener('click', () => {
    if (!catalogoCompleto.length) {
        botonVerMas.disabled = true;
        botonVerMas.textContent = 'Cargando…';
        cargarCompleto().finally(() => {
            botonVerMas.disabled = false;
            botonVerMas.hidden = false;
        });
    } else {
        cargarMas();
    }
});

function abrirModal(indice) {
    const p = listaActual[indice];
    if (!p) return;
    const precios = calcularPrecios(p);
    formatoElegido = '10ml';

    document.getElementById('modal-contenido').innerHTML = `
        <div class="modal-img"><img src="${p.imagen}" alt="${p.marca} ${p.nombre}" decoding="async"></div>
        <div class="modal-house">${p.marca}</div>
        <h3 class="modal-title" id="modal-titulo">${p.nombre}</h3>
        <p class="modal-info"><strong>Inspirado en:</strong> ${p.inspirado}</p>
        <p class="modal-notas"><strong>Notas:</strong> ${p.notas}</p>
        <div class="modal-opciones">
            <div class="opcion-label">Elegí tu formato:</div>
            <div class="opcion-selector" data-formato="5ml">
                <span class="nombre">5ml · Decant</span>
                <span class="precio">${formatearPrecio(precios['5ml'])}</span>
            </div>
            <div class="opcion-selector seleccionado" data-formato="10ml">
                <span class="nombre">10ml · Decant</span>
                <span class="precio">${formatearPrecio(precios['10ml'])}</span>
            </div>
            <div class="opcion-selector" data-formato="botella">
                <span class="nombre">Botella completa (${p.tamano})</span>
                <span class="precio">${formatearPrecio(precios['botella'])}</span>
            </div>
        </div>
        <button class="cta-btn modal-wa" id="modal-wa-btn">Consultar por WhatsApp</button>
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
        const precio = precios[formatoElegido];
        const etiqueta = formatoElegido === 'botella' ? `Botella completa (${p.tamano})` : `${formatoElegido} Decant`;
        const msg = encodeURIComponent(`Hola! Me interesa el perfume ${p.marca} - ${p.nombre} en ${etiqueta} (${formatearPrecio(precio)}). ¿Tenés disponibilidad?`);
        window.open(`https://wa.me/${numeroWhatsApp}?text=${msg}`, '_blank');
        cerrarModal();
    });
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

const headerWa = document.getElementById('header-wa');
if (headerWa) {
    headerWa.href = `https://wa.me/${numeroWhatsApp}?text=${encodeURIComponent('Hola! Quería consultar por un perfume.')}`;
}

const generalWa = document.getElementById('general-wa');
if (generalWa) {
    generalWa.href = `https://wa.me/${numeroWhatsApp}?text=${encodeURIComponent('Hola! Quería consultar por un perfume.')}`;
}

let catalogoCompleto = [];
let cargandoCompleto = false;

function mensajeError() {
    grid.innerHTML = '<p class="empty-state">No pudimos cargar el catálogo. Probá de nuevo en unos segundos.</p>';
}

function cargarRecientes() {
    return fetch('./data/productos-recientes.json')
        .then(r => {
            if (!r.ok) throw new Error('No se pudo cargar los recientes (' + r.status + ')');
            return r.json();
        })
        .then(datos => {
            listaActual = datos;
            renderizar();
        });
}

function cargarCompleto() {
    if (catalogoCompleto.length || cargandoCompleto) return Promise.resolve();
    cargandoCompleto = true;
    return fetch('./data/productos.json')
        .then(r => {
            if (!r.ok) throw new Error('No se pudo cargar el catálogo (' + r.status + ')');
            return r.json();
        })
        .then(data => {
            catalogoCompleto = data.slice().reverse();
            const mismoInicio = listaActual.length > 0 &&
                catalogoCompleto.slice(0, listaActual.length).every((p, i) => idProducto(p) === idProducto(listaActual[i]));
            if (mismoInicio && listaActual.length >= LOTE) {
                listaActual = catalogoCompleto;
                cargarMas();
            } else {
                listaActual = catalogoCompleto;
                visibles = Math.min(LOTE, listaActual.length);
                renderizar();
            }
        })
        .catch(() => mensajeError())
        .finally(() => { cargandoCompleto = false; });
}

const observadorReveal = new IntersectionObserver((entradas) => {
    entradas.forEach(en => {
        if (en.isIntersecting) {
            en.target.classList.add('is-visible');
            observadorReveal.unobserve(en.target);
        }
    });
}, { threshold: 0.1 });

document.querySelectorAll('.scroll-reveal').forEach(el => observadorReveal.observe(el));

cargarRecientes().catch(() => cargarCompleto());