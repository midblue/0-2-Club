<template>
  <div class="notifications">
    <transition-group name="notification" tag="div">
      <div
        v-for="(notification, index) in notifications"
        :key="notification + index"
        class="notification"
      >
        <span v-html="notification"></span>
      </div>
      <div v-if="isLoading" key="isLoading" class="notification">
        <span>
          <img class="loader" src="~/assets/img/gridloader.svg" />Loading latest
          data...
        </span>
      </div>
    </transition-group>
  </div>
</template>

<script>
export default {
  computed: {
    notifications() {
      return this.$store.state.notifications.list
    },
    isLoading() {
      return this.$store.state.isLoading
    },
  },
}
</script>

<style lang="scss" scoped>
.notifications {
  position: fixed;
  top: 60px;
  left: 30px;
  z-index: 1000;
  pointer-events: none;

  .notification {
    color: white;
    margin-bottom: 3px;
    transition: all 0.2s;
    width: 70vw;

    span {
      display: inline-flex;
      align-items: center;
      padding: 7px 12px;
      background: hsla(0, 0%, 0%, 0.8);
    }
  }
}

.loader {
  width: 15px;
  margin-right: 10px;
}

.notification-enter {
  opacity: 0;
  transform: translateY(-5px);
}
.notification-leave-to {
  opacity: 0;
  transform: translateY(-5px);
}
.notification-leave-active {
  position: absolute;
}
</style>
