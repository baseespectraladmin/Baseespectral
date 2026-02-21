/* =========================================
   1. CONFIGURACIÓN Y ESTADO GLOBAL
   ========================================= */
const SUPABASE_URL = "https://nxktvjduooqfgzzrdfot.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54a3R2amR1b29xZmd6enJkZm90Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzExMTg1ODgsImV4cCI6MjA4NjY5NDU4OH0.4hYin09mna34MYg3cGdjtzIyvmZOntE5Xceofa9yTAs";
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const CREDENCIALES_ADMIN = { usuario: "missas", pass: "123" };
let adminLogueado = false; 
let editandoId = null; 
let graficaCargada = false;

/* =========================================
   2. NAVEGACIÓN Y CONTROL DE VISTA
   ========================================= */

function mostrarSeccion(id) {
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

// Controla qué campos se ven en el formulario según la categoría
function ajustarTipoEntrada() {
    const cat = document.getElementById('categoria').value;
    const isDifusion = (cat === 'art-difusion');

    document.getElementById('contenedor-fecha-difusion').style.display = isDifusion ? 'block' : 'none';
    document.getElementById('contenedor-pdf').style.display = isDifusion ? 'none' : 'block';
    document.getElementById('contenedor-url').style.display = isDifusion ? 'block' : 'none';

    if (!isDifusion) {
        document.getElementById('dia').value = "";
        document.getElementById('mes').value = "";
    }
}

/* =========================================
   3. GESTIÓN DE DATOS (LECTURA)
   ========================================= */

async function cargarArticulosDesdeNube(categoria) {
    const contenedor = document.getElementById('lista-' + categoria);
    if (!contenedor) return;

    contenedor.innerHTML = '<p style="padding: 20px; color: var(--gris);">Consultando base de datos...</p>';

    try {
        const { data, error } = await _supabase.from('articulos').select('*').eq('categoria', categoria).order('anio', { ascending: true }); 
        if (error) throw error;

        contenedor.innerHTML = data.length === 0 ? '<p style="padding: 20px;">Sin registros disponibles.</p>' : '';

        data.forEach(art => {
            const item = document.createElement('div');
            item.className = 'articulo-item';
            
            // Formateo de fecha: Día/Mes/Año
            let fechaDisplay = `${art.anio}`;
            if (art.mes) fechaDisplay = `${art.mes}/${fechaDisplay}`;
            if (art.dia && art.mes) fechaDisplay = `${art.dia}/${fechaDisplay}`;

            const icono = art.categoria === 'art-difusion' ? '🔗' : '📄';

            item.innerHTML = `
                <h3>${art.titulo}</h3>
                <p><strong>Autores:</strong> ${art.autores} | <strong>Fecha:</strong> ${fechaDisplay}</p>
                <div style="margin-top: 10px; display: flex; gap: 20px; align-items: center;">
                    <a href="${art.pdf_url}" target="_blank" style="color: var(--azul-medio); font-weight: bold; text-decoration: none;">${icono} Ver Contenido</a>
                    ${adminLogueado ? `
                        <button onclick='prepararEdicion(${JSON.stringify(art).replace(/'/g, "&apos;")})' style="border:none; background:none; color: var(--azul-medio); cursor:pointer; font-weight:bold;">✏️ Editar</button>
                        <button onclick="borrarArticulo('${art.id}', '${categoria}')" style="border:none; background:none; color: #e74c3c; cursor:pointer; font-weight:bold;">🗑️ Eliminar</button>
                    ` : ''}
                </div>
            `;
            contenedor.appendChild(item);
        });
    } catch (err) { contenedor.innerHTML = '<p style="color:red; padding: 20px;">Error de conexión.</p>'; }
}

/* =========================================
   4. ACCIONES ADMINISTRATIVAS (CRUD)
   ========================================= */

// Guardar o Actualizar
document.getElementById('formArticulo').addEventListener('submit', async function(e) {
    e.preventDefault();
    const cat = document.getElementById('categoria').value;
    const file = document.getElementById('archivo').files[0];
    const urlExt = document.getElementById('enlace_externo').value;
    let urlPublica = null;

    try {
        // Manejo de archivo vs URL
        if (cat !== 'art-difusion' && file) {
            const path = `${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
            const { error: upErr } = await _supabase.storage.from('pdfs').upload(path, file);
            if (upErr) throw upErr;
            urlPublica = _supabase.storage.from('pdfs').getPublicUrl(path).data.publicUrl;
        } else if (cat === 'art-difusion') {
            urlPublica = urlExt;
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
        mostrarSeccion(cat); // Te mantiene en la sección actual
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
    if (art.categoria === 'art-difusion') document.getElementById('enlace_externo').value = art.pdf_url;
    
    document.querySelector('.btn-subir').innerText = "Actualizar Registro";
    mostrarSeccion('seccion-subir');
}

async function borrarArticulo(id, cat) {
    if (confirm("¿Eliminar permanentemente este registro?")) {
        try {
            const { error } = await _supabase.from('articulos').delete().eq('id', id);
            if (error) throw error;
            cargarArticulosDesdeNube(cat);
        } catch (err) { alert(err.message); }
    }
}

function verificarAdmin() {
    const u = document.getElementById('admin-user').value;
    const p = document.getElementById('admin-pass').value;
    if (u === CREDENCIALES_ADMIN.usuario && p === CREDENCIALES_ADMIN.pass) {
        adminLogueado = true;
        document.getElementById('nav-subir').style.display = 'block';
        document.getElementById('nav-login').style.display = 'none';
        alert("Modo administrador activo.");
        mostrarSeccion('home');
    } else { alert("Credenciales incorrectas."); }
}

/* =========================================
   5. GRÁFICA Y MENÚ MÓVIL
   ========================================= */

async function inicializarGrafica() {
    const gd = document.getElementById('grafica-reflexion');
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

        const trace = { x: wavelength, y: reflectancia, mode: 'lines', line: { color: '#3282b8', width: 2.5 } };
        const layout = { 
            title: '<b>Espectro de Reflexión Difusa - UPT</b>',
            xaxis: { title: 'Longitud de onda (nm)', range: [400, 800] },
            yaxis: { title: 'Reflexión (%)', range: [0, 100] },
            margin: { l: 60, r: 30, t: 80, b: 60 }
        };

        Plotly.newPlot(gd, [trace], layout, { responsive: true });
        graficaCargada = true;
    } catch (e) { console.error("Error gráfica:", e); }
}

function toggleMenu() {
    const nav = document.getElementById('nav-menu');
    if (window.innerWidth <= 768) nav.classList.toggle('nav-active');
}