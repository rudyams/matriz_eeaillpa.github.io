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

// ============================================
// CARGAR LISTA DE PDFs (SIN CACHÉ)
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
    
    // Limpieza total antes de abrir
    if (pdfDocActual) {
        try {
            await pdfDocActual.destroy();
        } catch(e) { console.warn('Error destruyendo PDF anterior:', e); }
        pdfDocActual = null;
    }
    
    totalPaginas = 1;
    paginaActual = 1;
    
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

    } catch (error) {
        console.error('Error al cargar PDF:', error);
        container.innerHTML = `
            <div style="color:white; text-align:center; padding: 40px;">
                <h2>❌ No se pudo cargar el documento</h2>
                <p style="opacity:0.7; margin-top:10px;">
                    Ruta: <strong>${pdf.archivo}</strong>
                </p>
                <p style="opacity:0.5; margin-top:5px; font-size:0.85em;">
                    Error: ${error.message || 'Desconocido'}
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
    
    container.style.transition = 'opacity 0.2s ease';
    container.style.opacity = '0';
    
    await new Promise(resolve => setTimeout(resolve, 180));

    try {
        const page = await pdfDocActual.getPage(numeroPagina);
        
        const viewportBase = page.getViewport({ scale: 1 });
        const ratio = viewportBase.width / viewportBase.height;
        
        const wrapper = document.querySelector('.pdf-wrapper');
        const anchoDisponible = wrapper.clientWidth - 30;
        const altoDisponible = wrapper.clientHeight - 30;
        
        let anchoFinal, altoFinal;
        
        if (anchoDisponible / altoDisponible > ratio) {
            altoFinal = altoDisponible;
            anchoFinal = altoFinal * ratio;
        } else {
            anchoFinal = anchoDisponible;
            altoFinal = anchoFinal / ratio;
        }
        
        const escala = Math.min(anchoFinal / viewportBase.width, 3);
        const viewportRender = page.getViewport({ scale: escala * 2 });
        
        const canvas = document.createElement('canvas');
        canvas.width = viewportRender.width;
        canvas.height = viewportRender.height;
        canvas.style.width = anchoFinal + 'px';
        canvas.style.height = altoFinal + 'px';
        canvas.style.display = 'block';
        
        const context = canvas.getContext('2d');
        await page.render({
            canvasContext: context,
            viewport: viewportRender
        }).promise;

        container.innerHTML = '';
        container.appendChild(canvas);
        
        container.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        container.style.opacity = '1';
        
        void container.offsetWidth;
        
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
    
    if (btnPrev) btnPrev.disabled = (paginaActual <= 1);
    if (btnNext) btnNext.disabled = (paginaActual >= totalPaginas);
    
    const botonesInferiores = document.querySelectorAll('.btn-control');
    if (botonesInferiores[0]) botonesInferiores[0].disabled = (paginaActual <= 1);
    if (botonesInferiores[1]) botonesInferiores[1].disabled = (paginaActual >= totalPaginas);
}

// ============================================
// CERRAR VISOR
// ============================================
async function cerrarVisor() {
    if (pdfDocActual) {
        try {
            await pdfDocActual.destroy();
        } catch(e) { console.warn('Error al destruir:', e); }
        pdfDocActual = null;
    }
    
    paginaActual = 1;
    totalPaginas = 1;
    bloqueado = false;
    
    document.getElementById('visor').classList.add('oculto');
    document.querySelector('.galeria-container').style.display = 'block';
    document.querySelector('.header').style.display = 'block';
    
    const container = document.getElementById('pdf-page-container');
    container.innerHTML = '';
    container.style.opacity = '1';
    container.style.transform = 'translateX(0)';
}

// ============================================
// DETECTAR ?doc=XX EN LA URL (VERSIÓN MEJORADA)
// ============================================
function obtenerDocDesdeURL() {
    // 1. Intentar leer desde el hash (#), que es lo más seguro
    const hash = window.location.hash;
    if (hash && hash.includes('doc=')) {
        const match = hash.match(/doc=([^&]+)/);
        if (match && match[1]) {
            return decodeURIComponent(match[1]);
        }
    }
    
    // 2. Si no, intentar leer desde los parámetros de búsqueda normales (?)
    const params = new URLSearchParams(window.location.search);
    return params.get('doc');
}

// ============================================
// TECLADO
// ============================================
document.addEventListener('keydown', (e) => {
    if (document.getElementById('visor').classList.contains('oculto')) return;
    if (e.key === 'ArrowLeft') paginaAnterior();
    if (e.key === 'ArrowRight') paginaSiguiente();
    if (e.key === 'Escape') cerrarVisor();
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
// INICIAR (CON SOPORTE PARA ?doc=XX)
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
    await cargarListaPDFs();
    
    // Después de cargar la galería, verificar si hay un doc en la URL
    const docParam = obtenerDocDesdeURL();
    
    if (docParam) {
        // Buscar el documento por número (01, 02...) o por nombre de archivo
        const index = listaPDFs.findIndex((pdf, i) => {
            const num = String(i + 1).padStart(2, '0');
            return num === docParam || pdf.archivo.toLowerCase().includes(docParam.toLowerCase());
        });
        
        if (index !== -1) {
            // Esperar un momento para que la galería se renderice, luego abrir
            setTimeout(() => abrirVisor(index), 500);
        }
    }
});

// También escuchar cambios en el hash (por si acaso)
window.addEventListener('hashchange', () => {
    const docParam = obtenerDocDesdeURL();
    if (docParam) {
        const index = listaPDFs.findIndex((pdf, i) => {
            const num = String(i + 1).padStart(2, '0');
            return num === docParam;
        });
        if (index !== -1) {
            abrirVisor(index);
        }
    }
});
