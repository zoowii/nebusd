<template>
    <div class="page-container">
      <Loading :show="loading"></Loading>
    <md-app md-mode="reveal">
      <md-app-toolbar class="md-primary">
        <md-button class="md-icon-button" @click="menuVisible = !menuVisible">
          <i class="el-icon-setting"></i>
        </md-button>
        <span class="md-title">{{title}}</span>
        <div class="md-toolbar-section-end">
          <md-radio v-model="currentLang" value="english" @click="changeLang('english')">English</md-radio>
          <md-radio v-model="currentLang" value="chinese" @click="changeLang('chinese')">中文</md-radio>
        </div>
      </md-app-toolbar>

      <md-app-drawer :md-active.sync="menuVisible">
        <md-toolbar class="md-transparent" md-elevation="0">{{trans("Menu")}}</md-toolbar>

        <md-list>
          <md-list-item @click="currentPage='exchange'">
            <span class="md-list-item-text">{{trans("Exchange")}}</span>
          </md-list-item>

          <md-list-item @click="currentPage='mortgage'">
            <span class="md-list-item-text">{{trans("mortgage.mint")}}</span>
          </md-list-item>

          <md-list-item @click="currentPage='help'">
            <span class="md-list-item-text">{{trans("Help")}}</span>
          </md-list-item>
          <md-list-item @click="goToFeedPricePage">
            <span class="md-list-item-text">{{trans("feed")}}</span>
          </md-list-item>
        </md-list>
      </md-app-drawer>

      <md-app-content>
        <div v-show="currentPage==='exchange'" style="text-align: center;">
          <h5>{{trans("Exchange of NAS and NASUSD")}}</h5>
          <div>
            <div>
              <p>{{trans("Status")}}: {{configInfo.paused?"Paused":"Normal"}}</p>
              <p v-if="!configInfo.allowBigAmount">{{trans("Suspended trading with big amout(over 10NAS)")}}</p>
              <p style="color: red;">{{trans("notice.text")}}</p>
              <p style="font-size: 12px;">{{trans("Out Market Price")}}: {{configInfo.price}}USD</p>
              <p style="font-size: 12px;">{{trans("NAS Buy Price")}}: {{buy1Price()}}NASUSD</p>
              <p style="font-size: 12px;">{{trans("NAS Sell Price")}}: {{sell1Price()}}NASUSD</p>
              <p style="font-size: 12px;">{{trans("Total Supply of NASUSD")}}: {{nasusdAmountToText(totalSupply)}}</p>
            </div>
            <div v-if="currentUserAddress && currentUserAddress===configInfo.owner">
              <p>Fee Balance: {{weiToNas(configInfo.ownerFeeBalance)}}</p>
              <md-button class="md-raised md-accent" @click="withdrawFromOwnerFeeBalance(configInfo.ownerFeeBalance)">Withdraw Fee</md-button>
            </div>
            <div>
              <p>
                {{trans("Have no NASUSD? you can buy from this exchange or mint NASUSD by mortgage NAS.")}}
              </p>
                <md-button class="md-accent" @click="goToMortgagePage">{{trans("Mint NASUSD")}}</md-button>
            </div>
            <div>
              <md-button class="md-raised" :md-ripple="false" @click="viewMyOrders(currentUserAddress)" v-if="currentUserAddress">{{trans("View My Orders")}}</md-button>
              <md-field>
                <label>{{trans("NAS/NASUSD Price")}}: </label>
                <md-input v-model="buysellForm.price" type="number"></md-input>
              </md-field>
              <md-field>
                <label>{{trans("NAS Amount")}}: </label>
                <md-input v-model="buysellForm.nasAmount" type="number"></md-input>
              </md-field>
              <p>{{trans("Your balance")}}: {{weiToNas(currentUserBalance)}} NASUSD</p>
              <md-button class="md-raised md-primary" @click="makeOrder(buysellForm, true)">{{trans('Buy')}}</md-button>
              <md-button class="md-raised md-accent" @click="makeOrder(buysellForm, false)">{{trans('Sell')}}</md-button>
            </div>
            <h5>{{trans("NAS/NASUSD Exchange Orders")}}</h5>
            <md-list class="md-triple-line">
              <!-- 卖单队列 -->
              <md-list-item v-for="order in sellOrders" :key="order.id">
                <div class="md-list-item-text" style="text-align: center;">
                  <span style="color: #aaaaaa; font-size: 12px; margin-bottom: 5px;">{{order.maker}}</span>
                  <p>
                     {{trans("want sell")}} {{weiToNas(order.remainingSellAmount)}} NAS on price {{order.sellPrice}} NASUSD
                  </p>
                </div>
              </md-list-item>
              <span v-if="sellOrders.length===0">{{trans("No sell orders")}}</span>
              <!-- <span>{{trans("Up is sell orders")}}</span> -->
              <md-divider class="md-inset"></md-divider>
              <!-- <span>{{trans("Below is buy orders")}}</span> -->
              <!-- 买单队列 -->
              <span v-if="buyOrders.length===0">{{trans("No buy orders")}}</span>
              <md-list-item v-for="order in buyOrders" :key="order.id">
                <div class="md-list-item-text" style="text-align: center; border-bottom: solid 1px #cccccc; padding-bottom: 5px;">
                  <span style="color: #aaaaaa; font-size: 12px; margin-bottom: 5px;">{{order.maker}}</span>
                  <p>
                    {{trans("want buy")}} {{weiToNas(order.remainingBuyAmount/order.buyPrice)}} NAS on price {{order.buyPrice}} NASUSD
                  </p>
                </div>
              </md-list-item>
            </md-list>
          </div>
        </div>
        <div v-show="currentPage==='mortgage'" style="text-align: center;">
          <h5>{{trans("Mortgage of NAS and NASUSD")}}</h5>
          <div>

            <md-tabs md-sync-route md-active-tab="tab-mortgage-home">
              <md-tab id="tab-mortgage-home" md-label="Home" to="/components/tabs/home">
                {{trans("Introduction")}}
                <p v-html="intro"></p>
              </md-tab>

              
              <md-tab id="tab-mint" md-label="Mint" to="/components/tabs/mint">
                <div>
                  <h5>{{trans("Mortgage NAS to mint NASUSD")}}</h5>
                  <md-field>
                    <label>{{trans("NASUSD Amount")}}</label>
                    <md-input type="number" v-model="mintForm.nasusdAmount" />
                  </md-field>
                  <md-button type="button" class="md-primary" @click="mintNasUsd(mintForm)">{{trans("Mortgage And Mint")}}</md-button>
                </div>
                <div>
                  <h5>{{trans("Convert NASUSD to NAS")}}</h5>
                  <p>
                    <span>Your NASUSD Balance: {{weiToNas(currentUserBalance)}} NASUSD</span>
                  </p>
                  <md-field>
                    <label>{{trans("NASUSD Amount")}}</label>
                    <md-input type="number" v-model="convertForm.nasusdAmount" />
                  </md-field>
                  <md-button type="button" class="md-primary" @click="convertNasUsd(convertForm)">{{trans("Convert NASUSD to NAS")}}</md-button>
                </div>
              </md-tab>

              <md-tab id="tab-my-mortgages" md-label="My" to="/components/tabs/MyMortgages">
                <div>
                  <md-button type="button" class="md-primary" v-if="currentUserAddress"
                   @click="updateMyMortgages(currentUserAddress)">{{trans('Refresh')}}</md-button>
                  <MortgageList :mortgages="myMortgages" :configInfo="configInfo" :currentUserAddress="currentUserAddress" @on-clear-mortgage="clearMortgage"></MortgageList>
                </div>
              </md-tab>

              <md-tab id="tab-all-mortgages" md-label="All" to="/components/tabs/AllMortgages">
                <div>
                  <md-button type="button" class="md-primary" @click="loadAllMortgages">{{trans('Refresh')}}</md-button>
                  <MortgageList :mortgages="allMortgages" :configInfo="configInfo" :currentUserAddress="currentUserAddress" @on-clear-mortgage="clearMortgage"></MortgageList>
                </div>
              </md-tab>
            </md-tabs>

          </div>
        </div>
        <div v-show="currentPage==='help'" style="text-align: center;">
          <h5>{{trans("Contract Address")}}</h5>
          <p>
            <a v-bind:href="explorerUrlForAddress(dappAddress)" target="_blank">{{dappAddress}}</a>
          </p>
          <p>
            <md-button type="button" class="md-primary" @click="goToRepoUrl">Source Code</md-button>
            <md-button type="button" class="md-primary" @click="donate">{{trans('Donate')}}</md-button>
          </p>
          <h5>{{trans("What's NASUSD")}}</h5>
          <p v-html="intro"></p>
          <hr>
          <h5>{{trans("How to use NASUSD")}}</h5>
          <p v-html="howToUse">
          </p>
          <p>
            
          </p>
        </div>
        <div v-show="currentPage==='my_orders'" style="text-align: center;">
          <h5>{{trans("My Orders")}}</h5>
          <md-list class="md-triple-line md-dense">
            <md-list-item v-for="order in myOrders" :key="order.id">
                <div class="md-list-item-text" style="text-align: center; border-bottom: solid 1px #cccccc; padding-bottom: 15px;">
                  <span style="color: #aaaaaa; font-size: 12px; margin-bottom: 5px;">{{order.maker}}</span>
                  <p v-if="order.isBuy">
                    {{trans("want buy")}} {{weiToNas(order.remainingBuyAmount/order.buyPrice)}} NAS on price {{order.buyPrice}} NASUSD
                  </p>
                  <p v-if="!order.isBuy">
                     {{trans("want sell")}} {{weiToNas(order.remainingSellAmount)}} NAS on price {{order.sellPrice}} NASUSD
                  </p>
                  <div style="margin-top: 10px;">
                    <md-button class="md-raised md-accent" style="max-width: 200px;" @click="cancelOrder(order)">Cancel</md-button>
                  </div>
                </div>
              </md-list-item>
          </md-list>
        </div>
        <div v-show="currentPage==='feed_price'" style="text-align: center;">
          <h5>{{trans("Feed Price Admin Page")}}</h5>
          <div>
            <div>
              Latest Price: {{configInfo.price}}
            </div>
            <div>
              <md-dialog
                :md-active.sync="showFeedPriceDialog">
                <md-dialog-title>Feed NAS Price</md-dialog-title>
                <div>
                  <md-field>
                    <label>NAS/USD Price: </label>
                    <md-input v-model="feedPriceForm.price"></md-input>
                  </md-field>
                </div>
                <md-button class="md-raised md-primary" @click="feedPrice(feedPriceForm)">Feed</md-button>
              </md-dialog>

              <md-button class="md-primary md-raised" @click="showFeedPriceDialog = true;feedPriceForm={}">{{trans("Feed Price")}}</md-button>
              <p>({{trans("only when you are one of the feeder")}})</p>
            </div>
            <h5>{{trans("Price Feeders")}}</h5>
            <md-list class="md-triple-line md-dense">
              <md-list-item v-for="feeder in configInfo.priceFeeders" :key="feeder">
                <md-avatar>
                  <img src="https://placeimg.com/40/40/people/1" alt="Feeder">
                </md-avatar>

                <div class="md-list-item-text">
                  <span>{{feeder}}:</span>
                  <span>{{trans("Price")}}: {{configInfo.prices[feeder]||null}} USD</span>
                </div>
              </md-list-item>
            </md-list>
          </div>
        </div>
      </md-app-content>
    </md-app>
  </div>
</template>

<script>
var useTestNet =
  window.location.search.indexOf("testnet=true") >= 0 ? true : false;

var nebulas = require("nebulas"),
  Account = nebulas.Account,
  neb = new nebulas.Neb();
neb.setRequest(
  new nebulas.HttpRequest(
    useTestNet ? "https://testnet.nebulas.io" : "https://mainnet.nebulas.io"
  )
);

function getParameterByName(name, url) {
  if (!url) url = window.location.href;
  name = name.replace(/[\[\]]/g, "\\$&");
  var regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
    results = regex.exec(url);
  if (!results) return null;
  if (!results[2]) return "";
  return decodeURIComponent(results[2].replace(/\+/g, " "));
}

function explorerUrlForAddress(address) {
  return "https://explorer.nebulas.io/#/address/" + address;
}

import MortgageList from "./MortgageList.vue";
import Loading from "./Loading.vue";
import * as _ from "underscore";

export default {
  name: "app",
  components: {
    MortgageList: MortgageList,
    Loading: Loading
  },
  data() {
    return {
      title: trans("title.text"),
      menuVisible: false,
      currentPage: "exchange",
      dappAddress: "n1t6Ck67YpgeZNGKbEZJx5TPcR2dxm7emqT", // tx hash: b3229b40229e42aee8574f6bb8ec0c4edbc7e6d80a79832cd37c3b96924d91c3
      currentUserAddress: null,
      dappAuthorAddress: "n1aJXsZCGw4bsn5UJaqASrsmUqbfVPoeRG6",
      simulateFromAddress: "n1aJXsZCGw4bsn5UJaqASrsmUqbfVPoeRG6",
      repoUrl: "https://github.com/zoowii/nebusd",
      intro: trans("intro.text"),
      howToUse: trans("howtouse.text"),
      dismissSecs: 5,
      dismissCountDown: 0,
      alertType: "success",
      alertMessage: "",

      configInfo: {},
      totalSupply: 0,
      currentUserBalance: 0, // 当前用户的NASUSD余额
      buyOrders: [],
      sellOrders: [],
      myMortgages: [],
      allMortgages: [],
      mintForm: {},
      feedPriceForm: {},
      showFeedPriceDialog: false,
      buysellForm: {},
      myOrders: [],
      currentLang: null,
      convertForm: {},
      loading: true
    };
  },
  watch: {
    currentLang() {
      this.changeLang(this.currentLang);
    }
  },
  created() {
    this.currentLang = this.getLang();
    var self = this;
    this.currentUserAddress = localStorage["currentUserAddress"];
    if (
      this.currentUserAddress === "null" ||
      this.currentUserAddress === "undefined"
    ) {
      this.currentUserAddress = null;
    }
    if (this.currentUserAddress) {
      this.simulateFromAddress = this.currentUserAddress;
      this.onUpdateCurrentUserAddress();
    }
    setTimeout(function() {
      if (!window.webExtensionWallet) {
        self.showErrorInfo(
          "Web Extention Wallet not installed yet, please intall it first"
        );
        return;
      }
      window.postMessage(
        {
          target: "contentscript",
          data: {},
          method: "getAccount"
        },
        "*"
      );
      window.addEventListener("message", function(e) {
        if (e.data && e.data.data) {
          if (e.data.data.account) {
            //这就是当前钱包中的地址
            self.currentUserAddress = e.data.data.account;
            window.currentUserAddress = self.currentUserAddress;
            self.simulateFromAddress = self.currentUserAddress;
            localStorage["currentUserAddress"] = self.currentUserAddress;
            self.onUpdateCurrentUserAddress();
          }
        }
      });
    }, 3000);

    this.loading = false;
    this.loadExchangePage();
    this.loadAllMortgages();
  },
  methods: {
    explorerUrlForAddress(address) {
      return explorerUrlForAddress(address);
    },
    countDownChanged(dismissCountDown) {
      this.dismissCountDown = dismissCountDown;
    },
    showAlert(alertType, alertMessage) {
      this.dismissCountDown = this.dismissSecs;
      this.alertType = alertType;
      this.alertMessage = alertMessage;
    },
    toCreateBaby() {
      this.currentPage = "create_baby";
      this.createBabyForm = { gender: null };
    },
    toCreateBabyLog(baby) {
      this.currentBaby = baby;
      this.currentPage = "create_baby_log";
      this.createBabyLogForm = {};
    },
    nasusdAmountToText(amount) {
      return new BigNumber(amount).div(Math.pow(10, 18)).toString(10);
    },
    goToMortgagePage() {
      this.currentPage = "mortgage";
    },
    goToFeedPricePage() {
      this.currentPage = "feed_price";
      this.loadConfig();
    },
    loadExchangePage() {
      this.currentPage = "exchange";
      this.loadConfig();
      this.loadOrders();
    },
    onUpdateCurrentUserAddress() {
      if (this.currentUserAddress) {
        this.updateCurrentUserBalanceInfo();
        this.updateMyMortgages(this.currentUserAddress);
      }
    },
    loadAllMortgages() {
      var self = this;
      simulateCallContract(
        this.simulateFromAddress,
        this.dappAddress,
        "0",
        "getAllMortgageList",
        JSON.stringify([])
      )
        .then(function(data) {
          self.allMortgages = data;
        })
        .catch(this.showErrorInfo.bind(this));
    },
    updateMyMortgages(userAddress) {
      var self = this;
      simulateCallContract(
        this.simulateFromAddress,
        this.dappAddress,
        "0",
        "getMortgageListOfUser",
        JSON.stringify([userAddress])
      )
        .then(function(data) {
          self.myMortgages = data;
        })
        .catch(this.showErrorInfo.bind(this));
    },
    updateCurrentUserBalanceInfo() {
      // 更新查询当前用户的NASUSD
      if (this.currentUserAddress) {
        var self = this;
        simulateCallContract(
          this.simulateFromAddress,
          this.dappAddress,
          "0",
          "balanceOf",
          JSON.stringify([this.currentUserAddress])
        )
          .then(function(data) {
            self.currentUserBalance = data;
          })
          .catch(this.showErrorInfo.bind(this));
      }
    },
    loadOrders() {
      var self = this;
      this.loading = true;
      simulateCallContract(
        this.simulateFromAddress,
        this.dappAddress,
        "0",
        "getBuyOrders",
        JSON.stringify([])
      )
        .then(function(data) {
          self.loading = false;
          self.buyOrders = data;
        })
        .catch(this.showErrorInfo.bind(this));
      simulateCallContract(
        this.simulateFromAddress,
        this.dappAddress,
        "0",
        "getSellOrders",
        JSON.stringify([])
      )
        .then(function(data) {
          self.sellOrders = data;
        })
        .catch(this.showErrorInfo.bind(this));
    },
    loadConfig() {
      var self = this;
      this.loading = true;
      simulateCallContract(
        this.simulateFromAddress,
        this.dappAddress,
        "0",
        "getConfig",
        JSON.stringify([])
      )
        .then(function(data) {
          self.configInfo = data;
          self.loading = false;
        })
        .catch(this.showErrorInfo.bind(this));
      simulateCallContract(
        this.simulateFromAddress,
        this.dappAddress,
        "0",
        "totalSupply",
        JSON.stringify([])
      )
        .then(function(data) {
          self.totalSupply = data;
        })
        .catch(this.showErrorInfo.bind(this));
    },
    loadMyBabiesPage() {
      this.currentPage = "baby_list";
      var self = this;
      // load my babies of current user
      simulateCallContract(
        this.simulateFromAddress,
        this.dappAddress,
        "0",
        "getBabiesByUser",
        JSON.stringify([this.currentUserAddress])
      )
        .then(function(data) {
          self.myBabies = data;
        })
        .catch(this.showErrorInfo.bind(this));
    },
    viewBabyLogs(baby) {
      this.currentPage = "view_baby";
      var self = this;
      // load baby logs
      this.currentBaby = baby;
      this.currentBabyLogs = [];
      simulateCallContract(
        this.simulateFromAddress,
        this.dappAddress,
        "0",
        "getBabyLogsOfBaby",
        JSON.stringify([baby.id])
      )
        .then(function(data) {
          self.currentBabyLogs = data;
        })
        .catch(this.showErrorInfo.bind(this));
    },
    onResetCreateBabyLogForm(evt) {
      evt.preventDefault();
      this.createBabyLogForm = {};
    },
    viewMyOrders(userAddress) {
      var self = this;
      this.currentPage = "my_orders";
      simulateCallContract(
        userAddress,
        this.dappAddress,
        "0",
        "getUserOrders",
        JSON.stringify([userAddress])
      )
        .then(function(data) {
          self.myOrders = data;
        })
        .catch(this.showErrorInfo.bind(this));
    },
    nasToWei: function(value) {
      return new BigNumber(value).multipliedBy(Math.pow(10, 18)).toString(10);
    },
    buy1Price() {
      if (this.buyOrders.length > 0) {
        return this.buyOrders[0].buyPrice.toString();
      } else {
        return "0";
      }
    },
    sell1Price() {
      if (this.sellOrders.length > 0) {
        return this.sellOrders[0].sellPrice.toString();
      } else {
        return "0";
      }
    },
    cancelOrder(order) {
      var callFunction = "marketCancelOrder";
      var callArgs = [order.id];
      var self = this;
      directCallOnChainTx(
        this.dappAddress,
        "0",
        callFunction,
        JSON.stringify(callArgs),
        function(data) {
          self.showSuccessInfo(trans("order cancel submited"));
        },
        function(data) {
          self.updateCurrentUserAddress();
          self.showSuccessInfo("order cancel confirmed");
          self.loadConfig();
          self.loadOrders();
          self.updateCurrentUserBalanceInfo();
        },
        this.showErrorInfo.bind(this)
      );
    },
    makeOrder(form, isBuy) {
      if (!form.price) {
        return this.showErrorInfo(trans("price can't be empty"));
      }
      var price = new BigNumber(form.price);
      if (!price || price.lte(0)) {
        return this.showErrorInfo(trans("price must be positive"));
      }
      if (this.configInfo.paused) {
        return this.showErrorInfo(trans("this exchange is paused now"));
      }
      if (!form.nasAmount) {
        return this.showErrorInfo(trans("amount can't be empty"));
      }
      let nasAmount = new BigNumber(form.nasAmount);
      if (!nasAmount || nasAmount.lte(0)) {
        return this.showErrorInfo(trans("amount must be positive"));
      }
      if (isBuy) {
        // 检查用户是否有足够的NASUSD
        if (
          new BigNumber(this.currentUserBalance).lt(
            this.nasToWei(nasAmount.multipliedBy(price))
          )
        ) {
          window.alert(
            trans(
              "you have no enough NASUSD balance to buy, please change wallet to buy"
            )
          );
        }
      }
      var callFunction = isBuy ? "marketBuy" : "marketSell";
      var callArgs = isBuy
        ? [price.toString(), this.nasToWei(nasAmount)]
        : [price.toString()];
      var self = this;
      directCallOnChainTx(
        this.dappAddress,
        isBuy ? "0" : nasAmount.toString(),
        callFunction,
        JSON.stringify(callArgs),
        function(data) {
          self.showSuccessInfo(trans("order submited"));
          self.buysellForm = {};
        },
        function(data) {
          self.updateCurrentUserAddress();
          self.showSuccessInfo("order confirmed");
          self.loadConfig();
          self.loadOrders();
          self.updateCurrentUserBalanceInfo();
        },
        this.showErrorInfo.bind(this)
      );
    },
    convertNasUsd(form) {
      var amount = form.nasusdAmount;
      if (!amount) {
        return this.showErrorInfo(
          trans("to convert NASUSD amount can't be empty")
        );
      }
      amount = new BigNumber(amount);
      if (!amount || amount.lte(0)) {
        return this.showErrorInfo(trans("invalid amount format"));
      }
      var self = this;
      directCallOnChainTx(
        this.dappAddress,
        "0",
        "clearSmartCoin",
        JSON.stringify([this.nasToWei(amount.toString()).toString()]),
        function(data) {
          self.showSuccessInfo("Convert Operation Done");
        },
        function(data) {
          self.updateCurrentUserAddress();
          self.showSuccessInfo("Convert Operation confirmed");
          self.loadConfig();
          self.loadAllMortgages();
          if (self.currentUserAddress) {
            self.updateMyMortgages(self.currentUserAddress);
          }
        },
        this.showErrorInfo.bind(this)
      );
    },
    mintNasUsd(form) {
      var amount = form.nasusdAmount;
      if (!amount) {
        return this.showErrorInfo("to mint NASUSD amount can't be empty");
      }
      amount = new BigNumber(amount);
      if (!amount || amount.lte(0)) {
        return this.showErrorInfo(trans("invalid amount format"));
      }
      var price = this.configInfo.price;
      if (!price) {
        return this.showErrorInfo("can't mint before loaded price");
      }
      var nasAmount = amount.div(price).multipliedBy(3);
      var self = this;
      directCallOnChainTx(
        this.dappAddress,
        nasAmount.toFixed(8),
        "mint",
        JSON.stringify([]),
        function(data) {
          self.showSuccessInfo("Mint Operation Done");
        },
        function(data) {
          self.updateCurrentUserAddress();
          self.showSuccessInfo("Mint Operation confirmed");
          self.loadConfig();
          if (self.currentUserAddress) {
            self.updateMyMortgages(self.currentUserAddress);
          }
        },
        this.showErrorInfo.bind(this)
      );
    },
    clearMortgage(mortgage) {
      if (new BigNumber(this.currentUserBalance).lt(mortgage.tokenBalance)) {
        return this.showErrorInfo(
          trans(
            "you have not enough NASUSD balance to clear this mortgage, please get more NASUSD"
          )
        );
      }
      var self = this;
      directCallOnChainTx(
        this.dappAddress,
        "0",
        "cancelMortgage",
        JSON.stringify([mortgage.id]),
        function(data) {
          self.showSuccessInfo(trans("cancel mortgage submited"));
        },
        function(data) {
          self.updateCurrentUserAddress();
          self.showSuccessInfo(trans("mortgage cancel confirmed"));
          self.loadConfig();
          self.loadAllMortgages();
          if (self.currentUserAddress) {
            self.updateMyMortgages(self.currentUserAddress);
          }
        },
        this.showErrorInfo.bind(this)
      );
    },
    weiToNas(wei) {
      return new BigNumber(wei).div(Math.pow(10, 18)).toString();
    },
    trans(message) {
      return window.trans(message);
    },
    withdrawFromOwnerFeeBalance(balance) {
      var self = this;
      directCallOnChainTx(
        this.dappAddress,
        "0",
        "withdrawOwnerFeeBalance",
        JSON.stringify([balance]),
        function(data) {
          self.showSuccessInfo("Withdraw Operation Done");
        },
        function(data) {
          self.updateCurrentUserAddress();
          self.showSuccessInfo("withdraw fee balance from contract confirmed");
          self.loadConfig();
        },
        this.showErrorInfo.bind(this)
      );
    },
    feedPrice(form) {
      var price = form.price;
      if (!price) {
        return this.showErrorInfo("price can't be empty");
      }
      price = new BigNumber(price);
      if (!price || price.lte(0)) {
        return this.showErrorInfo("invalid price format");
      }
      var self = this;
      directCallOnChainTx(
        this.dappAddress,
        "0",
        "feedPrice",
        JSON.stringify([price.toString(10)]),
        function(data) {
          self.showFeedPriceDialog = false;
          self.showSuccessInfo("Operation Done");
        },
        function(data) {
          self.updateCurrentUserAddress();
          self.showSuccessInfo("NAS price feed confirmed");
          self.loadConfig();
        },
        this.showErrorInfo.bind(this)
      );
    },
    showSuccessInfo(msg) {
      console.log("info: ", msg);
      if (msg.msg) {
        msg = msg.msg;
      }
      msg = msg || "操作成功";
      var msgStr = msg.toString();
      if (
        msgStr.indexOf("payId ") === 0 &&
        msgStr.endsWith(" does not exist")
      ) {
        return;
      }
      if (this.$notify) {
        this.$notify({
          title: "通知",
          message: msgStr,
          type: "success"
        });
      } else {
        console.log(msgStr);
        this.showAlert("success", msgStr);
      }
    },
    updateCurrentUserAddress() {
      if (window.currentUserAddress) {
        this.currentUserAddress = window.currentUserAddress;
        localStorage["currentUserAddress"] = window.currentUserAddress;
        this.onUpdateCurrentUserAddress();
      }
    },
    getLang() {
      return window.getLang();
    },
    changeLang(lang) {
      window.changeLang(lang);
    },
    donate() {
      var value = "1";
      var gas_price = "1000000";
      var gas_limit = "2000000";
      var self = this;
      callOnChainTx(
        this.simulateFromAddress,
        this.dappAuthorAddress,
        value,
        "0",
        gas_price,
        gas_limit,
        null,
        null,
        function(data) {
          self.showSuccessInfo(trans("donate successfully!"));
        },
        function(data) {
          self.updateCurrentUserAddress();
        },
        this.showErrorInfo
      );
    },
    viewBabyLog(log) {
      this.currentBabyLog = log;
      this.$refs.viewBabyLogModal.show();
    },
    loginInNeb() {
      var value = "0";
      var gas_price = "1000000";
      var gas_limit = "2000000";
      var self = this;
      callOnChainTx(
        this.simulateFromAddress,
        this.dappAddress,
        value,
        "0",
        gas_price,
        gas_limit,
        "donate",
        JSON.stringify([]),
        function(data) {
          self.showSuccessInfo(
            trans("Login Successfully! Please wait 20 seconds and refresh page")
          );
        },
        function(data) {
          self.updateCurrentUserAddress();
        },
        this.showErrorInfo
      );
    },
    goToRepoUrl() {
      window.open(this.repoUrl, "_blank");
    },
    showErrorInfo: _.throttle(function(error) {
      this.loading = false;
      console.log("error: ", error);
      if (error.msg) {
        error = error.msg;
      }
      error = error || "Error happen";
      var errorStr = error.toString();
      if (errorStr.indexOf("payId ") === 0) {
        return;
      }
      if (this.$notify) {
        this.$notify.error({
          title: "Error",
          message: errorStr
        });
      } else {
        this.showAlert("danger", errorStr);
      }
    }, 200)
  }
};
</script>

<style lang="scss">
.md-app {
  // max-height: 400px;
  border: 1px solid rgba(#000, 0.12);
}

// Demo purposes only
.md-drawer {
  width: 230px;
  max-width: calc(100vw - 125px);
}
.md-tabs-content {
  min-height: 300px;
}
</style>
