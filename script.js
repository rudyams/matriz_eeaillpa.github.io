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
let cargando = false;

// ============================================
// CARGAR LISTA DE PDFs
// ============================================
async function cargarListaPDFs() {
    try {
        const respuesta = await fetch('lista.json?v=' + Date.now());
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
    if (cargando) return;
    
    const pdf = listaPDFs[index];
    
    // Resetear variables
    pdfDocActual = null;
    totalPaginas = 1;
    paginaActual = 1;
    cargando = true;
    
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
        pdfDocActual = await pdfjsLib.getDocument(pdf.archivo).promise;
        totalPaginas = pdfDocActual.numPages;
        paginaActual = 1;
        
        cargando = false;
        await mostrarPagina(paginaActual);
        actualizarIndicadores();
        actualizarBotones();

    } catch (error) {
        cargando = false;
        console.error('Error al cargar PDF:', error);
        container.innerHTML = `
            <div style="color:white; text-align:center; padding: 40px;">
                <h2>❌ No se pudo cargar el documento</h2>
                <p style="opacity:0.7; margin-top:10px;">
                    Verifica que el archivo <strong>${pdf.archivo}</strong> exista en GitHub.
                </p>
            </div>
        `;
    }
}

// ============================================
// MOSTRAR PÁGINA (SIN REDUCIR, SIN DISTORSIONAR)
// ============================================
async function mostrarPagina(numeroPagina) {
    if (!pdfDocActual) return;

    const container = document.getElementById('pdf-page-container');
    
    // Animación de salida
    container.style.opacity = '0';
    container.style.transform = 'translateX(-20px)';
    
    await new Promise(resolve => setTimeout(resolve, 150));

    try {
        const page = await pdfDocActual.getPage(numeroPagina);
        
        // Tamaño real de la página a escala 1
        const viewportBase = page.getViewport({ scale: 1 });
        const ratio = viewportBase.width / viewportBase.height;
        
        // Espacio disponible real del contenedor
        const wrapper = document.querySelector('.pdf-wrapper');
        const anchoDisponible = wrapper.clientWidth - 20;
        const altoDisponible = wrapper.clientHeight - 20;
        
        // Calcular dimensiones respetando el ratio (para que llene lo máximo posible)
        let anchoFinal, altoFinal;
        
        if (anchoDisponible / altoDisponible > ratio) {
            // Limitado por altura → llena toda la altura
            altoFinal = altoDisponible;
            anchoFinal = altoFinal * ratio;
        } else {
            // Limitado por ancho → llena todo el ancho
            anchoFinal = anchoDisponible;
            altoFinal = anchoFinal / ratio;
        }
        
        // Renderizar a 2x de resolución para alta calidad (pero sin cambiar tamaño visual)
        const viewportRender = page.getViewport({ scale: 2 });
        
        const canvas = document.createElement('canvas');
        canvas.width = viewportRender.width;
        canvas.height = viewportRender.height;
        
        // Tamaño visual EXACTO (sin reducción, llena la pantalla)
        canvas.style.width = anchoFinal + 'px';
        canvas.style.height = altoFinal + 'px';
        canvas.style.display = 'block';
        
        const context = canvas.getContext('2d');
        await page.render({
            canvasContext: context,
            viewport: viewportRender
        }).promise;

        // Reemplazar contenido del contenedor
        container.innerHTML = '';
        container.appendChild(canvas);
        
        // Animación de entrada
        container.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        container.style.opacity = '1';
        container.style.transform = 'translateX(0)';
        
    } catch (error) {
        console.error('Error al renderizar página:', error);
    }
}

// ============================================
// NAVEGACIÓN
// ============================================
async function paginaAnterior() {
    if (cargando || !pdfDocActual) return;
    if (paginaActual <= 1) return;
    
    paginaActual--;
    await mostrarPagina(paginaActual);
    actualizarIndicadores();
    actualizarBotones();
}

async function paginaSiguiente() {
    if (cargando || !pdfDocActual) return;
    if (paginaActual >= totalPaginas) return;
    
    paginaActual++;
    await mostrarPagina(paginaActual);
    actualizarIndicadores();
    actualizarBotones();
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
    
    // Actualizar también los botones inferiores
    const botonesInferiores = document.querySelectorAll('.btn-control');
    if (botonesInferiores[0]) botonesInferiores[0].disabled = (paginaActual <= 1);
    if (botonesInferiores[1]) botonesInferiores[1].disabled = (paginaActual >= totalPaginas);
}

// ============================================
// CERRAR VISOR
// ============================================
function cerrarVisor() {
    document.getElementById('visor').classList.add('oculto');
    document.querySelector('.galeria-container').style.display = 'block';
    document.querySelector('.header').style.display = 'block';
    
    // Resetear todo
    pdfDocActual = null;
    paginaActual = 1;
    totalPaginas = 1;
    cargando = false;
    
    const container = document.getElementById('pdf-page-container');
    container.innerHTML = '';
    container.style.opacity = '1';
    container.style.transform = 'translateX(0)';
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
// RESIZE (re-renderizar al cambiar tamaño)
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
document.addEventListener('DOMContentLoaded', cargarListaPDFs);
