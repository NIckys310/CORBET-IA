// Sucursales de Corbeta / Alkosto.
// Solo se marcan como "verificada" las direcciones confirmadas en fuentes públicas.
// Las demás ciudades tienen tienda según alkosto.com, pero su dirección y horario están por confirmar:
// complétalas aquí (o conecta la base de datos real) cuando tengas los datos oficiales.

export const LINEAS = {
  ventas: "(601) 746 8001",
  servicio: "(601) 407 3033",
  web: "https://www.alkosto.com",
};

const porConfirmar = (ciudad) => ({
  id: `alkosto-${ciudad.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")}`,
  marca: "Alkosto",
  tipo: "tienda",
  nombre: `Alkosto ${ciudad}`,
  ciudad,
  direccion: null,
  horario: null,
  verificada: false,
});

export const SUCURSALES = [
  {
    id: "alkosto-venecia",
    marca: "Alkosto",
    tipo: "tienda",
    nombre: "Alkosto Venecia",
    ciudad: "Bogotá",
    direccion: "Calle 45A Sur # 51-90, barrio Venecia",
    horario: null,
    verificada: true,
  },
  {
    id: "corbeta-bogota",
    marca: "Corbeta",
    tipo: "oficina",
    nombre: "Colombiana de Comercio S.A. (Corbeta)",
    ciudad: "Bogotá",
    direccion: "Calle 11 N° 31A-42",
    horario: null,
    verificada: true,
    nota: "Dirección publicada por la empresa para trámites de datos personales.",
  },
  ...["Medellín", "Cali", "Bucaramanga", "Villavicencio", "Tunja", "Manizales", "Pereira", "Pasto"].map(porConfirmar),
];

export function textoSucursales() {
  return `Sucursales conocidas de Corbeta / Alkosto (JSON). "verificada: false" significa que la ciudad tiene tienda pero la dirección y el horario NO están confirmados: en ese caso no inventes dirección ni horario; sugiere confirmar en ${LINEAS.web} o en las líneas de ventas ${LINEAS.ventas} / servicio ${LINEAS.servicio}. Ningún horario está confirmado.
${JSON.stringify(SUCURSALES)}`;
}

export function sucursalesHandler(req, res) {
  res.status(200).json({ lineas: LINEAS, sucursales: SUCURSALES });
}
