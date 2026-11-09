// Definición de los campos del formulario de estimación (HU03).
// kind: 'decimal' admite decimales; 'integer' solo enteros.
export const FIELD_GROUPS = [
  {
    id: 'material',
    title: 'Material',
    fields: [
      { key: 'weightGrams', label: 'Peso de la pieza', unit: 'g', kind: 'decimal' },
      { key: 'filamentPricePerKg', label: 'Precio del filamento', unit: '$ / kg', kind: 'decimal' },
    ],
  },
  {
    id: 'print',
    title: 'Tiempo de impresión',
    fields: [
      { key: 'printHours', label: 'Horas', unit: 'h', kind: 'integer' },
      { key: 'printMinutes', label: 'Minutos', unit: 'min', kind: 'integer', max: 59 },
    ],
  },
  {
    id: 'energy',
    title: 'Electricidad y desgaste',
    fields: [
      { key: 'powerWatts', label: 'Consumo eléctrico', unit: 'W', kind: 'decimal' },
      { key: 'kwhCost', label: 'Costo del kWh', unit: '$ / kWh', kind: 'decimal' },
      { key: 'wearPerHour', label: 'Desgaste por hora', unit: '$ / h', kind: 'decimal' },
    ],
  },
  {
    id: 'labor',
    title: 'Mano de obra y extras',
    fields: [
      { key: 'laborHours', label: 'Horas de trabajo manual', unit: 'h', kind: 'decimal' },
      { key: 'laborRate', label: 'Valor de la hora de trabajo', unit: '$ / h', kind: 'decimal' },
      { key: 'extras', label: 'Costos extras', unit: '$', kind: 'decimal' },
    ],
  },
]

export const ALL_FIELDS = FIELD_GROUPS.flatMap((g) => g.fields)

export const emptyForm = () =>
  Object.fromEntries(ALL_FIELDS.map((f) => [f.key, '']))
