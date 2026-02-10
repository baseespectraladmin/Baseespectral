function mostrarSeccion(id) {
    // 1. Ocultar todas las secciones
    const secciones = document.querySelectorAll('.seccion-contenido');
    secciones.forEach(s => s.classList.remove('seccion-activa'));

    // 2. Mostrar la sección que corresponde al ID
    const seccionSeleccionada = document.getElementById(id);
    if (seccionSeleccionada) {
        seccionSeleccionada.classList.add('seccion-activa');
        // Scroll automático hacia arriba para que se vea el título
        window.scrollTo(0, 0);
    } else {
        console.error("No se encontró la sección con ID:", id);
    }
}

// Lógica para guardar (Simulación local)
document.getElementById('formArticulo').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const datos = {
        titulo: document.getElementById('titulo').value,
        autores: document.getElementById('autores').value,
        anio: document.getElementById('anio').value,
        categoria: document.getElementById('categoria').value,
        archivo: document.getElementById('archivo').files[0].name
    };

    const item = document.createElement('div');
    item.className = 'articulo-item';
    item.innerHTML = `
        <h3>${datos.titulo}</h3>
        <p><strong>Autores:</strong> ${datos.autores} | <strong>Año:</strong> ${datos.anio}</p>
        <p style="color: var(--azul-medio)">📄 Archivo: ${datos.archivo}</p>
    `;

    document.getElementById('lista-' + datos.categoria).appendChild(item);
    
    alert("¡Guardado en " + datos.categoria + "!");
    this.reset();
    mostrarSeccion(datos.categoria);
});