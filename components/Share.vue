<template>
  <client-only>
    <social-sharing
      :url="window ? window.location.href : `http://www.0-2.club/`"
      :title="`See ${player.tag} on the The 0-2 Club`"
      :description="`Level ${level.level}: ${level.label} in ${player.game}`"
      hashtags="esports"
      inline-template
    >
      <div class="social">
        <!-- <div class="caps reset label">Share:</div> -->
        <!-- <network network="facebook">
                  <div class="facebookicon"></div>
        </network>-->
        <network network="twitter">
          <div class="twittericon"></div>
        </network>
      </div>
    </social-sharing>
  </client-only>
</template>

<script>
export default {
  data() {
    return {
      window: null,
    }
  },
  computed: {
    player() {
      return this.$store.state.player
    },
    level() {
      return this.player.level.level
    },
  },
  mounted() {
    this.window = window
  },
}
</script>

<style lang="scss">
.social {
  display: inline-flex;
  position: relative;
  // display: flex;
  align-items: center;
  // padding-top: 5px;

  .label {
    position: relative;
    top: 8px;
    opacity: 0.7;

    @media (max-width: 768px) {
      top: 2px;
    }
  }
}
</style>
