<template>
<md-list class="md-triple-line md-dense">
    <p v-if="mortgages.length===0">
        There are no mortgages here.
    </p>
    <md-list-item v-if="mortgages.length>0" v-for="mortgage in mortgages" :key="mortgage.id">
        
        <div class="md-list-item-text" style="text-align: center;">
        <span>Owner: {{mortgage.owner}}</span>
        <span>Collateral: {{weiToNas(mortgage.collateralBalance)}} NAS</span>
        <span>Minted: {{weiToNas(mortgage.tokenBalance)}} NASUSD</span>
        <p>
            <span>Mortgage Rate: {{mortgageRateOfMortgage(mortgage)*100}} %</span>
            <span>Time: {{new Date(1000 * mortgage.time).toLocaleDateString()}}</span>
        </p>
        <md-button class="md-icon-button" v-if="currentUserAddress && currentUserAddress === mortgage.owner" @click="clearMortgage(mortgage)">
            <md-icon class="md-primary">{{trans('clear.mortgage')}}</md-icon>
        </md-button>
        </div>

    </md-list-item>
    </md-list>
</template>

<script>
function explorerUrlForAddress(address) {
  return "https://explorer.nebulas.io/#/address/" + address;
}
export default {
  name: "MortgageList",
  props: ["mortgages", "configInfo", "currentUserAddress"],
  data() {
    return {};
  },
  methods: {
    weiToNas(value) {
      return new BigNumber(value).div(Math.pow(10, 18)).toString();
    },
    clearMortgage(mortgage) {
      this.$emit("on-clear-mortgage", mortgage);
    },
    mortgageRateOfMortgage(mortgage) {
      // 计算抵押率
      if (!this.configInfo.price) {
        return 0;
      }
      return (
        mortgage.collateralBalance *
        parseFloat(this.configInfo.price) /
        mortgage.tokenBalance
      );
    },
    trans: function(message, lang) {
      return window.trans(message, lang);
    }
  }
};
</script>

<style lang="scss">
</style>