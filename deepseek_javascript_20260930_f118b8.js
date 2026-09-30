// ============================================
// CONFIGURACIÓN: Lista de tus PDFs
// ============================================
// Aquí agregas los PDFs que tengas en la carpeta "pdfs/"
// Solo cambia el "archivo" y el "titulo"

const misPDFs = [
    { archivo: "pdfs/documento1.pdf", titulo: "Guía de Declaración Jurada" },
    { archivo: "pdfs/documento2.pdf", titulo: "Manual de Usuario" },
    { archivo: "pdfs/documento3.pdf", titulo: "Informe Anual 2024" }
];

// ============================================
// VARIABLES GLOBALES
// ============================================
let pageFlip = null;
let paginaActual = 1;
let totalPaginas = 1;

// Configurar el worker de PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = 
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// ============================================
// CARGAR GALERÍA AL INICIAR
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    cargarGaleria();
});

function cargarGaleria() {
    const galeria = document.getElementById('galeria');
    galeria.innerHTML = '';

    misPDFs.forEach((pdf, index) => {
        const tarjeta = document.createElement('div');
        tarjeta.className = 'tarjeta';
        tarjeta.innerHTML = `
            <div class="icono">📕</div>
            <h3>${pdf.titulo}</h3>
        `;
        tarjeta.onclick = () => abrirFlipbook(index);
        galeria.appendChild(tarjeta);
    });
}

// ============================================
// ABRIR EL FLIPBOOK
// ============================================
async function abrirFlipbook(index) {
    const pdf = misPDFs[index];
    
    // Mostrar visor
    document.getElementById('galeria').style.display = 'none';
    document.querySelector('header').style.display = 'none';
    document.getElementById('visor').classList.remove('oculto');
    document.getElementById('titulo-libro').textContent = pdf.titulo;

    // Cargar el PDF
    const loadingTask = pdfjsLib.getDocument(pdf.archivo);
    
    try {
        const pdfDoc = await loadingTask.promise;
        totalPaginas = pdfDoc.numPages;

        // Contenedor del flipbook
        const flipbookContainer = document.getElementById('flipbook');
        flipbookContainer.innerHTML = '';

        // Crear las páginas como imágenes
        const paginasHTML = [];

        for (let i = 1; i <= totalPaginas; i++) {
            const page = await pdfDoc.getPage(i);
            const viewport = page.getViewport({ scale: 1.5 });
            
            const canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            canvas.className = 'pagina-pdf';
            
            const context = canvas.getContext('2d');
            await page.render({
                canvasContext: context,
                viewport: viewport
            }).promise;

            // Envolver el canvas en un div para StPageFlip
            const divPagina = document.createElement('div');
            divPagina.className = 'pagina';
            divPagina.appendChild(canvas);
            flipbookContainer.appendChild(divPagina);
        }

        // Inicializar StPageFlip
        pageFlip = new St.PageFlip(flipbookContainer, {
            width: 550,
            height: 733,
            size: 'stretch',
            minWidth: 300,
            maxWidth: 700,
            minHeight: 400,
            maxHeight: 950,
            showCover: true,
            mobileScrollSupport: true
        });

        pageFlip.loadFromHTML(document.querySelectorAll('.pagina'));

        // Actualizar indicador de página
        pageFlip.on('flip', (e) => {
            paginaActual = e.data + 1;
            document.getElementById('indicador-pagina').textContent = 
                `Página ${paginaActual} / ${totalPaginas}`;
        });

        document.getElementById('indicador-pagina').textContent = 
            `Página 1 / ${totalPaginas}`;

    } catch (error) {
        console.error('Error al cargar PDF:', error);
        alert('No se pudo cargar el PDF. Verifica que el archivo exista en la carpeta "pdfs/".');
    }
}

// ============================================
// CONTROLES
// ============================================
function paginaAnterior() {
    if (pageFlip) pageFlip.flipPrev();
}

function paginaSiguiente() {
    if (pageFlip) pageFlip.flipNext();
}

function cerrarVisor() {
    document.getElementById('visor').classList.add('oculto');
    document.getElementById('galeria').style.display = 'grid';
    document.querySelector('header').style.display = 'block';
    
    if (pageFlip) {
        pageFlip.destroy();
        pageFlip = null;
    }
}

// Navegación con teclado
document.addEventListener('keydown', (e) => {
    if (!pageFlip) return;
    if (e.key === 'ArrowLeft') paginaAnterior();
    if (e.key === 'ArrowRight') paginaSiguiente();
    if (e.key === 'Escape') cerrarVisor();
});