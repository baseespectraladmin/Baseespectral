/* ============================================================
   1. CONFIGURACIÓN DE CONEXIÓN Y ESTADO GLOBAL
   ============================================================ */
const SUPABASE_URL = "https://nxktvjduooqfgzzrdfot.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54a3R2amR1b29xZmd6enJkZm90Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzExMTg1ODgsImV4cCI6MjA4NjY5NDU4OH0.4hYin09mna34MYg3cGdjtzIyvmZOntE5Xceofa9yTAs";
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const CREDENCIALES_ADMIN = { usuario: "missas", pass: "123" };
const CONFIG_ID = 1;

let adminLogueado = false;
let editandoId = null;
let graficaCargada = false;
let menuData = [];
let contrasenasSecciones = {};
let articulosRelacionados = {};
let articuloPrincipalActivo = null;
let editandoRelacionado = null;
let articulosCache = [];
let categoriaActivaListado = null;

/* ============================================================
   ESTRUCTURA DE MENÚ DINÁMICO Y CONTRASEÑAS (AHORA EN LA NUBE)
   ============================================================ */
const MENU_ORIGINAL = [
    { type: 'link', target: 'home', text: 'Home' },
    { type: 'dropdown', text: 'Espectros ▾', items: [
        { type: 'link', target: 'espectros-absorbancia', text: 'Espectros de absorbancia' },
        { type: 'link', target: 'espectros-reflexion', text: 'Espectros de reflexión difusa' }
    ]},
    { type: 'dropdown', text: 'Artículos ▾', items: [
        { type: 'link', target: 'art-difusion', text: 'Artículos de difusión' },
        { type: 'link', target: 'art-investigacion', text: 'Artículos de investigación' },
        { type: 'link', target: 'art-referencias', text: 'Artículos de referencias' }
    ]},
    { type: 'dropdown', text: 'Reflexión Difusa ▾', items: [
        { type: 'link', target: 'ref-agricola', text: 'Reflexión Difusa' },
        { type: 'link', target: 'ref-aplicada', text: 'Reflexión Difusa aplicada' },
        { type: 'link', target: 'ref-simulada', text: 'Reflexión Difusa simulada' }
    ]},
    { type: 'dropdown', text: 'Fluorescencia ▾', items: [
        { type: 'separator', text: 'Fluorescencia Médica' },
        { type: 'link', target: 'fluo-med-aplicada', text: 'F. Médica Aplicada' },
        { type: 'link', target: 'fluo-med-simulada', text: 'F. Médica Simulada' },
        { type: 'separator', text: 'Fluorescencia Agrícola' },
        { type: 'link', target: 'fluo-agri-aplicada', text: 'F. Agrícola Aplicada' },
        { type: 'link', target: 'fluo-agri-simulada', text: 'F. Agrícola Simulada' }
    ]}
];

function normalizarRelacionado(rel, index = 0) {
    return {
        id: rel.id || `rel-${Date.now()}-${index}-${Math.random().toString(16).slice(2, 8)}`,
        titulo: rel.titulo || 'Sin título',
        autores: rel.autores || 'Sin autores',
        anio: rel.anio ? parseInt(rel.anio, 10) : null,
        dia: rel.dia ? parseInt(rel.dia, 10) : null,
        mes: rel.mes ? parseInt(rel.mes, 10) : null,
        pdf_url: rel.pdf_url || null,
        enlace_externo: rel.enlace_externo || null,
        categoria: rel.categoria || null,
        parentId: rel.parentId || null,
        createdAt: rel.createdAt || new Date().toISOString()
    };
}

function normalizarRelacionados(raw) {
    const limpio = {};
    Object.entries(raw || {}).forEach(([parentId, lista]) => {
        limpio[parentId] = Array.isArray(lista)
            ? lista.map((item, index) => normalizarRelacionado({ ...item, parentId }, index))
            : [];
    });
    return limpio;
}

function obtenerFechaTexto(item) {
    let fechaTexto = item.anio ? `${item.anio}` : 'Sin año';
    if (item.mes) fechaTexto = `${item.mes}/${fechaTexto}`;
    if (item.dia && item.mes) fechaTexto = `${item.dia}/${fechaTexto}`;
    return fechaTexto;
}

function escaparHtml(valor) {
    return String(valor ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

async function cargarConfiguracionMenu() {
    try {
        const { data } = await _supabase.from('configuracion').select('*').eq('id', CONFIG_ID).single();
        const hayDatosEnNube = data && data.menu_data;

        if (hayDatosEnNube) {
            menuData = data.menu_data;
            if (data.contrasenas) contrasenasSecciones = data.contrasenas;
            articulosRelacionados = normalizarRelacionados(data.articulos_relacionados || {});
        } else {
            const localMenu = JSON.parse(localStorage.getItem('menuData'));
            const localPass = JSON.parse(localStorage.getItem('contrasenasSecciones'));
            const localRelacionados = JSON.parse(localStorage.getItem('articulosRelacionados') || '{}');

            if (localMenu) {
                menuData = localMenu;
                if (localPass) contrasenasSecciones = localPass;
                articulosRelacionados = normalizarRelacionados(localRelacionados);
                await guardarConfiguracionMenu();
                console.log('¡Datos locales rescatados y subidos a la nube!');
            } else {
                menuData = MENU_ORIGINAL;
            }
        }
        renderizarMenu();
    } catch (e) {
        console.error('Error al cargar configuración:', e);
        menuData = MENU_ORIGINAL;
        renderizarMenu();
    }
}

async function guardarConfiguracionMenu() {
    try {
        localStorage.setItem('menuData', JSON.stringify(menuData));
        localStorage.setItem('contrasenasSecciones', JSON.stringify(contrasenasSecciones));
        localStorage.setItem('articulosRelacionados', JSON.stringify(articulosRelacionados));

        await _supabase.from('configuracion').upsert({
            id: CONFIG_ID,
            menu_data: menuData,
            contrasenas: contrasenasSecciones,
            articulos_relacionados: articulosRelacionados
        });
    } catch (e) {
        console.error('Error al guardar configuración en la nube:', e);
    }
}

/* ============================================================
   2. NAVEGACIÓN Y CONTROL DE VISTA
   ============================================================ */

function mostrarSeccion(id) {
    // MODIFICACIÓN APLICADA: Si es administrador, pasa directamente.
    if (!adminLogueado && contrasenasSecciones[id] && contrasenasSecciones[id].activa) {
        const pass = prompt('Esta sección requiere contraseña para acceder:');
        if (pass !== contrasenasSecciones[id].password) {
            alert('Acceso denegado: Contraseña incorrecta.');
            return;
        }
    }

    const secciones = document.querySelectorAll('.seccion-contenido');
    secciones.forEach(s => s.classList.remove('seccion-activa'));

    const seccionSeleccionada = document.getElementById(id);
    if (seccionSeleccionada) {
        seccionSeleccionada.classList.add('seccion-activa');
        window.scrollTo(0, 0);

        const listaContenedor = document.getElementById('lista-' + id);
        if (listaContenedor) cargarArticulosDesdeNube(id);
    }

    if (id === 'espectros-reflexion' && !graficaCargada) inicializarGrafica();
}

function ajustarTipoEntrada() {
    const cat = document.getElementById('categoria').value;
    const esDifusion = (cat === 'art-difusion');
    document.getElementById('contenedor-fecha-difusion').style.display = esDifusion ? 'block' : 'none';

    if (!esDifusion) {
        document.getElementById('dia').value = '';
        document.getElementById('mes').value = '';
    }
}

function actualizarResumenArticuloPadre() {
    const select = document.getElementById('articulo-padre');
    const resumen = document.getElementById('articulo-padre-resumen');
    if (!select || !resumen) return;

    const opcion = select.options[select.selectedIndex];
    resumen.textContent = opcion && opcion.value
        ? `Publicación principal seleccionada: ${opcion.textContent}`
        : 'Selecciona la publicación principal desde el listado de artículos.';
}

async function cargarOpcionesArticulosPrincipales(categoriaPreferida = '', selectedId = '') {
    const select = document.getElementById('articulo-padre');
    if (!select) return;

    try {
        if (!articulosCache.length) {
            const { data, error } = await _supabase
                .from('articulos')
                .select('*')
                .order('categoria', { ascending: true })
                .order('anio', { ascending: false })
                .order('mes', { ascending: false })
                .order('dia', { ascending: false });
            if (error) throw error;
            articulosCache = data || [];
        }

        const articulosFiltrados = categoriaPreferida
            ? articulosCache.filter(art => art.categoria === categoriaPreferida)
            : articulosCache;

        if (!articulosFiltrados.length) {
            select.innerHTML = '<option value="">No hay publicaciones principales disponibles todavía</option>';
            actualizarResumenArticuloPadre();
            return;
        }

        select.innerHTML = '<option value="">Selecciona una publicación principal</option>' + articulosFiltrados
            .map(art => `<option value="${art.id}">${escaparHtml(art.titulo)} — ${obtenerFechaTexto(art)} (${escaparHtml(art.categoria)})</option>`)
            .join('');

        if (selectedId) select.value = selectedId;
        if (!select.value && articulosFiltrados[0]) select.value = articulosFiltrados[0].id;
        actualizarResumenArticuloPadre();
    } catch (error) {
        console.error('No se pudieron cargar publicaciones principales:', error);
        select.innerHTML = '<option value="">Error al cargar publicaciones principales</option>';
        actualizarResumenArticuloPadre();
    }
}

function toggleFormularioRelacionado(mostrar = false) {
    const bloque = document.getElementById('bloque-relacionados');
    if (!bloque) return;
    bloque.style.display = mostrar ? 'block' : 'none';

    if (!mostrar) {
        document.getElementById('modo-relacionado').checked = false;
        document.getElementById('articulo-padre').value = '';
        document.getElementById('relacionado-id').value = '';
        editandoRelacionado = null;
        actualizarResumenArticuloPadre();
        return;
    }

    cargarOpcionesArticulosPrincipales(document.getElementById('categoria').value, document.getElementById('articulo-padre').value);
}

function cambiarModoRelacionado() {
    const activo = document.getElementById('modo-relacionado').checked;
    toggleFormularioRelacionado(activo);
}

function abrirFormularioNuevoPrincipal(categoria = '') {
    reiniciarFormularioArticulo();
    if (categoria) document.getElementById('categoria').value = categoria;
    ajustarTipoEntrada();
    mostrarSeccion('seccion-subir');
}

async function abrirFormularioRelacionadoDesdeListado(categoria = '') {
    reiniciarFormularioArticulo();
    document.getElementById('modo-relacionado').checked = true;
    if (categoria) document.getElementById('categoria').value = categoria;
    toggleFormularioRelacionado(true);
    await cargarOpcionesArticulosPrincipales(document.getElementById('categoria').value);
    document.getElementById('titulo-form').innerText = 'Agregar artículo relacionado dentro de una publicación';
    document.querySelector('#formArticulo .btn-subir').innerText = 'Guardar artículo relacionado';
    ajustarTipoEntrada();
    mostrarSeccion('seccion-subir');
}

async function prepararAltaRelacionado(articulo) {
    document.getElementById('modo-relacionado').checked = true;
    document.getElementById('categoria').value = articulo.categoria;
    document.getElementById('relacionado-id').value = '';
    editandoRelacionado = null;
    toggleFormularioRelacionado(true);
    await cargarOpcionesArticulosPrincipales(articulo.categoria, articulo.id);
    document.getElementById('titulo-form').innerText = `Agregar material relacionado a: ${articulo.titulo}`;
    document.querySelector('#formArticulo .btn-subir').innerText = 'Guardar artículo relacionado';
    ajustarTipoEntrada();
    mostrarSeccion('seccion-subir');
}

function reiniciarFormularioArticulo() {
    document.getElementById('formArticulo').reset();
    editandoId = null;
    editandoRelacionado = null;
    document.getElementById('relacionado-id').value = '';
    document.getElementById('titulo-form').innerText = 'Gestión de Contenido';
    document.querySelector('#formArticulo .btn-subir').innerText = 'Guardar en Base espectral';
    toggleFormularioRelacionado(false);
    ajustarTipoEntrada();
}

/* ============================================================
   3. GESTIÓN DE DATOS (LECTURA - READ)
   ============================================================ */

function construirLinksArticulo(item, compacto = false) {
    const links = [];
    if (item.pdf_url) {
        links.push(`<a href="${item.pdf_url}" target="_blank" rel="noopener" class="articulo-link">📄 ${compacto ? 'Abrir PDF' : 'Ver PDF'}</a>`);
        links.push(`<a href="${item.pdf_url}" download class="articulo-link articulo-link-sec">⬇️ Descargar PDF</a>`);
    }
    if (item.enlace_externo) {
        links.push(`<a href="${item.enlace_externo}" target="_blank" rel="noopener" class="articulo-link">🔗 Link externo</a>`);
    }
    return links.length ? links.join('') : '<span style="color: var(--gris);">Sin archivos/enlaces</span>';
}

function obtenerRelacionados(parentId) {
    return (articulosRelacionados[parentId] || []).map((rel, index) => normalizarRelacionado({ ...rel, parentId }, index));
}

function renderizarDetalleArticuloPrincipal(articulo) {
    const detalle = document.getElementById('detalle-articulo');
    if (!detalle || !articulo) return;

    articuloPrincipalActivo = articulo;
    const relacionados = obtenerRelacionados(articulo.id);
    const listaRelacionados = relacionados.length
        ? relacionados.map((rel, index) => `
            <div class="related-item">
                <div>
                    <span class="related-bullet">${index + 1}.</span>
                    <div>
                        <h4>${escaparHtml(rel.titulo)}</h4>
                        <p><strong>Autores:</strong> ${escaparHtml(rel.autores)} | <strong>Publicado en:</strong> ${obtenerFechaTexto(rel)}</p>
                        <div class="related-links">${construirLinksArticulo(rel, true)}</div>
                    </div>
                </div>
                ${adminLogueado ? `
                    <div class="related-admin-actions">
                        <button onclick="editarRelacionado('${articulo.id}', '${rel.id}')">✏️ Editar</button>
                        <button onclick="moverRelacionado('${articulo.id}', ${index}, -1)">⬆️</button>
                        <button onclick="moverRelacionado('${articulo.id}', ${index}, 1)">⬇️</button>
                        <button class="danger" onclick="eliminarRelacionado('${articulo.id}', '${rel.id}')">🗑️</button>
                    </div>
                ` : ''}
            </div>
        `).join('')
        : '<p class="sin-relacionados">Todavía no hay artículos relacionados en esta serie.</p>';

    detalle.innerHTML = `
        <div class="serie-header">
            <div>
                <span class="serie-badge">Serie / publicación principal</span>
                <h2>${escaparHtml(articulo.titulo)}</h2>
                <p><strong>Autores:</strong> ${escaparHtml(articulo.autores)} | <strong>Publicado en:</strong> ${obtenerFechaTexto(articulo)}</p>
            </div>
            <div class="serie-header-actions">
                ${adminLogueado ? `<button class="btn-subir btn-secundario" onclick='prepararAltaRelacionado(${JSON.stringify(articulo).replace(/'/g, '&apos;')})'>➕ Agregar relacionado</button>` : ''}
                <button class="btn-subir btn-secundario" onclick="volverAListado('${articulo.categoria}')">← Volver al listado</button>
            </div>
        </div>
        <div class="principal-links">${construirLinksArticulo(articulo)}</div>
        <div class="related-tree">
            <h3>Tutorial Series Illumination</h3>
            <div class="related-list">
                ${listaRelacionados}
            </div>
        </div>
    `;

    mostrarSeccion('detalle-articulo');
}

function volverAListado(categoria) {
    articuloPrincipalActivo = null;
    mostrarSeccion(categoria);
}

async function cargarArticulosDesdeNube(categoria) {
    const contenedor = document.getElementById('lista-' + categoria);
    if (!contenedor) return;

    categoriaActivaListado = categoria;
    contenedor.innerHTML = '<p style="padding: 20px; color: var(--gris);">Consultando base de datos espectral...</p>';

    try {
        const { data, error } = await _supabase
            .from('articulos')
            .select('*')
            .eq('categoria', categoria)
            .order('anio', { ascending: false })
            .order('mes', { ascending: false })
            .order('dia', { ascending: false });

        if (error) throw error;

        articulosCache = [
            ...articulosCache.filter(art => art.categoria !== categoria),
            ...data
        ];

        const toolbarHtml = adminLogueado ? `
            <div class="admin-toolbar-lista">
                <button class="btn-outline" onclick="abrirFormularioNuevoPrincipal('${categoria}')">➕ Nuevo artículo principal</button>
                <button class="btn-outline" onclick="abrirFormularioRelacionadoDesdeListado('${categoria}')">📚 Agregar relacionado en esta lista</button>
            </div>
        ` : '';

        contenedor.innerHTML = toolbarHtml + (data.length === 0 ? '<p style="padding: 20px;">Sin registros en esta categoría.</p>' : '');

        data.forEach(art => {
            const item = document.createElement('div');
            item.className = 'articulo-item';
            const relacionados = obtenerRelacionados(art.id);

            item.innerHTML = `
                <div class="articulo-main-info">
                    <div>
                        <h3>${escaparHtml(art.titulo)}</h3>
                        <p><strong>Autores:</strong> ${escaparHtml(art.autores)} | <strong>Publicado en:</strong> ${obtenerFechaTexto(art)}</p>
                        <p class="related-counter">Serie con ${relacionados.length} artículo(s) relacionado(s).</p>
                    </div>
                    <div class="articulo-actions-inline">
                        <button class="btn-outline" onclick='renderizarDetalleArticuloPrincipal(${JSON.stringify(art).replace(/'/g, '&apos;')})'>📚 Abrir publicación</button>
                        ${adminLogueado ? `<button class="btn-outline" onclick='prepararAltaRelacionado(${JSON.stringify(art).replace(/'/g, '&apos;')})'>➕ Agregar dentro</button>` : ''}
                    </div>
                </div>
                <div class="articulo-links-row">${construirLinksArticulo(art)}</div>
                ${adminLogueado ? `
                    <div class="admin-actions-row">
                        <button onclick='prepararEdicion(${JSON.stringify(art).replace(/'/g, '&apos;')})'>✏️ Editar principal</button>
                        <button onclick="borrarArticulo('${art.id}', '${categoria}')" class="danger">🗑️ Borrar principal</button>
                    </div>
                ` : ''}
            `;
            contenedor.appendChild(item);
        });
    } catch (err) {
        console.error('Error de lectura:', err);
        contenedor.innerHTML = '<p style="color:red; padding: 20px;">Error de servidor.</p>';
    }
}

/* ============================================================
   4. GESTIÓN DE DATOS (ESCRITURA - CUD)
   ============================================================ */

function sanitizarNombreArchivo(nombreOriginal) {
    const nombreNormalizado = nombreOriginal
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/\s+/g, '_')
        .replace(/[^a-zA-Z0-9._-]/g, '_')
        .replace(/_+/g, '_')
        .replace(/-+/g, '-')
        .replace(/^[_.-]+|[_.-]+$/g, '');

    const partes = nombreNormalizado.split('.');
    if (partes.length <= 1) return nombreNormalizado || 'archivo_pdf';

    const extension = partes.pop().toLowerCase().replace(/[^a-z0-9]/g, '');
    const base = partes.join('.').replace(/[^a-zA-Z0-9_-]/g, '_').replace(/^[_-]+|[_-]+$/g, '');
    return `${base || 'archivo_pdf'}.${extension || 'pdf'}`;
}

async function subirPdfASupabase(file) {
    const nombreSeguro = sanitizarNombreArchivo(file.name);
    const path = `${Date.now()}_${nombreSeguro}`;

    try {
        const { error } = await _supabase.storage.from('pdfs').upload(path, file, {
            cacheControl: '3600',
            upsert: false
        });

        if (error) {
            throw new Error(`No se pudo subir el PDF. ${error.message}`);
        }

        return _supabase.storage.from('pdfs').getPublicUrl(path).data.publicUrl;
    } catch (error) {
        console.error('Error al subir PDF a Supabase:', error);
        throw new Error('Falló la carga del PDF. Verifica el nombre del archivo, tu conexión o las políticas RLS del bucket pdfs. Detalle: ' + error.message);
    }
}

document.getElementById('formArticulo').addEventListener('submit', async function (e) {
    e.preventDefault();
    const cat = document.getElementById('categoria').value;
    const file = document.getElementById('archivo').files[0];
    const urlExt = document.getElementById('enlace_externo').value;
    const modoRelacionado = document.getElementById('modo-relacionado').checked;
    const parentId = document.getElementById('articulo-padre').value;
    let urlPublica = null;

    try {
        if (file) {
            urlPublica = await subirPdfASupabase(file);
        }

        const payload = {
            titulo: document.getElementById('titulo').value,
            autores: document.getElementById('autores').value,
            anio: parseInt(document.getElementById('anio').value, 10),
            dia: document.getElementById('dia').value ? parseInt(document.getElementById('dia').value, 10) : null,
            mes: document.getElementById('mes').value ? parseInt(document.getElementById('mes').value, 10) : null,
            categoria: cat
        };

        if (urlPublica) payload.pdf_url = urlPublica;
        if (urlExt) payload.enlace_externo = urlExt;

        if (modoRelacionado) {
            if (!parentId) throw new Error('Selecciona el artículo principal al que pertenece este material relacionado.');
            const relacionados = obtenerRelacionados(parentId);
            const relacionadoId = document.getElementById('relacionado-id').value || `rel-${Date.now()}`;
            const indiceActual = relacionados.findIndex(rel => rel.id === relacionadoId);
            const anterior = indiceActual >= 0 ? relacionados[indiceActual] : null;

            const nuevoRelacionado = normalizarRelacionado({
                ...anterior,
                ...payload,
                id: relacionadoId,
                parentId,
                pdf_url: urlPublica || anterior?.pdf_url || null,
                enlace_externo: urlExt || anterior?.enlace_externo || null
            });

            if (indiceActual >= 0) {
                relacionados[indiceActual] = nuevoRelacionado;
            } else {
                relacionados.push(nuevoRelacionado);
            }

            articulosRelacionados[parentId] = relacionados;
            await guardarConfiguracionMenu();
            alert(indiceActual >= 0 ? 'Artículo relacionado actualizado.' : 'Artículo relacionado agregado dentro de la publicación.');
            const principal = articuloPrincipalActivo && articuloPrincipalActivo.id === parentId
                ? articuloPrincipalActivo
                : { id: parentId, categoria: cat, titulo: document.getElementById('titulo-form').innerText.replace('Agregar material relacionado a: ', '') };
            reiniciarFormularioArticulo();
            mostrarSeccion(cat);
            if (articuloPrincipalActivo && articuloPrincipalActivo.id === parentId) {
                renderizarDetalleArticuloPrincipal(articuloPrincipalActivo);
            }
            return;
        }

        articulosCache = [];

        if (editandoId) {
            const { error } = await _supabase.from('articulos').update(payload).eq('id', editandoId);
            if (error) throw error;
            alert('Registro actualizado.');
        } else {
            const { error } = await _supabase.from('articulos').insert([payload]);
            if (error) throw error;
            alert('Guardado con éxito.');
        }

        reiniciarFormularioArticulo();
        mostrarSeccion(cat);
    } catch (err) {
        alert('Error: ' + err.message);
    }
});

function prepararEdicion(art) {
    editandoId = art.id;
    editandoRelacionado = null;
    document.getElementById('titulo').value = art.titulo;
    document.getElementById('autores').value = art.autores;
    document.getElementById('anio').value = art.anio;
    document.getElementById('dia').value = art.dia || '';
    document.getElementById('mes').value = art.mes || '';
    document.getElementById('categoria').value = art.categoria;
    document.getElementById('enlace_externo').value = art.enlace_externo || '';

    toggleFormularioRelacionado(false);
    ajustarTipoEntrada();
    document.getElementById('titulo-form').innerText = 'Editar publicación principal';
    document.querySelector('#formArticulo .btn-subir').innerText = 'Actualizar Registro';
    mostrarSeccion('seccion-subir');
}

async function editarRelacionado(parentId, relacionadoId) {
    const relacionado = obtenerRelacionados(parentId).find(rel => rel.id === relacionadoId);
    const principal = articuloPrincipalActivo;
    if (!relacionado) return;

    editandoId = null;
    editandoRelacionado = relacionadoId;
    document.getElementById('titulo').value = relacionado.titulo;
    document.getElementById('autores').value = relacionado.autores;
    document.getElementById('anio').value = relacionado.anio || '';
    document.getElementById('dia').value = relacionado.dia || '';
    document.getElementById('mes').value = relacionado.mes || '';
    document.getElementById('categoria').value = relacionado.categoria || principal?.categoria || '';
    document.getElementById('enlace_externo').value = relacionado.enlace_externo || '';
    document.getElementById('modo-relacionado').checked = true;
    document.getElementById('relacionado-id').value = relacionadoId;
    toggleFormularioRelacionado(true);
    await cargarOpcionesArticulosPrincipales(relacionado.categoria || principal?.categoria || '', parentId);
    ajustarTipoEntrada();
    document.getElementById('titulo-form').innerText = `Editar relacionado de: ${principal?.titulo || 'publicación principal'}`;
    document.querySelector('#formArticulo .btn-subir').innerText = 'Actualizar artículo relacionado';
    mostrarSeccion('seccion-subir');
}

async function moverRelacionado(parentId, indice, direccion) {
    const lista = obtenerRelacionados(parentId);
    const nuevoIndice = indice + direccion;
    if (nuevoIndice < 0 || nuevoIndice >= lista.length) return;

    [lista[indice], lista[nuevoIndice]] = [lista[nuevoIndice], lista[indice]];
    articulosRelacionados[parentId] = lista;
    await guardarConfiguracionMenu();
    if (articuloPrincipalActivo && articuloPrincipalActivo.id === parentId) {
        renderizarDetalleArticuloPrincipal(articuloPrincipalActivo);
    }
}

async function eliminarRelacionado(parentId, relacionadoId) {
    if (!confirm('¿Eliminar este artículo relacionado de la publicación?')) return;
    articulosRelacionados[parentId] = obtenerRelacionados(parentId).filter(rel => rel.id !== relacionadoId);
    await guardarConfiguracionMenu();
    if (articuloPrincipalActivo && articuloPrincipalActivo.id === parentId) {
        renderizarDetalleArticuloPrincipal(articuloPrincipalActivo);
    }
}

async function borrarArticulo(id, cat) {
    if (confirm('¿Confirmas la eliminación permanente de este registro?')) {
        try {
            const { error } = await _supabase.from('articulos').delete().eq('id', id);
            if (error) throw error;
            delete articulosRelacionados[id];
            await guardarConfiguracionMenu();
            cargarArticulosDesdeNube(cat);
        } catch (err) {
            alert(err.message);
        }
    }
}

/* ============================================================
   5. GRÁFICA CON RADAR MATEMÁTICO (PLOTLY)
   ============================================================ */

async function inicializarGrafica() {
    const gd = document.getElementById('grafica-reflexion');
    const tooltip = document.getElementById('custom-tooltip');
    const lambdaSpan = document.getElementById('lambda-value');
    const reflSpan = document.getElementById('refl-value');
    if (!gd) return;

    try {
        const resp = await fetch('css/data/reflexion.csv');
        const texto = await resp.text();
        const filas = texto.trim().split('\n').filter(l => l.trim() !== '');
        const wavelength = [], reflectancia = [];

        filas.slice(1).forEach(l => {
            const cols = l.split(/,|\t|;/).map(s => s.trim());
            const w = parseFloat(cols[0]), r = parseFloat(cols[1]);
            if (!isNaN(w) && !isNaN(r)) {
                wavelength.push(w);
                reflectancia.push(r);
            }
        });

        const trace = { x: wavelength, y: reflectancia, mode: 'lines', line: { color: '#3282b8', width: 2.5, shape: 'spline' }, hoverinfo: 'none' };
        const hoverTrace = { x: [0], y: [0], mode: 'markers', marker: { size: 12, color: '#006847', line: { width: 3, color: '#ffffff' } }, hoverinfo: 'none' };
        const layout = {
            title: '<b>Espectro de Reflexión Difusa - UPT</b>',
            xaxis: { title: 'Longitud de onda (nm)', gridcolor: '#e2e8f0', range: [400, 800] },
            yaxis: { title: 'Reflexión (%)', gridcolor: '#e2e8f0', range: [0, 100] },
            paper_bgcolor: '#fcfdfe', plot_bgcolor: '#ffffff', hovermode: false, showlegend: false, margin: { l: 60, r: 30, t: 80, b: 60 }
        };

        await Plotly.newPlot(gd, [trace, hoverTrace], layout, { responsive: true, displayModeBar: false });
        graficaCargada = true;

        function interpY(x) {
            if (x <= wavelength[0]) return reflectancia[0];
            if (x >= wavelength[wavelength.length - 1]) return reflectancia[reflectancia.length - 1];
            let i = 1;
            while (i < wavelength.length && x > wavelength[i]) i++;
            const x1 = wavelength[i - 1], x2 = wavelength[i], y1 = reflectancia[i - 1], y2 = reflectancia[i];
            return y1 + ((x - x1) / (x2 - x1)) * (y2 - y1);
        }

        gd.addEventListener('mousemove', (ev) => {
            const rect = gd.getBoundingClientRect();
            const fl = gd._fullLayout;
            const l = fl.margin.l, t = fl.margin.t;
            const plotW = rect.width - (l + fl.margin.r), plotH = rect.height - (t + fl.margin.b);
            const dataX = 400 + ((ev.clientX - rect.left - l) / plotW) * 400;

            if (dataX >= 400 && dataX <= 800) {
                const yInterp = interpY(dataX);
                Plotly.restyle(gd, { x: [[dataX]], y: [[yInterp]] }, [1]);
                if (lambdaSpan) lambdaSpan.textContent = dataX.toFixed(2);
                if (reflSpan) reflSpan.textContent = yInterp.toFixed(2);
                if (tooltip) {
                    tooltip.style.left = (l + ((dataX - 400) / 400) * plotW) + 'px';
                    tooltip.style.top = (t + (1 - (yInterp / 100)) * plotH - 25) + 'px';
                    tooltip.style.display = 'block';
                }
            }
        });
    } catch (e) {
        console.error('Error en motor de gráfica:', e);
    }
}

/* ============================================================
   6. APOYO ADMINISTRATIVO, MENÚ DINÁMICO Y CONTRASEÑAS
   ============================================================ */

function verificarAdmin() {
    const u = document.getElementById('admin-user').value;
    const p = document.getElementById('admin-pass').value;
    if (u === CREDENCIALES_ADMIN.usuario && p === CREDENCIALES_ADMIN.pass) {
        adminLogueado = true;
        alert('Acceso administrativo activo.');
        renderizarMenu();
        mostrarSeccion('home');
    } else {
        alert('Credenciales incorrectas.');
    }
}

function toggleMenu() {
    const nav = document.getElementById('nav-menu');
    if (window.innerWidth <= 768) nav.classList.toggle('nav-active');
}

function asegurarSeccionDOM(id, titulo) {
    if (!document.getElementById(id) && id !== 'home' && !id.startsWith('seccion-')) {
        const div = document.createElement('div');
        div.id = id;
        div.className = 'seccion-contenido container';
        div.innerHTML = `<h1>${titulo}</h1><hr><div id="lista-${id}" class="lista-container"></div>`;
        document.body.appendChild(div);
    }
}

function actualizarSelectCategorias() {
    const select = document.getElementById('categoria');
    if (!select) return;

    let html = '';
    menuData.forEach(item => {
        if (item.type === 'link' && item.target !== 'home' && !item.target.startsWith('seccion-')) {
            html += `<option value="${item.target}">${item.text}</option>`;
        } else if (item.type === 'dropdown') {
            let optionsHtml = '';
            item.items.forEach(sub => {
                if (sub.type === 'link' && sub.target !== 'home' && !sub.target.startsWith('seccion-')) {
                    optionsHtml += `<option value="${sub.target}">${sub.text}</option>`;
                }
            });
            if (optionsHtml !== '') {
                html += `<optgroup label="${item.text.replace(' ▾', '')}">${optionsHtml}</optgroup>`;
            }
        }
    });

    select.innerHTML = html;
}

function renderizarMenu() {
    const navUl = document.getElementById('lista-navegacion');
    if (!navUl) return;

    const loginSubirHtml = `
        <li id="nav-login" style="${adminLogueado ? 'display:none;' : ''}"><a onclick="mostrarSeccion('seccion-login'); toggleMenu()">Admin Login</a></li>
        <li id="nav-subir" style="${adminLogueado ? '' : 'display:none;'}"><a onclick="mostrarSeccion('seccion-subir'); toggleMenu()" style="color: var(--verde-acento);">Subir artículo</a></li>
        <li id="nav-gestion-menu" style="${adminLogueado ? '' : 'display:none;'}"><a onclick="mostrarSeccion('seccion-gestion-menu'); toggleMenu()" style="color: #f39c12; font-weight:bold;">Gestión Menú</a></li>
    `;

    let menuHtml = '';
    menuData.forEach(item => {
        if (item.type === 'link') {
            menuHtml += `<li><a onclick="mostrarSeccion('${item.target}'); toggleMenu()">${item.text}</a></li>`;
            asegurarSeccionDOM(item.target, item.text);
        } else if (item.type === 'dropdown') {
            let dropItems = '';
            item.items.forEach(sub => {
                if (sub.type === 'link') {
                    dropItems += `<a onclick="mostrarSeccion('${sub.target}'); toggleMenu()">${sub.text}</a>`;
                    asegurarSeccionDOM(sub.target, sub.text);
                } else if (sub.type === 'separator') {
                    dropItems += `<span class="menu-separator">${sub.text}</span>`;
                }
            });
            menuHtml += `
                <li class="has-dropdown">
                    <a class="nav-link">${item.text}</a>
                    <div class="dropdown">${dropItems}</div>
                </li>
            `;
        }
    });

    navUl.innerHTML = menuHtml + loginSubirHtml;

    actualizarSelectCategorias();

    if (adminLogueado) {
        actualizarSelectUbicacion();
        renderizarAdminMenuLista();
    }
}

function actualizarSelectUbicacion() {
    const select = document.getElementById('menu-ubicacion');
    if (!select) return;
    select.innerHTML = '<option value="main">Barra Principal</option>';
    menuData.forEach((item, index) => {
        if (item.type === 'dropdown') {
            select.innerHTML += `<option value="${index}">Dentro del menú: ${item.text}</option>`;
        }
    });
}

function cambiarTipoMenu() {
    const tipo = document.getElementById('menu-tipo').value;
    document.getElementById('grupo-menu-id').style.display = (tipo === 'link') ? 'block' : 'none';
    document.getElementById('grupo-menu-pass').style.display = (tipo === 'link') ? 'block' : 'none';
}

function toggleMenuPass() {
    const isChecked = document.getElementById('menu-protegido').checked;
    document.getElementById('menu-pass').style.display = isChecked ? 'block' : 'none';
}

async function agregarElementoMenu() {
    const ubicacion = document.getElementById('menu-ubicacion').value;
    const tipo = document.getElementById('menu-tipo').value;
    const texto = document.getElementById('menu-texto').value;
    const idSec = document.getElementById('menu-id-seccion').value;
    const protegido = document.getElementById('menu-protegido').checked;
    const pass = document.getElementById('menu-pass').value;

    if (!texto) return alert('Debes ingresar un texto a mostrar en el menú.');
    if (tipo === 'link' && !idSec) return alert('Debes ingresar un ID para la sección (ej. mi-seccion).');

    const nuevoElemento = { type: tipo, text: texto };

    if (tipo === 'link') {
        nuevoElemento.target = idSec;
        if (protegido && pass) {
            contrasenasSecciones[idSec] = { activa: true, password: pass };
        }
    } else if (tipo === 'dropdown') {
        nuevoElemento.items = [];
    }

    if (ubicacion === 'main') {
        menuData.push(nuevoElemento);
    } else {
        const idx = parseInt(ubicacion, 10);
        if (menuData[idx] && menuData[idx].items) {
            menuData[idx].items.push(nuevoElemento);
        }
    }

    await guardarConfiguracionMenu();
    alert('Elemento agregado correctamente. La página ha sido actualizada para todos.');

    document.getElementById('menu-texto').value = '';
    document.getElementById('menu-id-seccion').value = '';
    renderizarMenu();
}

async function eliminarElementoMenu(indexP, indexSub = null) {
    if (!confirm('⚠️ ADVERTENCIA: ¿Estás seguro de que deseas eliminar este elemento del menú?')) return;

    if (indexSub !== null) {
        menuData[indexP].items.splice(indexSub, 1);
    } else {
        menuData.splice(indexP, 1);
    }

    await guardarConfiguracionMenu();
    renderizarMenu();
}

async function editarElementoMenu(indexP, indexSub = null) {
    const item = (indexSub !== null) ? menuData[indexP].items[indexSub] : menuData[indexP];
    const nuevoTexto = prompt('Modifica el nombre a mostrar:', item.text);

    if (nuevoTexto !== null && nuevoTexto.trim() !== '') {
        item.text = nuevoTexto.trim();
        await guardarConfiguracionMenu();
        renderizarMenu();
    }
}

async function moverElementoMenu(indexP, indexSub, direccion) {
    const arr = (indexSub !== null) ? menuData[indexP].items : menuData;
    const idx = (indexSub !== null) ? indexSub : indexP;

    if (idx + direccion < 0 || idx + direccion >= arr.length) return;

    [arr[idx], arr[idx + direccion]] = [arr[idx + direccion], arr[idx]];
    await guardarConfiguracionMenu();
    renderizarMenu();
}

async function gestionarContrasena(indexP, indexSub = null) {
    const item = (indexSub !== null) ? menuData[indexP].items[indexSub] : menuData[indexP];

    if (item.type !== 'link') return;

    const idSec = item.target;
    const tienePass = contrasenasSecciones[idSec] && contrasenasSecciones[idSec].activa;

    const msg = tienePass
        ? `Esta sección ESTÁ PROTEGIDA.\nContraseña actual: ${contrasenasSecciones[idSec].password}\n\nIngresa una nueva contraseña para cambiarla, o deja el espacio en blanco para QUITAR la protección:`
        : 'Esta sección NO ESTÁ PROTEGIDA.\n\nIngresa una contraseña para activarla (deja en blanco para cancelar):';

    const nuevaPass = prompt(msg);

    if (nuevaPass === null) return;

    if (nuevaPass.trim() === '') {
        if (tienePass) {
            contrasenasSecciones[idSec].activa = false;
            contrasenasSecciones[idSec].password = '';
            alert('Protección eliminada con éxito.');
        }
    } else {
        contrasenasSecciones[idSec] = { activa: true, password: nuevaPass.trim() };
        alert('Contraseña guardada y protección activada.');
    }

    await guardarConfiguracionMenu();
    renderizarMenu();
}

function renderizarAdminMenuLista() {
    const lista = document.getElementById('lista-admin-menu');
    if (!lista) return;

    let html = '<ul style="list-style:none; padding:0; margin:0;">';
    menuData.forEach((item, idx) => {
        const isProtected = item.type === 'link' && contrasenasSecciones[item.target] && contrasenasSecciones[item.target].activa;
        const lockIcon = isProtected ? '🔒' : '🔓';
        const btnPass = item.type === 'link' ? `<button onclick="gestionarContrasena(${idx}, null)" style="border:none; background:none; cursor:pointer;" title="Gestionar Contraseña">${lockIcon}</button>` : '';

        html += `
            <li style="margin-bottom:10px; padding:12px; background:#fff; border:1px solid #ddd; border-radius:6px; box-shadow:0 2px 4px rgba(0,0,0,0.02); display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <strong style="color: var(--azul-oscuro);">${item.text}</strong> <span style="font-size:12px; color:#888;">(${item.type})</span>
                </div>
                <div style="display: flex; gap: 8px;">
                    ${btnPass}
                    <button onclick="moverElementoMenu(${idx}, null, -1)" style="border:none; background:none; cursor:pointer;" title="Subir">⬆️</button>
                    <button onclick="moverElementoMenu(${idx}, null, 1)" style="border:none; background:none; cursor:pointer;" title="Bajar">⬇️</button>
                    <button onclick="editarElementoMenu(${idx}, null)" style="border:none; background:none; cursor:pointer;" title="Editar Nombre">✏️</button>
                    <button onclick="eliminarElementoMenu(${idx}, null)" style="color:red; border:none; background:none; cursor:pointer; font-weight:bold;" title="Borrar">🗑️</button>
                </div>
            </li>
        `;
        if (item.type === 'dropdown' && item.items) {
            html += '<ul style="list-style:none; padding-left:20px; margin-top:10px;">';
            item.items.forEach((sub, subIdx) => {
                const isProtectedSub = sub.type === 'link' && contrasenasSecciones[sub.target] && contrasenasSecciones[sub.target].activa;
                const lockIconSub = isProtectedSub ? '🔒' : '🔓';
                const btnPassSub = sub.type === 'link' ? `<button onclick="gestionarContrasena(${idx}, ${subIdx})" style="border:none; background:none; cursor:pointer;" title="Gestionar Contraseña">${lockIconSub}</button>` : '';

                html += `
                    <li style="margin-bottom:8px; padding:8px; background:#f4f7fb; border:1px solid #eee; border-radius:4px; display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            ${sub.text} <span style="font-size:12px; color:#888;">(${sub.type})</span>
                        </div>
                        <div style="display: flex; gap: 8px;">
                            ${btnPassSub}
                            <button onclick="moverElementoMenu(${idx}, ${subIdx}, -1)" style="border:none; background:none; cursor:pointer;" title="Subir">⬆️</button>
                            <button onclick="moverElementoMenu(${idx}, ${subIdx}, 1)" style="border:none; background:none; cursor:pointer;" title="Bajar">⬇️</button>
                            <button onclick="editarElementoMenu(${idx}, ${subIdx})" style="border:none; background:none; cursor:pointer;" title="Editar Nombre">✏️</button>
                            <button onclick="eliminarElementoMenu(${idx}, ${subIdx})" style="color:#e74c3c; border:none; background:none; cursor:pointer;" title="Borrar">🗑️</button>
                        </div>
                    </li>
                `;
            });
            html += '</ul>';
        }
    });
    html += '</ul>';
    lista.innerHTML = html;
}

// INICIALIZADOR
document.addEventListener('DOMContentLoaded', () => {
    menuData = MENU_ORIGINAL;
    cargarConfiguracionMenu();
    ajustarTipoEntrada();
    toggleFormularioRelacionado(false);
    document.getElementById('articulo-padre').addEventListener('change', actualizarResumenArticuloPadre);
    document.getElementById('categoria').addEventListener('change', () => {
        ajustarTipoEntrada();
        if (document.getElementById('modo-relacionado').checked) {
            cargarOpcionesArticulosPrincipales(document.getElementById('categoria').value);
        }
    });
});