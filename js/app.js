// --- FUNCIÓN: Controla la visibilidad de campos según categoría ---
function ajustarTipoEntrada() {
    const categoria = document.getElementById('categoria').value;
    const contenedorPdf = document.getElementById('contenedor-pdf');
    const contenedorUrl = document.getElementById('contenedor-url');
    const contenedorFecha = document.getElementById('contenedor-fecha-difusion');

    if (categoria === 'art-difusion') {
        // Modo Difusión: Mostramos URL y Fecha extra, ocultamos PDF
        if(contenedorPdf) contenedorPdf.style.display = 'none';
        if(contenedorUrl) contenedorUrl.style.display = 'block';
        if(contenedorFecha) contenedorFecha.style.display = 'block';
    } else {
        // Modo Estándar: Mostramos PDF, ocultamos el resto
        if(contenedorPdf) contenedorPdf.style.display = 'block';
        if(contenedorUrl) contenedorUrl.style.display = 'none';
        if(contenedorFecha) contenedorFecha.style.display = 'none';
        // Limpiamos los valores de mes/dia si no es difusión
        document.getElementById('mes').value = "";
        document.getElementById('dia').value = "";
    }
}

// --- FUNCIÓN: Carga y muestra los artículos (Modificada para mostrar fecha completa) ---
async function cargarArticulosDesdeNube(categoria) {
    const contenedor = document.getElementById('lista-' + categoria);
    if (!contenedor) return;
    contenedor.innerHTML = '<p style="color: var(--gris); padding: 20px;">Consultando Base de Datos...</p>';

    try {
        const { data, error } = await _supabase.from('articulos').select('*').eq('categoria', categoria).order('anio', { ascending: true }); 
        if (error) throw error;
        contenedor.innerHTML = data.length === 0 ? '<p style="padding: 20px;">No hay registros.</p>' : '';

        data.forEach(art => {
            const item = document.createElement('div');
            item.className = 'articulo-item';
            
            // Construcción de la fecha: Muestra Día/Mes/Año solo si existen
            let formatoFecha = `${art.anio}`;
            if (art.mes) formatoFecha = `${art.mes}/${formatoFecha}`;
            if (art.dia && art.mes) formatoFecha = `${art.dia}/${formatoFecha}`;

            const esDifusion = art.categoria === 'art-difusion';
            const etiqueta = esDifusion ? '🔗 Ver Artículo' : '📄 Ver PDF';

            const controlAdmin = adminLogueado ? `
                <div style="margin-top: 10px; display: flex; gap: 15px;">
                    <button onclick='prepararEdicion(${JSON.stringify(art).replace(/'/g, "&apos;")})' style="background:none; border:none; color: var(--azul-medio); cursor:pointer; font-size: 13px; font-weight:bold;">✏️ Editar</button>
                    <button onclick="borrarArticulo('${art.id}', '${categoria}')" style="background:none; border:none; color: #e74c3c; cursor:pointer; font-size: 13px; font-weight:bold;">🗑️ Eliminar</button>
                </div>` : '';

            item.innerHTML = `
                <h3>${art.titulo}</h3>
                <p><strong>Autores:</strong> ${art.autores} | <strong>Fecha:</strong> ${formatoFecha}</p>
                <div style="margin-top: 5px; display: flex; gap: 20px; align-items: center;">
                    <a href="${art.pdf_url}" target="_blank" style="color: var(--azul-medio); font-weight: bold; text-decoration: none;">${etiqueta}</a>
                    ${controlAdmin}
                </div>
            `;
            contenedor.appendChild(item);
        });
    } catch (err) { contenedor.innerHTML = '<p style="color: red;">Error de conexión.</p>'; }
}

// --- EVENTO: Guardar / Editar (Maneja el envío a Supabase) ---
formArticulo.addEventListener('submit', async function(e) {
    e.preventDefault();
    const categoriaSel = document.getElementById('categoria').value;
    const archivoPDF = document.getElementById('archivo').files[0];
    const urlExterna = document.getElementById('enlace_externo').value;
    let urlFinal = null;

    try {
        // Lógica de archivos/links
        if (categoriaSel === 'art-difusion') {
            if (!urlExterna && !editandoId) throw new Error("Falta la URL.");
            urlFinal = urlExterna;
        } else if (archivoPDF) {
            const nombre = `${Date.now()}_${archivoPDF.name.replace(/\s+/g, '_')}`;
            const { error: upErr } = await _supabase.storage.from('pdfs').upload(nombre, archivoPDF);
            if (upErr) throw upErr;
            const { data: { publicUrl } } = _supabase.storage.from('pdfs').getPublicUrl(nombre);
            urlFinal = publicUrl;
        }

        // Construcción del objeto para la base de datos
        const datosArticulo = {
            titulo: document.getElementById('titulo').value,
            autores: document.getElementById('autores').value,
            anio: parseInt(document.getElementById('anio').value),
            mes: document.getElementById('mes').value ? parseInt(document.getElementById('mes').value) : null,
            dia: document.getElementById('dia').value ? parseInt(document.getElementById('dia').value) : null,
            categoria: categoriaSel
        };
        if (urlFinal) datosArticulo.pdf_url = urlFinal;

        if (editandoId) {
            await _supabase.from('articulos').update(datosArticulo).eq('id', editandoId);
            alert("Registro actualizado.");
        } else {
            await _supabase.from('articulos').insert([datosArticulo]);
            alert("Guardado con éxito.");
        }

        this.reset();
        editandoId = null;
        ajustarTipoEntrada(); // Resetea la vista del formulario
        cargarArticulosDesdeNube(categoriaSel);
        mostrarSeccion(categoriaSel);
    } catch (err) { alert(err.message); }
});

// --- FUNCIÓN: Preparar Edición (Carga datos al formulario) ---
function prepararEdicion(art) {
    editandoId = art.id;
    document.getElementById('titulo').value = art.titulo;
    document.getElementById('autores').value = art.autores;
    document.getElementById('anio').value = art.anio;
    document.getElementById('mes').value = art.mes || "";
    document.getElementById('dia').value = art.dia || "";
    document.getElementById('categoria').value = art.categoria;
    
    ajustarTipoEntrada(); // Muestra/oculta campos según la categoría del artículo a editar
    if (art.categoria === 'art-difusion') document.getElementById('enlace_externo').value = art.pdf_url;

    const btn = document.querySelector('#formArticulo .btn-subir');
    if(btn) btn.innerText = "Actualizar Registro";
    mostrarSeccion('seccion-subir');
}