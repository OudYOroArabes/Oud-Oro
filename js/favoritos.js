/* Oud & Oro - Página de favoritos */

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

const grid = document.getElementById('fav-grid');
const vacio = document.getElementById('fav-vacio');

function renderizar() {
    const vacioEl = document.getElementById('fav-vacio');
    grid.innerHTML = '';

    if (listaActual.length === 0) {
        if (vacioEl) vacioEl.hidden = false;
        grid.innerHTML = '';
        return;
    }
    if (vacioEl) vacioEl.hidden = true;

    const html = listaActual.map((p, i) => `
        <div class="product-card card-reveal" data-index="${i}" role="button" tabindex="0" aria-label="Ver ${p.marca} ${p.nombre}" style="transition-delay: ${Math.min(i * 0.06, 0.3)}s">
            <span class="fav-corazon activo" data-id="${idProducto(p)}" role="button" tabindex="0" aria-label="Quitar ${p.nombre} de favoritos">♥</span>
            <div class="img-container">
                <img src="${p.imagen}" alt="${p.marca} ${p.nombre}" loading="lazy">
            </div>
            <div>
                <div class="product-house">${p.marca}</div>
                <h3 class="product-title">${p.nombre}</h3>
                <p class="product-notes">${formatearPrecio(p.precio)} · Botella completa ${p.tamano}</p>
                <div class="product-price">${formatearPrecio(p.precio)}</div>
            </div>
            <div class="product-select">Elegir formato</div>
        </div>
    `).join('');

    grid.innerHTML = html;
    requestAnimationFrame(() => {
        grid.querySelectorAll('.card-reveal:not(.is-visible)').forEach(el => el.classList.add('is-visible'));
    });
}

grid.addEventListener('click', (e) => {
    const corazon = e.target.closest('.fav-corazon');
    if (corazon) {
        e.stopPropagation();
        e.preventDefault();
        const id = corazon.getAttribute('data-id');
        let favs = obtenerFavoritos();
        favs = favs.filter(f => f !== id);
        guardarFavoritos(favs);
        listaActual = listaActual.filter(p => idProducto(p) !== id);
        renderizar();
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

fetch('./data/productos.json')
    .then(r => {
        if (!r.ok) throw new Error('No se pudo cargar el catálogo (' + r.status + ')');
        return r.json();
    })
    .then(data => {
        const favs = obtenerFavoritos();
        listaActual = data.filter(p => favs.includes(idProducto(p)));
        renderizar();
    })
    .catch(() => {
        grid.innerHTML = '<p class="empty-state">No pudimos cargar el catálogo. Probá de nuevo en unos segundos.</p>';
    });
