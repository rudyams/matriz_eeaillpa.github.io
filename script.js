// ============================================
// CONFIGURACIÓN DEL WORKER DE PDF.JS
// ============================================
pdfjsLib.GlobalWorkerOptions.workerSrc = 
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// ============================================
// VARIABLES GLOBALES
// ============================================
let pageFlip = null;
let paginaActual = 1;
let totalPaginas = 1;
let listaPDFs = [];

// ============================================
// CARGAR LA LISTA DE PDFs DESDE lista.json
// ============================================
async function cargarListaPDFs() {
    try {
        const respuesta = await fetch('lista.json');
        if (!respuesta.ok) throw new Error('No se encontró lista.json');
        listaPDFs = await respuesta.json();
        cargarGaleria();
    } catch (error) {
        console.error('Error al cargar lista.json:', error);
        document.getElementById('galeria').innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; color: white; padding: 40px;">
                <h2>⚠️ No se encontró el archivo lista.json</h2>
                <p>Crea un archivo llamado <strong>lista.json</strong> en la raíz de tu repositorio 
                con la lista de tus PDFs. Ejemplo:</p>
                <pre style="background: rgba(0,0,0,0.3); padding: 20px; border-radius: 8px; 
                            text-align: left; margin-top: 15px; overflow-x: auto;">
[
    { "archivo": "pdf/matriz1.pdf", "titulo": "Matriz 1" },
    { "archivo": "pdf/matriz2.pdf", "titulo": "Matriz 2" }
]</pre>
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
            <div style="grid-column: 1/-1; text-align: center; color: white; padding: 40px;">
                <h2>📭 No hay documentos en la lista</h2>
                <p>Agrega tus PDFs al archivo lista.json</p>
            </div>
        `;
        return;
    }

    listaPDFs.forEach((pdf, index) => {
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
    const pdf = listaPDFs[index];
    
    document.getElementById('galeria').style.display = 'none';
    document.querySelector('header').style.display = 'none';
    document.getElementById('visor').classList.remove('oculto');
    document.getElementById('titulo-libro').textContent = pdf.titulo;

    const loadingTask = pdfjsLib.getDocument(pdf.archivo);
    
    try {
        const pdfDoc = await loadingTask.promise;
        totalPaginas = pdfDoc.numPages;

        const flipbookContainer = document.getElementById('flipbook');
        flipbookContainer.innerHTML = '';

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

            const divPagina = document.createElement('div');
            divPagina.className = 'pagina';
            divPagina.appendChild(canvas);
            flipbookContainer.appendChild(divPagina);
        }

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

        pageFlip.on('flip', (e) => {
            paginaActual = e.data + 1;
            document.getElementById('indicador-pagina').textContent = 
                `Página ${paginaActual} / ${totalPaginas}`;
        });

        document.getElementById('indicador-pagina').textContent = 
            `Página 1 / ${totalPaginas}`;

    } catch (error) {
        console.error('Error al cargar PDF:', error);
        alert('No se pudo cargar el PDF. Verifica que el archivo exista en la carpeta "pdf/" y que el nombre coincida exactamente con el de lista.json.');
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

document.addEventListener('keydown', (e) => {
    if (!pageFlip) return;
    if (e.key === 'ArrowLeft') paginaAnterior();
    if (e.key === 'ArrowRight') paginaSiguiente();
    if (e.key === 'Escape') cerrarVisor();
});

document.addEventListener('DOMContentLoaded', cargarListaPDFs);