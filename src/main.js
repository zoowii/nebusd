import Vue from 'vue'
// import BootstrapVue from "bootstrap-vue"
import ElementUI from 'element-ui';
import App from './App.vue'
// import "bootstrap/dist/css/bootstrap.min.css"
// import "bootstrap-vue/dist/bootstrap-vue.css"

Vue.config.productionTip = false

import VueMaterial from 'vue-material'
import 'vue-material/dist/vue-material.min.css'
import 'vue-material/dist/theme/default.css'
// import 'element-ui/lib/theme-chalk/index.css';

// Vue.use(BootstrapVue)
Vue.use(ElementUI)
Vue.use(VueMaterial)

import { trans, getLang, changeLang } from './translations'

window.trans = trans
window.getLang = getLang
window.changeLang = changeLang

new Vue({
  el: '#app',
  render: h => h(App)
})
