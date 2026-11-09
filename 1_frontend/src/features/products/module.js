import ProductsPage from './ProductsPage.jsx'
import ProductFormPage from './ProductFormPage.jsx'

export default {
  id: 'productos',
  routes: [
    { path: '/productos', Component: ProductsPage },
    { path: '/productos/nuevo', Component: ProductFormPage },
    { path: '/productos/:id', Component: ProductFormPage },
  ],
  nav: { to: '/productos', label: 'Productos', order: 40 },
}
