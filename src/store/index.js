import Vue from 'vue'
import Vuex from 'vuex'
import Vuelidate from 'vuelidate'

import * as getters from './getters'
import * as mutations from './mutations'
import * as actions from './actions'
import modules from './modules'

Vue.use(Vuex)
Vue.use(Vuelidate)

export default (opts = {}) => {
  const store = new Vuex.Store({
    state: {
      accounts: [],
      signRequest: null,
      session: {
        insecureMode: true
      },
      signup: {
        signUpName: ``,
        signUpPassword: ``,
        signUpPasswordConfirm: ``,
        signUpWarning: false,
        signUpSeed: ``
      },
      recover: {
        seed: ``,
        name: ``,
        prefix: ``,
        password: ``,
        passwordConfirm: ``
      }
    },
    getters,
    modules: modules(opts),
    actions,
    mutations
  })
  return store
}
