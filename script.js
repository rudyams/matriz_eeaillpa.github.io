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

let zoomActual = 1;
let zoomMin = 1;
let zoomMax = 4;
let zoomPaso = 0.25;

let arrastrando = false;
let startX = 0, startY = 0;
let scrollStartX = 0, scrollStartY = 0;

// ============================================
// CARGAR LISTA DE PDFs
// ============================================
async function cargarListaPDFs() {
    try {
        const respuesta = await fetch('lista.json?v=' + Date.now(), { cache: 'no-store' });
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
// MOSTRAR PÁGINA
// ============================================
async function mostrarPagina(numeroPagina) {
    if (!pdfDocActual) return;

    const container = document.getElementById('pdf-page-container');
    const wrapper = document.getElementById('pdf-wrapper');
    
    container.style.opacity = '0';
    
    await new Promise(resolve => setTimeout(resolve, 100));

    try {
        const page = await pdfDocActual.getPage(numeroPagina);
        
        const viewportBase = page.getViewport({ scale: 1 });
        const ratio = viewportBase.width / viewportBase.height;
        
        // Espacio disponible (descontando padding del wrapper)
        const padding = window.innerWidth <= 768 ? 100 : 140;
        const anchoDisponible = wrapper.clientWidth - padding;
        const altoDisponible = wrapper.clientHeight - 40;
        
        let anchoBase, altoBase;
        
        // Ajustar para que quepa completo (sin zoom)
        if (anchoDisponible / altoDisponible > ratio) {
            altoBase = altoDisponible;
            anchoBase = altoBase * ratio;
        } else {
            anchoBase = anchoDisponible;
            altoBase = anchoBase / ratio;
        }
        
        // Dimensiones visuales con zoom aplicado
        const anchoVisual = Math.round(anchoBase * zoomActual);
        const altoVisual = Math.round(altoBase * zoomActual);
        
        // Renderizar a alta resolución (sin aplicar zoom al canvas interno)
        const dpr = window.devicePixelRatio || 1;
        const factorCalidad = Math.min(Math.max(dpr, 2), 3);
        const escalaRender = (anchoBase / viewportBase.width) * factorCalidad;
        
        const viewportRender = page.getViewport({ scale: escalaRender });
        
        const canvas = document.createElement('canvas');
        canvas.width = viewportRender.width;
        canvas.height = viewportRender.height;
        canvas.style.width = anchoVisual + 'px';
        canvas.style.height = altoVisual + 'px';
        canvas.style.display = 'block';
        
        const context = canvas.getContext('2d');
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = 'high';
        
        await page.render({
            canvasContext: context,
            viewport: viewportRender
        }).promise;

        container.innerHTML = '';
        container.appendChild(canvas);
        container.style.opacity = '1';
        
        // ========== ACTUALIZAR COMPORTAMIENTO DE SCROLL ==========
        if (zoomActual > 1) {
            wrapper.classList.add('zoom-activo');
        } else {
            wrapper.classList.remove('zoom-activo');
        }
        
        // ========== CENTRAR DOCUMENTO DESPUÉS DEL RENDERIZADO ==========
        // Esperamos 2 frames para asegurar que el navegador ya calculó el layout
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                centrarDocumento();
            });
        });
        
    } catch (error) {
        console.error('Error al renderizar página:', error);
        container.style.opacity = '1';
    }
}

// ============================================
// CENTRAR DOCUMENTO EN EL WRAPPER
// ============================================
function centrarDocumento() {
    const wrapper = document.getElementById('pdf-wrapper');
    if (!wrapper) return;
    
    const scrollX = (wrapper.scrollWidth - wrapper.clientWidth) / 2;
    const scrollY = (wrapper.scrollHeight - wrapper.clientHeight) / 2;
    
    wrapper.scrollLeft = Math.max(0, scrollX);
    wrapper.scrollTop = Math.max(0, scrollY);
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
    const valorAnterior = zoomActual;
    zoomActual = Math.min(zoomActual + zoomPaso, zoomMax);
    actualizarZoom();
    aplicarZoomSinReRender(valorAnterior);
}

function zoomOut() {
    if (zoomActual <= zoomMin) return;
    const valorAnterior = zoomActual;
    zoomActual = Math.max(zoomActual - zoomPaso, zoomMin);
    actualizarZoom();
    aplicarZoomSinReRender(valorAnterior);
}

function zoomReset() {
    const valorAnterior = zoomActual;
    zoomActual = 1;
    actualizarZoom();
    aplicarZoomSinReRender(valorAnterior);
}

// Aplica el zoom solo cambiando el tamaño del canvas (sin re-renderizar)
function aplicarZoomSinReRender(valorAnterior) {
    const wrapper = document.getElementById('pdf-wrapper');
    const canvas = document.querySelector('#pdf-page-container canvas');
    
    if (!canvas) {
        // Si no hay canvas, re-renderizar
        mostrarPagina(paginaActual);
        return;
    }
    
    // Guardar posición relativa del scroll
    const relScrollX = wrapper.scrollLeft / Math.max(1, wrapper.scrollWidth);
    const relScrollY = wrapper.scrollTop / Math.max(1, wrapper.scrollHeight);
    
    // Calcular nuevas dimensiones
    const anchoActual = parseFloat(canvas.style.width);
    const altoActual = parseFloat(canvas.style.height);
    const factor = zoomActual / valorAnterior;
    
    canvas.style.width = Math.round(anchoActual * factor) + 'px';
    canvas.style.height = Math.round(altoActual * factor) + 'px';
    
    // Actualizar comportamiento
    if (zoomActual > 1) {
        wrapper.classList.add('zoom-activo');
    } else {
        wrapper.classList.remove('zoom-activo');
    }
    
    // Ajustar scroll
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            if (zoomActual === 1) {
                centrarDocumento();
            } else {
                // Mantener posición relativa
                wrapper.scrollLeft = relScrollX * wrapper.scrollWidth - wrapper.clientWidth / 2;
                wrapper.scrollTop = relScrollY * wrapper.scrollHeight - wrapper.clientHeight / 2;
            }
        });
    });
}

function actualizarZoom() {
    const nivel = document.getElementById('zoom-nivel');
    if (nivel) {
        nivel.textContent = Math.round(zoomActual * 100) + '%';
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
    arrastrando = false;
    
    document.getElementById('visor').classList.add('oculto');
    document.querySelector('.galeria-container').style.display = 'block';
    document.querySelector('.header').style.display = 'block';
    
    const container = document.getElementById('pdf-page-container');
    container.innerHTML = '';
    container.style.opacity = '1';
    
    const wrapper = document.getElementById('pdf-wrapper');
    if (wrapper) {
        wrapper.classList.remove('zoom-activo');
        wrapper.scrollLeft = 0;
        wrapper.scrollTop = 0;
    }
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
// CONFIGURAR ARRASTRE (MOUSE + TÁCTIL)
// ============================================
function configurarArrastre() {
    const wrapper = document.getElementById('pdf-wrapper');
    if (!wrapper || wrapper.dataset.arrastreConfigurado === '1') return;
    wrapper.dataset.arrastreConfigurado = '1';
    
    // ===== MOUSE =====
    wrapper.addEventListener('mousedown', (e) => {
        if (zoomActual <= 1) return;
        if (e.target.closest('button')) return;
        
        arrastrando = true;
        startX = e.clientX;
        startY = e.clientY;
        scrollStartX = wrapper.scrollLeft;
        scrollStartY = wrapper.scrollTop;
        wrapper.classList.add('arrastrando');
        e.preventDefault();
    });
    
    document.addEventListener('mousemove', (e) => {
        if (!arrastrando) return;
        e.preventDefault();
        const walkX = e.clientX - startX;
        const walkY = e.clientY - startY;
        wrapper.scrollLeft = scrollStartX - walkX;
        wrapper.scrollTop = scrollStartY - walkY;
    });
    
    document.addEventListener('mouseup', () => {
        if (arrastrando) {
            arrastrando = false;
            wrapper.classList.remove('arrastrando');
        }
    });
    
    // ===== TÁCTIL (MÓVIL) =====
    wrapper.addEventListener('touchstart', (e) => {
        if (zoomActual <= 1) return;
        if (e.touches.length !== 1) return;
        if (e.target.closest('button')) return;
        
        arrastrando = true;
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        scrollStartX = wrapper.scrollLeft;
        scrollStartY
