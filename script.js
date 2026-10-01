// ============================================
// CONFIGURACIÓN DE PDF.JS
// ============================================
pdfjsLib.GlobalWorkerOptions.workerSrc = 
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// ============================================
// VARIABLES GLOBALES
// ============================================
let listaPDFs = [];
let pdfDocActual = null;
let totalPaginas = 1;
let paginaActual = 1;
let bloqueado = false;

// Zoom
let zoomActual = 1;        // 1 = ajustado a pantalla
let zoomMin = 1;
let zoomMax = 4;
let zoomPaso = 0.25;

// Arrastre
let arrastrando = false;
let startX = 0, startY = 0;
let scrollStartX = 0, scrollStartY = 0;

// ============================================
// CARGAR LISTA DE PDFs
// ============================================
async function cargarListaPDFs() {
    try {
        const respuesta = await fetch('lista.json?v=' + Date.now(), {
            cache: 'no-store'
        });
        if (!respuesta.ok) throw new Error('No se encontró lista.json');
        listaPDFs = await respuesta.json();
        
        document.getElementById('contador-docs').textContent = 
            `${listaPDFs.length} documento${listaPDFs.length !== 1 ? 's' : ''}`;
        
        cargarGaleria();
    } catch (error) {
        console.error('Error:', error);
        document.getElementById('galeria').innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 60px 20px;">
                <h2 style="color:#e53e3e;">⚠️ No se encontró lista.json</h2>
            </div>
        `;
    }
}

// ============================================
// CARGAR GALERÍA
// ============================================
function cargarGaleria() {
    const galeria = document.getElementById('galeria');
    galeria.innerHTML = '';

    if (listaPDFs.length === 0) {
        galeria.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 60px 20px;">
                <h2 style="color:#718096;">📭 No hay documentos</h2>
            </div>
        `;
        return;
    }

    listaPDFs.forEach((pdf, index) => {
        const numero = String(index + 1).padStart(2, '0');
        const tarjeta = document.createElement('div');
        tarjeta.className = 'tarjeta';
        tarjeta.innerHTML = `
            <div class="tarjeta-portada">
                <div class="numero">${numero}</div>
                <div class="placeholder">📕</div>
            </div>
            <div class="tarjeta-info">
                <h3>${pdf.titulo}</h3>
                <div class="categoria">Documento PDF</div>
            </div>
        `;
        tarjeta.onclick = () => abrirVisor(index);
        galeria.appendChild(tarjeta);
    });
}

// ============================================
// ABRIR VISOR
// ============================================
async function abrirVisor(index) {
    if (bloqueado) return;
    bloqueado = true;
    
    const pdf = listaPDFs[index];
    
    if (pdfDocActual) {
        try { await pdfDocActual.destroy(); } catch(e) {}
        pdfDocActual = null;
    }
    
    totalPaginas = 1;
    paginaActual = 1;
    zoomActual = 1;
    
    document.querySelector('.galeria-container').style.display = 'none';
    document.querySelector('.header').style.display = 'none';
    document.getElementById('visor').classList.remove('oculto');
    document.getElementById('titulo-libro').textContent = pdf.titulo;

    const container = document.getElementById('pdf-page-container');
    container.innerHTML = `
        <div class="loader">
            <div class="spinner"></div>
            <p>Cargando documento...</p>
        </div>
    `;

    try {
        const loadingTask = pdfjsLib.getDocument({
            url: pdf.archivo,
            cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
            cMapPacked: true
        });
        
        pdfDocActual = await loadingTask.promise;
        totalPaginas = pdfDocActual.numPages;
        paginaActual = 1;
        
        await mostrarPagina(paginaActual);
        actualizarIndicadores();
        actualizarBotones();
        actualizarZoom();

    } catch (error) {
        console.error('Error al cargar PDF:', error);
        container.innerHTML = `
            <div style="color:white; text-align:center; padding: 40px;">
                <h2>❌ No se pudo cargar el documento</h2>
                <p style="opacity:0.7; margin-top:10px;">
                    Ruta: <strong>${pdf.archivo}</strong>
                </p>
            </div>
        `;
    } finally {
        bloqueado = false;
    }
}

// ============================================
// MOSTRAR PÁGINA (ALTA RESOLUCIÓN)
// ============================================
async function mostrarPagina(numeroPagina) {
    if (!pdfDocActual) return;

    const container = document.getElementById('pdf-page-container');
    container.style.opacity = '0';
    
    await new Promise(resolve => setTimeout(resolve, 150));

    try {
        const page = await pdfDocActual.getPage(numeroPagina);
        
        const viewportBase = page.getViewport({ scale: 1 });
        const ratio = viewportBase.width / viewportBase.height;
        
        const wrapper = document.getElementById('pdf-wrapper');
        const anchoDisponible = wrapper.clientWidth - 100;
        const altoDisponible = wrapper.clientHeight - 30;
        
        let anchoFinal, altoFinal;
        
        if (anchoDisponible / altoDisponible > ratio) {
            altoFinal = altoDisponible;
            anchoFinal = altoFinal * ratio;
        } else {
            anchoFinal = anchoDisponible;
            altoFinal = anchoFinal / ratio;
        }
        
        // ========== CLAVE: ALTA RESOLUCIÓN ==========
        // Usar devicePixelRatio para pantallas retina (celulares, tablets, monitores 4K)
        const dpr = window.devicePixelRatio || 1;
        
        // Factor de calidad: renderizar al menos a 2x, y hasta 3x si la pantalla lo soporta
        const factorCalidad = Math.min(Math.max(dpr, 2), 3);
        
        // Escala real para renderizar el canvas a alta resolución
        const escalaRender = (anchoFinal / viewportBase.width) * factorCalidad * zoomActual;
        
        const viewportRender = page.getViewport({ scale: escalaRender });
        
        const canvas = document.createElement('canvas');
        canvas.width = viewportRender.width;
        canvas.height = viewportRender.height;
        
        // Tamaño visual = tamaño lógico * zoom
        const anchoVisual = anchoFinal * zoomActual;
        const altoVisual = altoFinal * zoomActual;
        canvas.style.width = anchoVisual + 'px';
        canvas.style.height = altoVisual + 'px';
        canvas.style.display = 'block';
        
        const context = canvas.getContext('2d');
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = 'high';
        
        await page.render({
            canvasContext: context,
            viewport: viewportRender,
            transform: [factorCalidad, 0, 0, factorCalidad, 0, 0]
        }).promise;

        container.innerHTML = '';
        container.appendChild(canvas);
        
        container.style.opacity = '1';
        
        // Actualizar dimensiones de scroll
        actualizarScroll();
        
    } catch (error) {
        console.error('Error al renderizar página:', error);
        container.style.opacity = '1';
    }
}

// ============================================
// NAVEGACIÓN
// ============================================
async function paginaAnterior() {
    if (bloqueado || !pdfDocActual) return;
    if (paginaActual <= 1) return;
    
    bloqueado = true;
    paginaActual--;
    await mostrarPagina(paginaActual);
    actualizarIndicadores();
    actualizarBotones();
    bloqueado = false;
}

async function paginaSiguiente() {
    if (bloqueado || !pdfDocActual) return;
    if (paginaActual >= totalPaginas) return;
    
    bloqueado = true;
    paginaActual++;
    await mostrarPagina(paginaActual);
    actualizarIndicadores();
    actualizarBotones();
    bloqueado = false;
}

// ============================================
// ZOOM
// ============================================
function zoomIn() {
    if (zoomActual >= zoomMax) return;
    zoomActual = Math.min(zoomActual + zoomPaso, zoomMax);
    mostrarPagina(paginaActual);
    actualizarZoom();
}

function zoomOut() {
    if (zoomActual <= zoomMin) return;
    zoomActual = Math.max(zoomActual - zoomPaso, zoomMin);
    mostrarPagina(paginaActual);
    actualizarZoom();
}

function zoomReset() {
    zoomActual = 1;
    mostrarPagina(paginaActual);
    actualizarZoom();
}

function actualizarZoom() {
    const nivel = document.getElementById('zoom-nivel');
    if (nivel) {
        nivel.textContent = Math.round(zoomActual * 100) + '%';
    }
}

// ============================================
// ARRASTRE (cuando hay zoom)
// ============================================
function actualizarScroll() {
    const wrapper = document.getElementById('pdf-wrapper');
    if (!wrapper) return;
    
    if (zoomActual > 1) {
        wrapper.style.cursor = 'grab';
        wrapper.style.overflow = 'auto';
        wrapper.style.alignItems = 'flex-start';
        wrapper.style.justifyContent = 'flex-start';
    } else {
        wrapper.style.cursor = 'default';
        wrapper.style.overflow = 'hidden';
        wrapper.style.alignItems = 'center';
        wrapper.style.justifyContent = 'center';
    }
}

// ============================================
// ACTUALIZAR INDICADORES
// ============================================
function actualizarIndicadores() {
    document.getElementById('indicador-pagina').textContent = 
        `${paginaActual} / ${totalPaginas}`;
    
    const progreso = (paginaActual / totalPaginas) * 100;
    document.getElementById('progreso-relleno').style.width = progreso + '%';
}

function actualizarBotones() {
    const btnPrev = document.getElementById('btn-prev');
    const btnNext = document.getElementById('btn-next');
    const btnAnt = document.getElementById('btn-ant');
    const btnSig = document.getElementById('btn-sig');
    
    const esPrimera = paginaActual <= 1;
    const esUltima = paginaActual >= totalPaginas;
    
    if (btnPrev) btnPrev.disabled = esPrimera;
    if (btnAnt) btnAnt.disabled = esPrimera;
    if (btnNext) btnNext.disabled = esUltima;
    if (btnSig) btnSig.disabled = esUltima;
}

// ============================================
// CERRAR VISOR
// ============================================
async function cerrarVisor() {
    if (pdfDocActual) {
        try { await pdfDocActual.destroy(); } catch(e) {}
        pdfDocActual = null;
    }
    
    paginaActual = 1;
    totalPaginas = 1;
    zoomActual = 1;
    bloqueado = false;
    
    document.getElementById('visor').classList.add('oculto');
    document.querySelector('.galeria-container').style.display = 'block';
    document.querySelector('.header').style.display = 'block';
    
    const container = document.getElementById('pdf-page-container');
    container.innerHTML = '';
    container.style.opacity = '1';
}

// ============================================
// DETECTAR ?doc=XX EN LA URL
// ============================================
function obtenerDocDesdeURL() {
    const hash = window.location.hash;
    if (hash && hash.includes('doc=')) {
        const match = hash.match(/doc=([^&]+)/);
        if (match && match[1]) return decodeURIComponent(match[1]);
    }
    const params = new URLSearchParams(window.location.search);
    return params.get('doc');
}

// ============================================
// EVENTOS DE ARRASTRE
// ============================================
function configurarArrastre() {
    const wrapper = document.getElementById('pdf-wrapper');
    if (!wrapper) return;
    
    wrapper.addEventListener('mousedown', (e) => {
        if (zoomActual <= 1) return;
        arrastrando = true;
        startX = e.pageX;
        startY = e.pageY;
        scrollStartX = wrapper.scrollLeft;
        scrollStartY = wrapper.scrollTop;
        wrapper.style.cursor = 'grabbing';
        e.preventDefault();
    });
    
    wrapper.addEventListener('mousemove', (e) => {
        if (!arrastrando) return;
        e.preventDefault();
        const walkX = e.pageX - startX;
        const walkY = e.pageY - startY;
        wrapper.scrollLeft = scrollStartX - walkX;
        wrapper.scrollTop = scrollStartY - walkY;
    });
    
    wrapper.addEventListener('mouseup', () => {
        arrastrando = false;
        if (zoomActual > 1) wrapper.style.cursor = 'grab';
    });
    
    wrapper.addEventListener('mouseleave', () => {
        arrastrando = false;
        if (zoomActual > 1) wrapper.style.cursor = 'grab';
    });
    
    // Táctil para móvil
    wrapper.addEventListener('touchstart', (e) => {
        if (zoomActual <= 1 || e.touches.length !== 1) return;
        arrastrando = true;
        startX = e.touches[0].pageX;
        startY = e.touches[0].pageY;
        scrollStartX = wrapper.scrollLeft;
        scrollStartY = wrapper.scrollTop;
    }, { passive: true });
    
    wrapper.addEventListener('touchmove', (e) => {
        if (!arrastrando || e.touches.length !== 1) return;
        const walkX = e.touches[0].pageX - startX;
        const walkY = e.touches[0].pageY - startY;
        wrapper.scrollLeft = scrollStartX - walkX;
        wrapper.scrollTop = scrollStartY - walkY;
    }, { passive: true });
    
    wrapper.addEventListener('touchend', () => {
        arrastrando = false;
    });
}

// ============================================
// DOBLE CLIC PARA ZOOM
// ============================================
function configurarDobleClic() {
    const container = document.getElementById('pdf-page-container');
    if (!container) return;
    
    container.addEventListener('dblclick', () => {
        if (zoomActual > 1) {
            zoomReset();
        } else {
            zoomActual = 2;
            mostrarPagina(paginaActual);
            actualizarZoom();
        }
    });
}

// ============================================
// TECLADO
// ============================================
document.addEventListener('keydown', (e) => {
    if (document.getElementById('visor').classList.contains('oculto')) return;
    if (e.key === 'ArrowLeft') paginaAnterior();
    if (e.key === 'ArrowRight') paginaSiguiente();
    if (e.key === 'ArrowUp') zoomIn();
    if (e.key === 'ArrowDown') zoomOut();
    if (e.key === 'Escape') cerrarVisor();
    if (e.key === '+' || e.key === '=') zoomIn();
    if (e.key === '-') zoomOut();
});

// ============================================
// RESIZE
// ============================================
let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        if (pdfDocActual && !document.getElementById('visor').classList.contains('oculto')) {
            mostrarPagina(paginaActual);
        }
    }, 300);
});

// ============================================
// INICIAR
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
    await cargarListaPDFs();
    
    // Configurar eventos después de que el DOM esté listo
    setTimeout(() => {
        configurarArrastre();
        configurarDobleClic();
    }, 500);
    
    // Detectar ?doc=XX en la URL
    const docParam = obtenerDocDesdeURL();
    if (docParam) {
        const index = listaPDFs.findIndex((pdf, i) => {
            const num = String(i + 1).padStart(2, '0');
            return num === docParam || pdf.archivo.toLowerCase().includes(docParam.toLowerCase());
        });
        
        if (index !== -1) {
            setTimeout(() => abrirVisor(index), 500);
        }
    }
});

// Escuchar cambios en el hash
window.addEventListener('hashchange', () => {
    const docParam = obtenerDocDesdeURL();
    if (docParam) {
        const index = listaPDFs.findIndex((pdf, i) => {
            const num = String(i + 1).padStart(2, '0');
            return num === docParam;
        });
        if (index !== -1) abrirVisor(index);
    }
});
