<template>
  <v-app id="app">
    <v-content>
      <keep-alive include="" >
        <router-view/>
      </keep-alive>
    </v-content>
  </v-app>
</template>

<script>
import { mapGetters, mapMutations, mapActions } from 'vuex'

export default {
  name: 'App',

  data () {
    return {
    }
  },

  computed: {
    ...mapGetters({
    }),

    sample: {
      get () { return '' },
      set (newValue) {}
    }
  },

  components: {
  },

  methods: {
    ...mapMutations({
    }),
    ...mapActions({
    })
  },

  created () { console.log('CALL created()') },
  mounted () { console.log('CALL mounted()') },
  activated () { console.log('CALL activated()') },
  deactivated () { console.log('CALL deactivated()') },
  destroyed () { console.log('CALL destroyed()') }
}
</script>

<style>
</style>
<style scoped>
</style>
