/* Oud & Oro - Lógica principal (catálogo, filtros, carrito, modal, WhatsApp) */
const JSON_VERSION = 2;

let productos = [];
let marcasSeleccionadas = new Set();
let menuFiltrasAbierto = false;

function normalizar(texto) {
    return texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function formatearPrecio(numero) {
    return '$' + numero.toLocaleString('es-AR') + ' ARS';
}

function obtenerMarcas() {
    return [...new Set(productos.map(p => p.marca))].sort();
}

/* ===== Favoritos: corazon en las tarjetas + persistencia en localStorage ===== */
const FAV_KEY = 'oudOroFavoritos';

function idProducto(p) {
    return normalizar(p.marca) + '::' + normalizar(p.nombre);
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

function esFavorito(id) {
    return obtenerFavoritos().includes(id);
}

function toggleFavorito(id) {
    let favs = obtenerFavoritos();
    const i = favs.indexOf(id);
    if (i === -1) favs.push(id);
    else favs.splice(i, 1);
    guardarFavoritos(favs);
    return favs.includes(id);
}

function marcarCorazones() {
    const favs = obtenerFavoritos();
    document.querySelectorAll('.fav-corazon').forEach(el => {
        el.classList.toggle('activo', favs.includes(el.getAttribute('data-id')));
    });
}

function hacerClickFavorito(e) {
    const corazon = e.target.closest('.fav-corazon');
    if (!corazon) return;
    e.stopPropagation();
    e.preventDefault();
    const id = corazon.getAttribute('data-id');
    if (!id) return;
    const activo = toggleFavorito(id);
    corazon.classList.toggle('activo', activo);
}


function renderizarFiltros() {
    const cont = document.getElementById('filtros-marca');
    const boton = document.getElementById('btn-marcas');
    if (boton) boton.remove();
    const menu = document.getElementById('marcas-menu');
    if (menu) menu.remove();

    const btn = document.createElement('button');
    btn.className = 'filtro-chip';
    btn.id = 'btn-marcas';
    btn.setAttribute('aria-expanded', 'false');
    btn.innerHTML = '<span id="btn-marcas-label">Todas las marcas</span> <span class="flecha">▼</span>';
    cont.appendChild(btn);

    const favBtn = document.createElement('a');
    favBtn.className = 'filtro-chip fav-chip';
    favBtn.id = 'btn-favoritos';
    favBtn.href = 'favoritos.html';
    const nFav = obtenerFavoritos().length;
    favBtn.innerHTML = '<span class="fav-chip-icono">♥</span> Favoritos <span class="fav-chip-num" id="fav-chip-num">' + (nFav > 0 ? nFav : '') + '</span>';
    cont.appendChild(favBtn);

    const panel = document.createElement('div');
    panel.className = 'marcas-menu';
    panel.id = 'marcas-menu';

    let html = `<label><input class="marca-check" type="checkbox" data-marca="todas"> Todas las marcas</label>`;
    html += '<div class="marcas-sep"></div>';
    obtenerMarcas().forEach(marca => {
        html += `<label><input class="marca-check" type="checkbox" data-marca="${marca}"> ${marca}</label>`;
    });
    panel.innerHTML = html;
    document.body.appendChild(panel);

    btn.addEventListener('click', () => {
        menuFiltrasAbierto = !menuFiltrasAbierto;
        actualizarMenuMarcas();
    });

    panel.addEventListener('change', (e) => {
        const target = e.target;
        if (!target.classList.contains('marca-check')) return;
        const marca = target.getAttribute('data-marca');
        if (marca === 'todas') {
            if (target.checked) marcasSeleccionadas.clear();
        } else {
            if (target.checked) marcasSeleccionadas.add(marca);
            else marcasSeleccionadas.delete(marca);
        }
        aplicarFiltros();
    });
}

function actualizarMenuMarcas() {
    const btn = document.getElementById('btn-marcas');
    const panel = document.getElementById('marcas-menu');
    if (!btn || !panel) return;
    btn.classList.toggle('abierto', menuFiltrasAbierto);
    btn.setAttribute('aria-expanded', String(menuFiltrasAbierto));
    panel.classList.toggle('abierto', menuFiltrasAbierto);

    if (menuFiltrasAbierto) {
        const rect = btn.getBoundingClientRect();
        const panelW = panel.offsetWidth;
        let left = rect.left + rect.width / 2 - panelW / 2;
        let top = rect.bottom + 10;
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        if (left < 12) left = 12;
        if (left + panelW > vw - 12) left = vw - panelW - 12;
        if (top + panel.offsetHeight > vh - 12) top = rect.top - panel.offsetHeight - 10;
        panel.style.left = left + 'px';
        panel.style.top = top + 'px';
    }

    const checks = panel.querySelectorAll('input[type="checkbox"]');
    checks.forEach(c => {
        const m = c.getAttribute('data-marca');
        if (m === 'todas') c.checked = marcasSeleccionadas.size === 0;
        else c.checked = marcasSeleccionadas.has(m);
    });

    const label = document.getElementById('btn-marcas-label');
    if (marcasSeleccionadas.size === 0) label.textContent = 'Todas las marcas';
    else label.textContent = `Marcas (${marcasSeleccionadas.size})`;
}

document.addEventListener('click', (e) => {
    const cont = document.getElementById('filtros-marca');
    const panel = document.getElementById('marcas-menu');
    const dentro = (cont && cont.contains(e.target)) || (panel && panel.contains(e.target));
    if (!dentro && menuFiltrasAbierto) {
        menuFiltrasAbierto = false;
        actualizarMenuMarcas();
    }
});

window.addEventListener('scroll', () => {
    if (menuFiltrasAbierto) actualizarMenuMarcas();
}, { passive: true });
window.addEventListener('resize', () => {
    if (menuFiltrasAbierto) actualizarMenuMarcas();
});

let listaActual = [];
let visibles = 0;
const LOTE = 12;
const botonVerMas = document.getElementById('ver-mas-btn');

function renderizarProductos(lista) {
    const grid = document.getElementById('product-grid');
    listaActual = lista;
    visibles = 0;

    if (lista.length === 0) {
        grid.innerHTML = '<p class="empty-state">No encontramos fragancias con ese criterio. Probá con otra búsqueda o marca.</p>';
        botonVerMas.hidden = true;
        return;
    }

    grid.innerHTML = '';
    cargarMas();
}

function cargarMas() {
    const grid = document.getElementById('product-grid');
    if (!listaActual.length) return;

    const desde = visibles;
    const hasta = Math.min(visibles + LOTE, listaActual.length);
    visibles = hasta;

    const fragmento = listaActual.slice(desde, hasta).map((p, i) => `
        <div class="product-card card-reveal" data-index="${desde + i}" role="button" tabindex="0" aria-label="Ver ${p.marca} ${p.nombre}" style="transition-delay: ${Math.min(i * 0.06, 0.3)}s">
            <span class="fav-corazon" data-id="${idProducto(p)}" role="button" tabindex="0" aria-label="Guardar ${p.nombre} en favoritos">♥</span>
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

    const temp = document.createDocumentFragment();
    const wrapper = document.createElement('div');
    wrapper.innerHTML = fragmento;
    while (wrapper.firstChild) temp.appendChild(wrapper.firstChild);
    grid.appendChild(temp);

    const restantes = listaActual.length - visibles;
    if (restantes > 0) {
        botonVerMas.hidden = false;
        botonVerMas.textContent = `Ver más perfumes (${restantes})`;
    } else {
        botonVerMas.hidden = true;
    }

    const nuevas = grid.querySelectorAll('.card-reveal:not(.is-visible)');
    requestAnimationFrame(() => {
        nuevas.forEach(el => el.classList.add('is-visible'));
    });
    marcarCorazones();
}

botonVerMas.addEventListener('click', cargarMas);

function aplicarFiltros() {
    const texto = normalizar(document.getElementById('buscador').value.trim());

    const resultado = productos.filter(p => {
        const coincideMarca = marcasSeleccionadas.size === 0 || marcasSeleccionadas.has(p.marca);
        const coincideTexto = texto === '' || normalizar(`${p.marca} ${p.nombre} ${p.notas} ${p.inspirado}`).includes(texto);
        return coincideMarca && coincideTexto;
    });

    renderizarProductos(resultado);
}

document.getElementById('buscador').addEventListener('input', (() => {
    let timer;
    return () => {
        clearTimeout(timer);
        timer = setTimeout(aplicarFiltros, 150);
    };
})());

document.getElementById('product-grid').addEventListener('click', (e) => {
    const corazon = e.target.closest('.fav-corazon');
    if (corazon) {
        e.stopPropagation();
        const id = corazon.getAttribute('data-id');
        if (!id) return;
        const activo = toggleFavorito(id);
        corazon.classList.toggle('activo', activo);
        const num = document.getElementById('fav-chip-num');
        if (num) num.textContent = obtenerFavoritos().length > 0 ? obtenerFavoritos().length : '';
        return;
    }
    const card = e.target.closest('.product-card');
    if (!card) return;
    abrirModal(parseInt(card.getAttribute('data-index'), 10));
});

document.getElementById('filtros-marca').addEventListener('click', () => {
    const num = document.getElementById('fav-chip-num');
    if (num) num.textContent = obtenerFavoritos().length > 0 ? obtenerFavoritos().length : '';
});

document.getElementById('product-grid').addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const card = e.target.closest('.product-card');
    if (!card) return;
    e.preventDefault();
    abrirModal(parseInt(card.getAttribute('data-index'), 10));
});

let formatoElegido = '10ml';

function calcularPrecios(p) {
    return {
        '5ml': Math.round(p.precio * 0.08 * 1.2 * 1.2),
        '10ml': Math.round(p.precio * 0.15 * 1.2),
        'botella': p.precio
    };
}

function etiquetaFormato(clave, p) {
    if (clave === 'botella') return `Botella completa (${p.tamano})`;
    return `${clave} Decant`;
}

function abrirModal(indice) {
    const p = listaActual[indice];
    if (!p) return;

    const precios = calcularPrecios(p);
    formatoElegido = '10ml';

    const contenido = `
        <div class="modal-img">
            <img src="${p.imagen}" alt="${p.marca} ${p.nombre}">
        </div>
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
        <button class="cta-btn modal-wa" id="modal-wa-btn">Añadir al carrito</button>
    `;

    document.getElementById('modal-contenido').innerHTML = contenido;

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
    if (e.key === 'Escape') {
        cerrarModal();
        if (carritoAbierto) cerrarCarrito();
    }
});

/* ===== Carrito de compras ===== */
let carrito = [];
let carritoAbierto = false;

const carritoEl = {
    btn: document.getElementById('carrito-btn'),
    panel: document.getElementById('carrito-panel'),
    lista: document.getElementById('carrito-lista'),
    contador: document.getElementById('carrito-contador'),
    total: document.getElementById('carrito-total'),
    wa: document.getElementById('carrito-wa')
};

function abrirCarrito() {
    carritoAbierto = true;
    const backdrop = document.getElementById('carrito-backdrop');
    if (carritoEl.btn) carritoEl.btn.setAttribute('aria-expanded', 'true');
    if (carritoEl.panel) carritoEl.panel.classList.add('abierto');
    if (backdrop) backdrop.classList.add('abierto');
    document.body.style.overflow = 'hidden';
}

function cerrarCarrito() {
    carritoAbierto = false;
    const backdrop = document.getElementById('carrito-backdrop');
    if (carritoEl.btn) carritoEl.btn.setAttribute('aria-expanded', 'false');
    if (carritoEl.panel) carritoEl.panel.classList.remove('abierto');
    if (backdrop) backdrop.classList.remove('abierto');
    document.body.style.overflow = '';
}

function agregarAlCarrito(p, formato) {
    carrito.push({
        marca: p.marca,
        nombre: p.nombre,
        formato: formato,
        precio: calcularPrecios(p)[formato]
    });
    renderizarCarrito();
    abrirCarrito();
}

function quitarDelCarrito(indice) {
    carrito.splice(indice, 1);
    renderizarCarrito();
}

function renderizarCarrito() {
    const el = carritoEl;
    const totalItems = carrito.length;

    if (el.contador) {
        el.contador.textContent = totalItems;
        el.contador.classList.toggle('vacio', totalItems === 0);
    }

    if (el.total) {
        const suma = carrito.reduce((acc, item) => acc + item.precio, 0);
        el.total.textContent = suma > 0 ? formatearPrecio(suma) : '';
    }

    if (el.lista) {
        if (carrito.length === 0) {
            el.lista.innerHTML = '<div class="carrito-vacio">Tu carrito está vacío.</div>';
        } else {
            el.lista.innerHTML = carrito.map((item, i) => {
                const esDecant = item.formato !== 'botella';
                const formatoTexto = item.formato === 'botella'
                    ? 'Botella completa'
                    : `${item.formato} Decant`;
                return `
                    <div class="carrito-item">
                        <div class="carrito-item-top">
                            <span class="carrito-item-nombre">${item.marca} ${item.nombre}</span>
                            <span class="carrito-item-precio">${formatearPrecio(item.precio)}</span>
                        </div>
                        <span class="carrito-item-formato${esDecant ? ' decant' : ''}">${formatoTexto}</span>
                        <button class="carrito-quitar" data-quitar="${i}" type="button">Quitar</button>
                    </div>
                `;
            }).join('');
        }
    }

    if (el.wa) el.wa.disabled = carrito.length === 0;
}

function enviarCarrito() {
    if (carrito.length === 0) return;
    const lineas = carrito.map(item => {
        const formatoTexto = item.formato === 'botella'
            ? 'Botella completa'
            : `${item.formato} Decant`;
        return `• ${item.marca} ${item.nombre} — ${formatoTexto} (${formatearPrecio(item.precio)})`;
    });
    const total = carrito.reduce((acc, item) => acc + item.precio, 0);
    const mensaje = `Hola, quiero hacer este pedido:\n\n${lineas.join('\n')}\n\nTotal: ${formatearPrecio(total)}. ¿Me confirmás disponibilidad y el proceso de compra?`;
    window.open(`https://wa.me/${numeroWhatsApp}?text=${encodeURIComponent(mensaje)}`, '_blank');
}

(function inicializarCarrito() {
    const el = carritoEl;
    if (!el.btn || !el.panel) return;
    el.btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (carritoAbierto) cerrarCarrito();
        else abrirCarrito();
    });
    el.panel.addEventListener('click', (e) => {
        const quitar = e.target.closest('[data-quitar]');
        if (quitar) quitarDelCarrito(parseInt(quitar.getAttribute('data-quitar'), 10));
    });
    const cerrar = document.getElementById('carrito-cerrar');
    if (cerrar) cerrar.addEventListener('click', cerrarCarrito);
    const backdrop = document.getElementById('carrito-backdrop');
    if (backdrop) backdrop.addEventListener('click', cerrarCarrito);
    const wa = el.wa;
    if (wa) wa.addEventListener('click', enviarCarrito);
    document.addEventListener('click', (e) => {
        const dentro = (el.panel && el.panel.contains(e.target)) || (el.btn && el.btn.contains(e.target)) || (backdrop && backdrop.contains(e.target));
        if (!dentro && carritoAbierto) cerrarCarrito();
    });
})();

renderizarCarrito();

const btnColumnas = document.getElementById('btn-columnas');
const gridCatalogo = document.getElementById('product-grid');
const btnColsLabel = document.getElementById('btn-cols-label');
let columnas = parseInt(localStorage.getItem('oudColumnas') || '1', 10);
if (isNaN(columnas) || columnas < 1 || columnas > 3) columnas = 1;

function aplicarColumnas() {
    gridCatalogo.classList.remove('cols-1', 'cols-2', 'cols-3');
    if (columnas > 1) gridCatalogo.classList.add('cols-' + columnas);
    btnColsLabel.textContent = columnas;
    localStorage.setItem('oudColumnas', columnas);
}

btnColumnas.addEventListener('click', () => {
    columnas = columnas === 3 ? 1 : columnas + 1;
    aplicarColumnas();
});
aplicarColumnas();

const botonGeneral = document.getElementById('general-wa');
const mensajeGeneral = "Hola, estaba viendo la página web y me gustaría recibir asesoramiento sobre las fragancias árabes.";
botonGeneral.href = `https://wa.me/${numeroWhatsApp}?text=${encodeURIComponent(mensajeGeneral)}`;
const botonHeaderWa = document.getElementById('header-wa');
if (botonHeaderWa) botonHeaderWa.href = botonGeneral.href;

const banner = document.getElementById('inicio');
const irADestacados = () => document.getElementById('destacados').scrollIntoView({ behavior: 'smooth' });
banner.addEventListener('click', (e) => {
    if (e.target.closest('a')) return;
    irADestacados();
});
banner.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        irADestacados();
    }
});

document.querySelectorAll('a[href^="#"]').forEach(enlace => {
    enlace.addEventListener('click', function(e) {
        const destino = document.querySelector(this.getAttribute('href'));
        if (destino) {
            e.preventDefault();
            destino.scrollIntoView({ behavior: 'smooth' });
        }
    });
});

const destacadosBuscados = ['9PM Night Out', 'Mandarin Sky Aqua', '9PM Elixir', 'Checkmate King', 'Khamrah Waha', 'Asad Elixir'];
let destacados = [];

function renderizarDestacados() {
    const grid = document.getElementById('destacados-grid');
    if (!grid || destacados.length === 0) return;
    grid.innerHTML = destacados.map((p, i) => `
        <div class="product-card card-reveal" data-index="${i}" role="button" tabindex="0" aria-label="Ver ${p.marca} ${p.nombre}" style="transition-delay: ${Math.min(i * 0.06, 0.3)}s">
            <span class="fav-corazon" data-id="${idProducto(p)}" role="button" tabindex="0" aria-label="Guardar ${p.nombre} en favoritos">♥</span>
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
    requestAnimationFrame(() => {
        grid.querySelectorAll('.card-reveal:not(.is-visible)').forEach(el => el.classList.add('is-visible'));
    });
    marcarCorazones();
}

document.getElementById('destacados-grid').addEventListener('click', (e) => {
    const corazon = e.target.closest('.fav-corazon');
    if (corazon) {
        e.stopPropagation();
        const id = corazon.getAttribute('data-id');
        if (!id) return;
        const activo = toggleFavorito(id);
        corazon.classList.toggle('activo', activo);
        const num = document.getElementById('fav-chip-num');
        if (num) num.textContent = obtenerFavoritos().length > 0 ? obtenerFavoritos().length : '';
        return;
    }
    const card = e.target.closest('.product-card');
    if (!card) return;
    listaActual = destacados;
    abrirModal(parseInt(card.getAttribute('data-index'), 10));
});

document.getElementById('destacados-grid').addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const card = e.target.closest('.product-card');
    if (!card) return;
    e.preventDefault();
    listaActual = destacados;
    abrirModal(parseInt(card.getAttribute('data-index'), 10));
});

const observador = new IntersectionObserver((entradas) => {
    entradas.forEach(entrada => {
        if (entrada.isIntersecting) {
            entrada.target.classList.add('is-visible');
            observador.unobserve(entrada.target);
        }
    });
}, { threshold: 0.15 });

document.querySelectorAll('.scroll-reveal').forEach(el => observador.observe(el));

/* ===== Carga asíncrona del catálogo desde JSON ===== */
fetch('./data/productos.json?v=' + JSON_VERSION)
    .then(r => {
        if (!r.ok) throw new Error('No se pudo cargar el catálogo (' + r.status + ')');
        return r.json();
    })
    .then(data => {
        productos = data;
        inicializarCatalogo();
    })
    .catch(err => {
        console.error(err);
        const grid = document.getElementById('product-grid');
        if (grid) grid.innerHTML = '<p class="empty-state">No pudimos cargar el catálogo. Probá de nuevo en unos segundos.</p>';
    });

function inicializarCatalogo() {
    renderizarFiltros();
    actualizarMenuMarcas();
    renderizarProductos(productos);

    destacadosBuscados.forEach(nombreBuscado => {
        const found = productos.find(p => p.nombre === nombreBuscado);
        if (found) destacados.push(found);
    });
    renderizarDestacados();

    document.dispatchEvent(new CustomEvent('oudProductosCargados'));
}


/* ===== Slider del banner: cambia cada 5 seg. con desplazamiento ===== */
(function sliderBanner() {
    var slides = document.querySelectorAll('.banner-slide');
    if (!slides.length) return;
    var i = 0;
    function siguiente() {
        slides[i].classList.remove('activo');
        i = (i + 1) % slides.length;
        slides[i].classList.add('activo');
    }
    setInterval(siguiente, 8000);
})();