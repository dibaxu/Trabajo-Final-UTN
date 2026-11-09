// 'mock' (por defecto): datos locales simulando el backend, para desarrollar
// sin API. 'http': usa el backend real (ver INTEGRACION.md).
export const API_MODE = import.meta.env?.VITE_API_MODE ?? 'mock'
export const IS_MOCK = API_MODE === 'mock'
