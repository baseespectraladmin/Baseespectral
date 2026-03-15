/* ============================================================
   1. CONFIGURACIÓN DE CONEXIÓN Y ESTADO GLOBAL
   ============================================================ */
const SUPABASE_URL = "https://nxktvjduooqfgzzrdfot.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54a3R2amR1b29xZmd6enJkZm90Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzExMTg1ODgsImV4cCI6MjA4NjY5NDU4OH0.4hYin09mna34MYg3cGdjtzIyvmZOntE5Xceofa9yTAs";
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const CREDENCIALES_ADMIN = { usuario: "missas", pass: "123" };

let adminLogueado = false; 
let editandoId = null; 
let graficaCargada = false;

/* ============================================================
   ESTRUCTURA DE MENÚ DINÁMICO Y CONTRASEÑAS
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

let menuData = JSON.parse(localStorage.getItem('menuData')) || MENU_ORIGINAL;
let contrasenasSecciones = JSON.parse(localStorage.getItem('contrasenasSecciones')) || {};

/* ============================================================
   2. NAVEGACIÓN Y CONTROL DE VISTA
   ============================================================ */

function mostrarSeccion(id) {
    if (contrasenasSecciones[id] && contrasenasSecciones[id].activa) {
        const pass = prompt("Esta sección requiere contraseña para acceder:");
        if (pass !== contrasenasSecciones[id].password) {
            alert("Acceso denegado: Contraseña incorrecta.");
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
        document.getElementById('dia').value = "";
        document.getElementById('mes').value = "";
    }
}

/* ============================================================
   3. GESTIÓN DE DATOS (LECTURA - READ)
   ============================================================ */

async function cargarArticulosDesdeNube(categoria) {
    const contenedor = document.getElementById('lista-' + categoria);
    if (!contenedor) return;

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

        contenedor.innerHTML = data.length === 0 ? '<p style="padding: 20px;">Sin registros en esta categoría.</p>' : '';

        data.forEach(art => {
            const item = document.createElement('div');
            item.className = 'articulo-item';
            
            let fechaTexto = `${art.anio}`;
            if (art.mes) fechaTexto = `${art.mes}/${fechaTexto}`;
            if (art.dia && art.mes) fechaTexto = `${art.dia}/${fechaTexto}`;

            let enlacesHtml = '';
            if (art.pdf_url) enlacesHtml += `<a href="${art.pdf_url}" target="_blank" style="color: var(--azul-medio); font-weight: bold; text-decoration: none; margin-right: 15px;">📄 Ver PDF</a>`;
            if (art.enlace_externo) enlacesHtml += `<a href="${art.enlace_externo}" target="_blank" style="color: var(--azul-medio); font-weight: bold; text-decoration: none; margin-right: 15px;">🔗 Link externo</a>`;
            if (!art.pdf_url && !art.enlace_externo) enlacesHtml = '<span style="color: var(--gris);">Sin archivos/enlaces</span>';

            item.innerHTML = `
                <h3>${art.titulo}</h3>
                <p><strong>Autores:</strong> ${art.autores} | <strong>Publicado en:</strong> ${fechaTexto}</p>
                <div style="margin-top: 10px; display: flex; gap: 20px; align-items: center;">
                    ${enlacesHtml}
                    ${adminLogueado ? `
                        <button onclick='prepararEdicion(${JSON.stringify(art).replace(/'/g, "&apos;")})' style="border:none; background:none; color: var(--azul-medio); cursor:pointer; font-weight:bold;">✏️ Editar</button>
                        <button onclick="borrarArticulo('${art.id}', '${categoria}')" style="border:none; background:none; color: #e74c3c; cursor:pointer; font-weight:bold;">🗑️ Borrar</button>
                    ` : ''}
                </div>
            `;
            contenedor.appendChild(item);
        });
    } catch (err) { 
        console.error("Error de lectura:", err);
        contenedor.innerHTML = '<p style="color:red; padding: 20px;">Error de servidor.</p>'; 
    }
}

/* ============================================================
   4. GESTIÓN DE DATOS (ESCRITURA - CUD)
   ============================================================ */

document.getElementById('formArticulo').addEventListener('submit', async function(e) {
    e.preventDefault();
    const cat = document.getElementById('categoria').value;
    const file = document.getElementById('archivo').files[0];
    const urlExt = document.getElementById('enlace_externo').value;
    let urlPublica = null;

    try {
        if (file) {
            const path = `${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
            const { error: upErr } = await _supabase.storage.from('pdfs').upload(path, file);
            if (upErr) throw upErr;
            urlPublica = _supabase.storage.from('pdfs').getPublicUrl(path).data.publicUrl;
        } 

        const payload = {
            titulo: document.getElementById('titulo').value,
            autores: document.getElementById('autores').value,
            anio: parseInt(document.getElementById('anio').value),
            dia: document.getElementById('dia').value ? parseInt(document.getElementById('dia').value) : null,
            mes: document.getElementById('mes').value ? parseInt(document.getElementById('mes').value) : null,
            categoria: cat
        };
        
        if (urlPublica) payload.pdf_url = urlPublica;
        if (urlExt) payload.enlace_externo = urlExt;

        if (editandoId) {
            const { error } = await _supabase.from('articulos').update(payload).eq('id', editandoId);
            if (error) throw error;
            alert("Registro actualizado.");
        } else {
            const { error } = await _supabase.from('articulos').insert([payload]);
            if (error) throw error;
            alert("Guardado con éxito.");
        }

        this.reset();
        editandoId = null;
        document.querySelector('.btn-subir').innerText = "Guardar en Base espectral";
        ajustarTipoEntrada();
        mostrarSeccion(cat); 
    } catch (err) { alert("Error: " + err.message); }
});

function prepararEdicion(art) {
    editandoId = art.id;
    document.getElementById('titulo').value = art.titulo;
    document.getElementById('autores').value = art.autores;
    document.getElementById('anio').value = art.anio;
    document.getElementById('dia').value = art.dia || "";
    document.getElementById('mes').value = art.mes || "";
    document.getElementById('categoria').value = art.categoria;
    
    ajustarTipoEntrada();
    if (art.enlace_externo) {
        document.getElementById('enlace_externo').value = art.enlace_externo;
    } else { document.getElementById('enlace_externo').value = ''; }
    
    document.querySelector('.btn-subir').innerText = "Actualizar Registro";
    mostrarSeccion('seccion-subir');
}

async function borrarArticulo(id, cat) {
    if (confirm("¿Confirmas la eliminación permanente de este registro?")) {
        try {
            const { error } = await _supabase.from('articulos').delete().eq('id', id);
            if (error) throw error;
            cargarArticulosDesdeNube(cat); 
        } catch (err) { alert(err.message); }
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
            if (!isNaN(w) && !isNaN(r)) { wavelength.push(w); reflectancia.push(r); }
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
            let i = 1; while (i < wavelength.length && x > wavelength[i]) i++;
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
                if(lambdaSpan) lambdaSpan.textContent = dataX.toFixed(2);
                if(reflSpan) reflSpan.textContent = yInterp.toFixed(2);
                if(tooltip) {
                    tooltip.style.left = (l + ((dataX - 400) / 400) * plotW) + 'px';
                    tooltip.style.top = (t + (1 - (yInterp / 100)) * plotH - 25) + 'px';
                    tooltip.style.display = 'block';
                }
            }
        });
    } catch (e) { console.error("Error en motor de gráfica:", e); }
}

/* ============================================================
   6. APOYO ADMINISTRATIVO, MENÚ DINÁMICO Y CONTRASEÑAS
   ============================================================ */

function verificarAdmin() {
    const u = document.getElementById('admin-user').value;
    const p = document.getElementById('admin-pass').value;
    if (u === CREDENCIALES_ADMIN.usuario && p === CREDENCIALES_ADMIN.pass) {
        adminLogueado = true;
        alert("Acceso administrativo activo.");
        renderizarMenu(); 
        mostrarSeccion('home');
    } else { alert("Credenciales incorrectas."); }
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

function renderizarMenu() {
    const navUl = document.getElementById('lista-navegacion');
    if (!navUl) return;

    const loginSubirHtml = `
        <li id="nav-login" style="${adminLogueado ? 'display:none;' : ''}"><a onclick="mostrarSeccion('seccion-login'); toggleMenu()">Admin Login</a></li>
        <li id="nav-subir" style="${adminLogueado ? '' : 'display:none;'}"><a onclick="mostrarSeccion('seccion-subir'); toggleMenu()" style="color: var(--verde-acento);">Subir artículo</a></li>
        <li id="nav-gestion-menu" style="${adminLogueado ? '' : 'display:none;'}"><a onclick="mostrarSeccion('seccion-gestion-menu'); toggleMenu()" style="color: #f39c12; font-weight:bold;">Gestión Menú</a></li>
    `;

    let menuHtml = '';
    menuData.forEach((item, index) => {
        if (item.type === 'link') {
            menuHtml += `<li><a onclick="mostrarSeccion('${item.target}'); toggleMenu()">${item.text}</a></li>`;
            asegurarSeccionDOM(item.target, item.text);
        } else if (item.type === 'dropdown') {
            let dropItems = '';
            item.items.forEach((sub, subIdx) => {
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
    
    if(adminLogueado) {
        actualizarSelectUbicacion();
        renderizarAdminMenuLista();
    }
}

function actualizarSelectUbicacion() {
    const select = document.getElementById('menu-ubicacion');
    if(!select) return;
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

function agregarElementoMenu() {
    const ubicacion = document.getElementById('menu-ubicacion').value;
    const tipo = document.getElementById('menu-tipo').value;
    const texto = document.getElementById('menu-texto').value;
    const idSec = document.getElementById('menu-id-seccion').value;
    const protegido = document.getElementById('menu-protegido').checked;
    const pass = document.getElementById('menu-pass').value;

    if (!texto) return alert("Debes ingresar un texto a mostrar en el menú.");
    if (tipo === 'link' && !idSec) return alert("Debes ingresar un ID para la sección (ej. mi-seccion).");

    const nuevoElemento = { type: tipo, text: texto };
    
    if (tipo === 'link') {
        nuevoElemento.target = idSec;
        if (protegido && pass) {
            contrasenasSecciones[idSec] = { activa: true, password: pass };
            localStorage.setItem('contrasenasSecciones', JSON.stringify(contrasenasSecciones));
        }
    } else if (tipo === 'dropdown') {
        nuevoElemento.items = [];
    }

    if (ubicacion === 'main') {
        menuData.push(nuevoElemento);
    } else {
        const idx = parseInt(ubicacion);
        if (menuData[idx] && menuData[idx].items) {
            menuData[idx].items.push(nuevoElemento);
        }
    }

    localStorage.setItem('menuData', JSON.stringify(menuData));
    alert("Elemento agregado correctamente. La página ha sido actualizada.");
    
    document.getElementById('menu-texto').value = '';
    document.getElementById('menu-id-seccion').value = '';
    renderizarMenu();
}

function eliminarElementoMenu(indexP, indexSub = null) {
    if (!confirm("⚠️ ADVERTENCIA: ¿Estás seguro de que deseas eliminar este elemento del menú?")) return;
    
    if (indexSub !== null) {
        menuData[indexP].items.splice(indexSub, 1);
    } else {
        menuData.splice(indexP, 1);
    }
    
    localStorage.setItem('menuData', JSON.stringify(menuData));
    renderizarMenu();
}

function editarElementoMenu(indexP, indexSub = null) {
    let item = (indexSub !== null) ? menuData[indexP].items[indexSub] : menuData[indexP];
    let nuevoTexto = prompt("Modifica el nombre a mostrar:", item.text);
    
    if (nuevoTexto !== null && nuevoTexto.trim() !== "") {
        item.text = nuevoTexto.trim();
        localStorage.setItem('menuData', JSON.stringify(menuData));
        renderizarMenu();
    }
}

function moverElementoMenu(indexP, indexSub, direccion) {
    let arr = (indexSub !== null) ? menuData[indexP].items : menuData;
    let idx = (indexSub !== null) ? indexSub : indexP;

    if (idx + direccion < 0 || idx + direccion >= arr.length) return; 

    let temp = arr[idx];
    arr[idx] = arr[idx + direccion];
    arr[idx + direccion] = temp;

    localStorage.setItem('menuData', JSON.stringify(menuData));
    renderizarMenu();
}

/* --- NUEVA FUNCIÓN PARA GESTIONAR CONTRASEÑAS EXISTENTES --- */
function gestionarContrasena(indexP, indexSub = null) {
    let item = (indexSub !== null) ? menuData[indexP].items[indexSub] : menuData[indexP];
    
    if (item.type !== 'link') return;

    const idSec = item.target;
    const tienePass = contrasenasSecciones[idSec] && contrasenasSecciones[idSec].activa;
    
    let msg = tienePass 
        ? `Esta sección ESTÁ PROTEGIDA.\nContraseña actual: ${contrasenasSecciones[idSec].password}\n\nIngresa una nueva contraseña para cambiarla, o deja el espacio en blanco para QUITAR la protección:`
        : `Esta sección NO ESTÁ PROTEGIDA.\n\nIngresa una contraseña para activarla (deja en blanco para cancelar):`;

    let nuevaPass = prompt(msg);

    if (nuevaPass === null) return; // Canceló el prompt

    if (nuevaPass.trim() === "") {
        if (tienePass) {
            contrasenasSecciones[idSec].activa = false;
            contrasenasSecciones[idSec].password = "";
            alert("Protección eliminada con éxito.");
        }
    } else {
        contrasenasSecciones[idSec] = { activa: true, password: nuevaPass.trim() };
        alert("Contraseña guardada y protección activada.");
    }

    localStorage.setItem('contrasenasSecciones', JSON.stringify(contrasenasSecciones));
    renderizarMenu(); // Refrescar los candados visualmente
}

function renderizarAdminMenuLista() {
    const lista = document.getElementById('lista-admin-menu');
    if(!lista) return;
    
    let html = '<ul style="list-style:none; padding:0; margin:0;">';
    menuData.forEach((item, idx) => {
        let isProtected = item.type === 'link' && contrasenasSecciones[item.target] && contrasenasSecciones[item.target].activa;
        let lockIcon = isProtected ? '🔒' : '🔓';
        let btnPass = item.type === 'link' ? `<button onclick="gestionarContrasena(${idx}, null)" style="border:none; background:none; cursor:pointer;" title="Gestionar Contraseña">${lockIcon}</button>` : '';

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
                let isProtectedSub = sub.type === 'link' && contrasenasSecciones[sub.target] && contrasenasSecciones[sub.target].activa;
                let lockIconSub = isProtectedSub ? '🔒' : '🔓';
                let btnPassSub = sub.type === 'link' ? `<button onclick="gestionarContrasena(${idx}, ${subIdx})" style="border:none; background:none; cursor:pointer;" title="Gestionar Contraseña">${lockIconSub}</button>` : '';

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

// Inicializar el menú al cargar la página
document.addEventListener('DOMContentLoaded', () => {
    renderizarMenu();
});