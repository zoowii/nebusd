<template>
<div class="loading-img" style="
  z-index: 1000;
  position: fixed;
  left: 0;
  top: 0;
  right: 0;
  bottom: 0;
  background-image: url('img/loading.gif');
  background-repeat: no-repeat;
  background-position: center;
  background-size: 150px;
  opacity: 0.8;" v-if="show"></div>
</template>

<script>
export default {
  name: "Loading",
  props: ["show"],
  data() {
    return {};
  },
  methods: {}
};
</script>

<style lang="scss">
.loading-img {
}
</style>