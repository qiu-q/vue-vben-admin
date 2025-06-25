import { createRouter, createWebHistory } from 'vue-router'
import controlRoutes from './controlRoutes'

const router = createRouter({
  history: createWebHistory(),
  routes: controlRoutes,
})

export default router
