import { createApp } from 'vue';
import { createRouter, createWebHistory } from 'vue-router';
import DataV from '@kjgl77/datav-vue3';

import App from './app.vue';
import routes from './router';

const router = createRouter({
  history: createWebHistory(),
  routes,
});

createApp(App)
  .use(router)
  .use(DataV)
  .mount('#app');

