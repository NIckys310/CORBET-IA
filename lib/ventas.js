// Ventas de DEMOSTRACIÓN para el panel administrativo (valores en COP).
// Serie determinista (no aleatoria) para que el gráfico sea estable.
const BASE_MES = [1.82, 1.64, 1.71, 1.69, 1.88, 1.95, 1.9, 2.04, 2.11, 2.26, 2.71, 3.18]; // miles de millones

const POR_CATEGORIA = {
  "Celulares": 0.21, "Televisores": 0.17, "Computadores y tablets": 0.15, "Electrodomésticos": 0.14,
  "Videojuegos": 0.08, "Audio": 0.06, "Pequeños electrodomésticos": 0.05, "Hogar": 0.05,
  "Cámaras y drones": 0.03, "Relojes inteligentes": 0.03, "Deportes": 0.02, "Cuidado personal": 0.01,
};

export function obtenerVentas() {
  const hoy = new Date();
  const meses = BASE_MES.map((v, i) => {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - (BASE_MES.length - 1 - i), 1);
    return { mes: d.toISOString().slice(0, 7), ventas: Math.round(v * 1e9) };
  });
  const ultimo = meses.at(-1).ventas;
  return {
    demo: true,
    meses,
    porCategoria: Object.entries(POR_CATEGORIA).map(([categoria, f]) => ({ categoria, ventas: Math.round(ultimo * f) })),
    kpis: { ventasMes: ultimo, ventasMesAnterior: meses.at(-2).ventas, pedidosMes: 4120, ticketPromedio: Math.round(ultimo / 4120) },
  };
}

export function ventasHandler(req, res) {
  res.status(200).json(obtenerVentas());
}
