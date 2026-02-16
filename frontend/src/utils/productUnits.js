// productUnits.js - utilidades para normalizar y mostrar unidades de producto

export const PRODUCT_UNIT_OPTIONS = [
  { value: 'unidad', label: 'Unidad (ud)', stockLabel: 'ud' },
  { value: 'paquete', label: 'Paquete', stockLabel: 'paq' },
  { value: 'caja', label: 'Caja', stockLabel: 'caja' },
  { value: 'docena', label: 'Docena', stockLabel: 'doc' },
  { value: 'lb', label: 'Libras (lb)', stockLabel: 'lb' },
  { value: 'kg', label: 'Kilogramos (kg)', stockLabel: 'kg' },
  { value: 'g', label: 'Gramos (g)', stockLabel: 'g' },
  { value: 'l', label: 'Litros (L)', stockLabel: 'L' },
  { value: 'ml', label: 'Mililitros (ml)', stockLabel: 'ml' },
  { value: 'm', label: 'Metros (m)', stockLabel: 'm' },
];

export const normalizeUnitType = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  return PRODUCT_UNIT_OPTIONS.some((option) => option.value === normalized)
    ? normalized
    : 'unidad';
};

export const getUnitOption = (value) => (
  PRODUCT_UNIT_OPTIONS.find((option) => option.value === normalizeUnitType(value))
);

export const getUnitShortLabel = (value) => (
  getUnitOption(value)?.stockLabel || 'ud'
);

export const formatStockWithUnit = (stock, unitType) => (
  `${stock} ${getUnitShortLabel(unitType)}`
);

export const formatQuantityWithUnit = (quantity, unitType) => (
  `${quantity} ${getUnitShortLabel(unitType)}`
);
