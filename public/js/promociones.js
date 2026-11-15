// Sección Promociones: descuentos vigentes, próximas ofertas y promociones por categoría.
import { $, t, loc, escapar, al, almacen, toast, estado, productos, promocionesVisibles, nombreCategoria, tonoCategoria,
  listaCategorias, imagenProducto, cuentaRegresiva, revelar } from "./core.js";

const fechaLarga = (iso) =>
  new Intl.DateTimeFormat(estado.idioma === "en" ? "en-US" : "es-CO", { weekday: "long", day: "numeric", month: "long" }).format(new Date(iso));

function pintar() {
  const { vigentes, proximas } = promocionesVisibles();
  const recordadas = new Set(almacen.leer("recordatorios", []));

  $("#promo-vigentes").innerHTML = vigentes.map((p) => `
    <article class="promo revelar">
      ${p.foto ? `<img class="promo__foto" src="${escapar(p.foto)}" alt="" loading="lazy" />` : ""}
      <div class="promo__velo"></div>
      <div class="promo__contenido">
        <span class="promo__badge">−${p.descuento}%</span>
        <h3 class="titulo-display">${escapar(loc(p.titulo))}</h3>
        <p>${escapar(loc(p.texto))}</p>
        <span class="promo__cuenta">${t("comun.terminaEn")} <strong data-cuenta="${p.hasta}">${cuentaRegresiva(p.hasta)}</strong></span>
        <button type="button" class="btn btn--claro btn--sm" data-promo-cats="${escapar(p.categorias.join("|"))}">${t("promo.verProductos")}</button>
      </div>
    </article>`).join("");

  $("#promo-proximas").innerHTML = proximas.map((p) => `
    <article class="proxima revelar">
      <div>
        <span class="sobretitulo">${escapar(fechaLarga(p.desde))}</span>
        <h3 class="titulo-display">${escapar(loc(p.titulo))}</h3>
        <p>${escapar(loc(p.texto))}</p>
        <small>${p.categorias.length ? p.categorias.map(nombreCategoria).join(" · ") : t("promo.todas")}</small>
      </div>
      <div class="proxima__lado">
        <span class="proxima__desc">${t("comun.hasta", { n: p.descuento })}</span>
        <span class="proxima__cuenta">${t("comun.empiezaEn")}<strong data-cuenta="${p.desde}">${cuentaRegresiva(p.desde)}</strong></span>
        <button type="button" class="btn ${recordadas.has(p.id) ? "btn--contorno" : "btn--negro"} btn--sm" data-recordar="${p.id}">
          ${recordadas.has(p.id) ? `✓ ${t("promo.recordado")}` : t("promo.recordar")}
        </button>
      </div>
    </article>`).join("");

  const todos = productos();
  $("#promo-categorias").innerHTML = listaCategorias()
    .map((c) => ({ c, lista: todos.filter((p) => p.categoria === c) }))
    .filter(({ lista }) => lista.length)
    .map(({ c, lista }) => {
      const con = lista.filter((p) => p.descuento > 0).sort((a, b) => b.descuento - a.descuento);
      const tono = tonoCategoria(c);
      return `
        <button type="button" class="promo-cat revelar ${tono.oscuro ? "promo-cat--oscura" : ""}" style="--tono:${tono.tono}"
          data-promo-cats="${escapar(c)}">
          <span class="promo-cat__media">${imagenProducto(con[0] ?? lista[0])}</span>
          <span class="promo-cat__texto">
            <strong>${escapar(nombreCategoria(c))}</strong>
            <span class="promo-cat__desc">${con.length ? t("comun.hasta", { n: con[0].descuento }) : t("promo.sinDesc")}</span>
            <small>${t("comun.productos", { n: con.length })}</small>
          </span>
        </button>`;
    }).join("");
  revelar();
}

export function iniciarPromociones() {
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-recordar]");
    if (!b) return;
    const lista = new Set(almacen.leer("recordatorios", []));
    if (lista.has(b.dataset.recordar)) lista.delete(b.dataset.recordar);
    else {
      lista.add(b.dataset.recordar);
      toast(t("promo.recordadoToast"));
    }
    almacen.guardar("recordatorios", [...lista]);
    pintar();
  });
  // Los botones [data-promo-cats] los maneja Inicio (abren el catálogo filtrado).
  al("productos", pintar);
  al("promociones", pintar);
  al("idioma", pintar);
  pintar();
}
