"use strict";
import BigNumber from 'bignumber.js';

interface LocalContractStorageInterface {
    defineMapProperty: Function
    defineProperties: Function
    defineMapProperties: Function
}

interface TransactionInterface {
    from: string
    to: string
    value: BigNumber
    hash: string
    nonce: number
    timestamp: number

}

interface BlockInterface {
    height: number
    timestamp: number
    seed: number
}

interface BlockchainInterface {
    transaction: TransactionInterface
    block: BlockInterface
    verifyAddress: (string) => number
    transfer: (string, BigNumber) => boolean
}

interface EventInterface {
    Trigger: (string, any) => void
}

declare var LocalContractStorage: LocalContractStorageInterface;
declare var Blockchain: BlockchainInterface;
declare var Event: EventInterface;

class Allowed {
    allowed: Map<string, any>
    constructor(obj) {
        this.allowed = {} as Map<string, any>
        this.parse(obj)
    }
    public toString(): String {
        return JSON.stringify(this.allowed)
    }
    public parse(obj) {
        if (typeof obj != "undefined") {
            var data = JSON.parse(obj);
            for (var key in data) {
                this.allowed[key] = new BigNumber(data[key]);
            }
        }
    }

    public get(key) {
        return this.allowed[key];
    }

    public set(key, value) {
        this.allowed[key] = new BigNumber(value);
    }
}

// 抵押记录
class MortgageItem {
    id: string
    owner: string // 抵押发起人
    collateralBalance: BigNumber // 抵押品余额
    tokenBalance: BigNumber // 发行的token(NASUSD)金额
    time: number
    constructor(text) {
        if (text) {
            let obj = JSON.parse(text)
            this.id = obj.id
            this.owner = obj.owner
            this.collateralBalance = new BigNumber(obj.collateralBalance)
            this.tokenBalance = new BigNumber(obj.tokenBalance)
            this.time = obj.time
        } else {
            this.collateralBalance = new BigNumber(0)
            this.tokenBalance = new BigNumber(0)
        }
    }

    public toString(): String {
        return JSON.stringify(this)
    }
}

// 交易所挂单,baseUnit是NASUSD，tradeUnit是NAS
class OrderItem {
    id: string
    maker: string // 挂单人地址
    time: number
    isBuy: boolean // 是否买单，否则是卖单

    totalSellAmount: BigNumber // 总的卖单挂出量,NAS
    remainingSellAmount: BigNumber // 剩余买单挂卖出量（因为可能部分成交）
    sellPrice: BigNumber // 卖出价格，单位是 1NAS = sellPrice NASUSD

    totalBuyAmount: BigNumber // 总的买单买入量，NASUSD
    remainingBuyAmount: BigNumber // 剩余买单挂买入量，NASUSD
    buyPrice: BigNumber // 买入价格，单位是 1NAS = buyPrice NASUSD

    constructor(text) {
        if (text) {
            let obj = JSON.parse(text)
            this.id = obj.id
            this.maker = obj.maker
            this.time = obj.time
            this.isBuy = obj.isBuy
            this.totalSellAmount = new BigNumber(obj.totalSellAmount)
            this.remainingSellAmount = new BigNumber(obj.remainingSellAmount)
            this.sellPrice = new BigNumber(obj.sellPrice)

            this.totalBuyAmount = new BigNumber(obj.totalBuyAmount)
            this.remainingBuyAmount = new BigNumber(obj.remainingBuyAmount)
            this.buyPrice = new BigNumber(obj.buyPrice)
        } else {
            this.totalBuyAmount = new BigNumber(0)
            this.totalSellAmount = new BigNumber(0)
            this.remainingBuyAmount = new BigNumber(0)
            this.remainingSellAmount = new BigNumber(0)
            this.buyPrice = new BigNumber(0)
            this.sellPrice = new BigNumber(0)
        }
    }

    public toString(): String {
        return JSON.stringify(this)
    }
}

let maxTradeNasAmount = new BigNumber(10 * Math.pow(10, 18)) // 开启最大交易金额限制后允许的最大交易金额

let mintFeeRate = new BigNumber("0.001") // 抵押发行smart coin的手续费率
let clearSmartCoinFeeRate = new BigNumber("0.01") // 清算smart coin的手续费率
let explosionFeeRate = new BigNumber("0.1") // 爆仓时收的手续费率
let tradeFeeRate = new BigNumber(0) // 内盘交易所的手续费率
let minMortgageRate = new BigNumber(3); // 最小抵押品的倍率
let explosionMortgageRate = new BigNumber("1.6") // 爆仓的倍率，当抵押率低于这个值时，抵押单会爆仓

class ConfigInfo {
    owner: string
    ownerFeeBalance: BigNumber // owner拥有的手续费收入余额
    priceFeeders: Array<string> // 喂价人，owner可以管理喂价人
    prices: Map<string, BigNumber> // 喂价人 => 喂价, 喂价表示1份最小精度NAS对应的最小精度的USD的数量，目前精度都是18位
    price: BigNumber // 当前喂价,取各喂价非空的喂价人的喂价的均值
    paused: Boolean // 是否暂停交易，只有owner可以调用
    allowBigAmount: Boolean // 是否开启大额交易，不开启的时候交易金额有限制
    constructor(text) {
        if (text) {
            let obj = JSON.parse(text)
            this.owner = obj.owner
            this.ownerFeeBalance = new BigNumber(obj.ownerFeeBalance)
            this.priceFeeders = obj.priceFeeders
            this.prices = obj.prices
            for (let addr in this.prices) {
                this.prices[addr] = new BigNumber(this.prices[addr])
            }
            this.price = new BigNumber(obj.price)
            this.paused = obj.paused
            this.allowBigAmount = obj.allowBigAmount
        } else {
            this.ownerFeeBalance = new BigNumber(0)
            this.price = new BigNumber(7)
            this.prices = {} as Map<string, BigNumber>
            this.priceFeeders = []
            this.paused = false
            this.allowBigAmount = true
        }
    }
    public toString(): String {
        return JSON.stringify(this)
    }
    public calculatePrice() {
        // 重新计算新的喂价
        let total = new BigNumber(0)
        let count = 0
        for (let key in this.prices) {
            let price = this.prices[key]
            if (price) {
                total = total.plus(price)
                count += 1
            }
        }
        if (count < 1) {
            this.price = new BigNumber(0)
        } else {
            this.price = total.div(new BigNumber(count))
        }
        return this.price
    }
}

var ContractService = function () {
    LocalContractStorage.defineProperties(this, {
        _name: null,
        _symbol: null,
        _decimals: null, // 精度, 18表示 1 token=10^18个最小精度的token
        _totalSupply: {
            parse: function (value) {
                return new BigNumber(value);
            },
            stringify: function (o) {
                return o.toString(10);
            }
        },
        _config: {
            parse: function (text) {
                return new ConfigInfo(text)
            },
            stringify: function (o) {
                return o.toString()
            }
        },
        // 所有有效抵押列表
        _allMortgageIds: {
            parse: function (value) {
                return JSON.parse(value)
            },
            stringify: function (o) {
                return JSON.stringify(o)
            }
        },
        // 所有活跃内盘交易所挂单列表
        _allOrderIds: {
            parse: function (value) {
                return JSON.parse(value)
            },
            stringify: function (o) {
                return JSON.stringify(o)
            }
        }
    });

    LocalContractStorage.defineMapProperties(this, {
        "balances": {
            parse: function (value) {
                return new BigNumber(value);
            },
            stringify: function (o) {
                return o.toString(10);
            }
        },
        "allowed": {
            parse: function (value) {
                return new Allowed(value);
            },
            stringify: function (o) {
                return o.toString();
            }
        },
        // mortgageId => MortgageItem
        "mortgages": {
            parse: function (value) {
                return new MortgageItem(value);
            },
            stringify: function (o) {
                return o.toString();
            }
        },
        // userAddress => array of mortgageId
        "userMortgageIds": {
            parse: function (value) {
                return JSON.parse(value);
            },
            stringify: function (o) {
                return JSON.stringify(o);
            }
        },
        // orderId => OrderItem
        "orders": {
            parse: function (value) {
                return new OrderItem(value);
            },
            stringify: function (o) {
                return o.toString();
            }
        },
        // userAddress => array of orderId
        "userOrderIds": {
            parse: function (value) {
                return JSON.parse(value);
            },
            stringify: function (o) {
                return JSON.stringify(o);
            }
        },
    });
};

function checkUserAddress(address) {
    if (Blockchain.verifyAddress(address) !== 87) {
        throw new Error("invalid address format")
    }
}

ContractService.prototype = {

    init() {
        this._name = 'nasusd';
        this._symbol = 'NASUSD';
        this._decimals = 18;
        this._totalSupply = new BigNumber(0);

        var from = Blockchain.transaction.from;

        var config = new ConfigInfo(null)
        config.owner = from
        config.priceFeeders = [from] // 初始喂价人
        config.prices[from] = config.price // 初始喂价
        this._config = config

        this._allMortgageIds = []
        this._allOrderIds = []

        this.balances.set(from, this._totalSupply);
        this.transferEvent(true, from, from, this._totalSupply);

        let openTest = false
        if (openTest) {
            let from = Blockchain.transaction.from
            this.balances.set(from, new BigNumber(100 * Math.pow(10, 18)))
            let order = this.marketBuy("5", "0.01")
            this.marketCancelOrder(order.id)
        }
    },

    checkIsAdmin() {
        let owner = this.getConfig().owner
        let from = Blockchain.transaction.from
        if (owner !== from) {
            throw new Error("only admin can call this api")
        }
    },
    checkIsFeeder() {
        let feeders: Array<string> = this.getPriceFeeders()
        let from = Blockchain.transaction.from
        if (feeders.indexOf(from) < 0) {
            throw new Error("you are not feeder, can't call this api")
        }
    },
    addPriceFeeder(newFeederAddress) {
        this.checkIsAdmin()
        checkUserAddress(newFeederAddress)
        let config: ConfigInfo = this.getConfig()
        let feeders: Array<string> = config.priceFeeders
        if (feeders.indexOf(newFeederAddress) >= 0) {
            throw new Error("this address was feeder before, can't add again")
        }
        feeders.push(newFeederAddress)
        config.priceFeeders = feeders
        this._config = config
    },
    getPriceFeeders() {
        let config: ConfigInfo = this.getConfig()
        return config.priceFeeders
    },
    removePriceFeeder(feederAddress) {
        this.checkIsAdmin()
        checkUserAddress(feederAddress)
        let config: ConfigInfo = this.getConfig()
        let feeders: Array<string> = config.priceFeeders
        if (feeders.indexOf(feederAddress) < 0) {
            throw new Error("this address was not feeder, can't remove it")
        }
        if (feeders.length < 1) {
            throw new Error("can't remove all feeders")
        }
        feeders.splice(feeders.indexOf(feederAddress), 1)
        config.priceFeeders = feeders
        this._config = config
    },
    // 喂价
    feedPrice(newPrice) {
        this.checkIsFeeder()
        let from = Blockchain.transaction.from
        let config: ConfigInfo = this.getConfig()
        if (newPrice) {
            let newPriceValue = new BigNumber(newPrice)
            if (!newPriceValue || newPriceValue.lte(new BigNumber(0))) {
                throw new Error("invalid price value")
            }
            config.prices[from] = newPriceValue
        } else {
            config.prices[from] = null
        }
        config.calculatePrice()
        this._config = config
    },
    // 开启交易
    openTrade() {
        this.checkIsAdmin()
        let config: ConfigInfo = this.getConfig()
        if (!config.paused) {
            return
        }
        config.paused = false
        this._config = config
    },
    // 暂停交易
    pauseTrade() {
        this.checkIsAdmin()
        let config: ConfigInfo = this.getConfig()
        if (config.paused) {
            return
        }
        config.paused = true
        this._config = config
    },
    // 开启大额交易
    openAllowBigAmountTrade() {
        this.checkIsAdmin()
        let config: ConfigInfo = this.getConfig()
        if (config.allowBigAmount) {
            return
        }
        config.allowBigAmount = true
        this._config = config
    },
    // 暂停大额交易
    pauseAllowBigAmountTrade() {
        this.checkIsAdmin()
        let config: ConfigInfo = this.getConfig()
        if (!config.allowBigAmount) {
            return
        }
        config.allowBigAmount = false
        this._config = config
    },

    // 触发爆仓操作，任何其他涉及资金变动的操作前都要做这个检查，如果爆仓，扣除一定爆仓手续费后，去本合约交易所中take卖出足够的抵押品NAS后，得到的NASUSD优先归还给系统，剩下的还给用户
    toggleExplosion() {
        let config: ConfigInfo = this.getConfig()
        let price = config.price
        if (!price || price.lte(0)) {
            return "not toggle explosion"
        }
        let mortgageItems: Array<MortgageItem> = this.getAllMortgageList()
        let buyOrders = this.getBuyOrders()
        for (let mortgageItem of mortgageItems) {
            if (mortgageItem.tokenBalance.lte(0)) {
                continue
            }
            let dyl = mortgageItem.collateralBalance.mul(price).div(mortgageItem.tokenBalance)
            if (dyl.lte(minMortgageRate)) {
                // 抵押率太低，爆仓，去内盘交易所卖出
                let mortgageItemOwnerCanGetBackNas = mortgageItem.collateralBalance.minus(mortgageItem.tokenBalance.div(price)) // 抵押品拥有者能拿回的balance，包含手续费
                // TODO: 暂时不爆仓
                // TODO：撮合逻辑独立出来调用marketSell
            }
        }
    },
    // 抵押发行NASUSD，需要至少3倍抵押品。每次抵押都产生新抵押记录。抵押收取手续费给合约作者
    mint() {
        let from = Blockchain.transaction.from
        let time = Blockchain.transaction.timestamp
        let value = Blockchain.transaction.value
        let config: ConfigInfo = this.getConfig()
        if (config.paused) {
            throw new Error("this contract paused to trade")
        }
        this.toggleExplosion()
        let price = config.price
        if (price.lte(0)) {
            throw new Error("invalid price")
        }
        let fee = value.mul(mintFeeRate)
        let valueExcludeFee = value.minus(fee)

        let canMintAmount = valueExcludeFee.mul(price).div(minMortgageRate) // 能铸币NASUSD的最小精度的数量
        if (canMintAmount.lte(0)) {
            throw new Error("too little value you transfer to mint this smart coin")
        }
        let mortgageItem = new MortgageItem(null)
        mortgageItem.id = Blockchain.transaction.hash
        mortgageItem.owner = from
        mortgageItem.time = time
        mortgageItem.collateralBalance = valueExcludeFee
        mortgageItem.tokenBalance = canMintAmount
        this.mortgages.set(mortgageItem.id, mortgageItem)

        let userMortgageIds = this.userMortgageIds.get(from) || []
        userMortgageIds.push(mortgageItem.id)
        this.userMortgageIds.set(from, userMortgageIds)

        let allMortgageIds = this._allMortgageIds
        allMortgageIds.push(mortgageItem.id)
        this._allMortgageIds = allMortgageIds

        // 给用户增加NASUSD余额
        let balance = new BigNumber(this.balances.get(from) || 0)
        balance = balance.plus(canMintAmount)
        this.balances.set(from, balance)

        this.transferEvent(true, from, from, canMintAmount)

        this._totalSupply = this._totalSupply.plus(canMintAmount)


        config.ownerFeeBalance = config.ownerFeeBalance.plus(fee)
        this._config = config
        return mortgageItem
    },
    // 获取某个用户的有效抵押列表
    getMortgageListOfUser(userAddress) {
        let itemIds = this.userMortgageIds.get(userAddress) || []
        let result = []
        for (let itemId of itemIds) {
            let item = this.mortgages.get(itemId)
            if (item) {
                result.push(item)
            }
        }
        return result
    },
    getMortgageById(id) {
        return this.mortgages.get(id)
    },
    // 获取所有用户的有效抵押列表
    getAllMortgageList() {
        let itemIds = this._allMortgageIds
        let result = []
        for (let itemId of itemIds) {
            let item = this.mortgages.get(itemId)
            if (item) {
                result.push(item)
            }
        }
        return result
    },
    // 取消某次抵押发行，需要提供足够NASUSD才能赎回抵押的NAS
    cancelMortgage(mortgageId) {
        let from = Blockchain.transaction.from
        let mortgageItem: MortgageItem = this.getMortgageById(mortgageId)
        if (!mortgageItem) {
            throw new Error("can't find this mortgage")
        }
        if (mortgageItem.owner !== from) {
            throw new Error("you are not owner of this mortgage")
        }
        let balance = new BigNumber(this.balances.get(from) || new BigNumber(0))
        if (balance.lt(mortgageItem.tokenBalance)) {
            throw new Error("you have no enough balance to cancel mortgage")
        }
        // NASUSD余额减少
        balance = balance.minus(mortgageItem.tokenBalance)
        this.balances.set(from, balance)

        this.transferEvent(true, from, from, new BigNumber(0).minus(mortgageItem.tokenBalance))

        this._totalSupply = this._totalSupply.minus(mortgageItem.tokenBalance)

        // 抵押取消
        this.mortgages.del(mortgageItem.id)

        let allMortgageIds = this._allMortgageIds
        if (allMortgageIds.indexOf(mortgageItem.id) >= 0) {
            allMortgageIds.splice(allMortgageIds.indexOf(mortgageItem.id), 1)
            this._allMortgageIds = allMortgageIds
        }
        // 抵押品返还给用户
        if (!Blockchain.transfer(mortgageItem.owner, mortgageItem.collateralBalance)) {
            throw new Error("transfer coin to user error")
        }
    },
    // 清算功能。用户可以把持有的NASUSD按喂价兑换成NAS.抵押单会按照抵押率从低到高依次平仓直至有足够的NAS给清算人，平仓后剩余的NAS还给抵押人。 清算向调用人收取手续费给合约作者
    clearSmartCoin(amount) {
        if (!amount) {
            throw new Error("invalid argument")
        }
        amount = new BigNumber(amount)
        if (!amount || amount.lte(0)) {
            throw new Error("invalid argument")
        }
        let from = Blockchain.transaction.from
        let config: ConfigInfo = this.getConfig()
        let price = config.price
        if (!price || price.lte(0)) {
            throw new Error("have no price now")
        }
        let balance = new BigNumber(this.balances.get(from) || new BigNumber(0))
        if (amount.gt(balance)) {
            throw new Error("you have not enough balance to do this operation")
        }
        let mortgageItems: Array<MortgageItem> = this.getAllMortgageList() // 所有抵押单列表
        // 按抵押率从小到大排列
        mortgageItems.sort(function (a, b) {
            let dyl1 = a.collateralBalance.div(a.tokenBalance)
            let dyl2 = b.collateralBalance.div(b.tokenBalance)
            if (dyl1.eq(dyl2)) {
                return 0
            } else if (dyl1.lt(dyl2)) {
                return -1
            } else {
                return 1
            }
        })
        let sumClearedNasUsd = new BigNumber(0) // 平仓的抵押单减少负债的NASUSD数量
        // 需要考虑抵押单是清算人自己的情况，这种情况暂时跳过
        for (let mortgageItem of mortgageItems) {
            if (mortgageItem.owner === from) {
                continue
            }
            let remainingNeedClearNasUsd = amount.minus(sumClearedNasUsd) // 剩下需要平仓的NASUSD
            if (mortgageItem.collateralBalance.lte(remainingNeedClearNasUsd.div(price)) || mortgageItem.tokenBalance.lte(remainingNeedClearNasUsd)) {
                // 单子太小，完整平仓
                let mortgageItemOwnerCanGetBackNas = mortgageItem.collateralBalance.minus(mortgageItem.tokenBalance.div(price)) // 抵押品拥有者能拿回的balance
                sumClearedNasUsd = sumClearedNasUsd.plus(mortgageItem.tokenBalance)
                if (mortgageItemOwnerCanGetBackNas.gt(0)) {
                    if (!Blockchain.transfer(mortgageItem.owner, mortgageItemOwnerCanGetBackNas)) {
                        throw new Error("transfer to mortgage owner failed")
                    }
                }
                this.mortgages.del(mortgageItem.id)
                let userMortgageIds: Array<string> = this.userMortgageIds.get(mortgageItem.owner) || []
                if (userMortgageIds.indexOf(mortgageItem.id) >= 0) {
                    userMortgageIds.splice(userMortgageIds.indexOf(mortgageItem.id), 1)
                    this.userMortgageIds.set(mortgageItem.owner, userMortgageIds)
                }
                let allMortgageIds = this._allMortgageIds
                if (allMortgageIds.indexOf(mortgageItem.id) >= 0) {
                    allMortgageIds.splice(allMortgageIds.indexOf(mortgageItem.id), 1)
                    this._allMortgageIds = allMortgageIds
                }
            } else {
                // 抵押品足够，部分平仓, 负债和抵押品都减少部分
                mortgageItem.tokenBalance = mortgageItem.tokenBalance.minus(remainingNeedClearNasUsd)
                mortgageItem.collateralBalance = mortgageItem.collateralBalance.minus(remainingNeedClearNasUsd.div(price))
                sumClearedNasUsd = sumClearedNasUsd.plus(remainingNeedClearNasUsd)
                this.mortgages.set(mortgageItem.id, mortgageItem)
            }

            if (sumClearedNasUsd.gte(amount)) {
                // 平仓清算了足够的NASUSD了
                break
            }
        }
        // 如果没有足够深度的时候，暂停清算
        if (sumClearedNasUsd.lt(amount)) {
            throw new Error("have not enough mortgages, clear is pausing now, expect at least " + amount + " but got " + sumClearedNasUsd)
        }
        // 转账给清算人，扣除手续费，减少清算人相应的NASUSD余额
        let clearerCanGetNas = amount.div(price)
        let fee = clearerCanGetNas.mul(clearSmartCoinFeeRate)
        let clearerCanGetNasExcludeFee = clearerCanGetNas.minus(fee)
        config.ownerFeeBalance = config.ownerFeeBalance.plus(fee)
        this._config = config
        if (clearerCanGetNasExcludeFee.gt(0)) {
            if (!Blockchain.transfer(from, clearerCanGetNasExcludeFee)) {
                throw new Error("transfer to clearer failed")
            }
        }
        balance = balance.minus(amount)
        this.balances.set(from, balance)
        this.transferEvent(true, from, from, new BigNumber(0).minus(amount))

        this._totalSupply = this._totalSupply.minus(amount)
    },
    // owner将手续费收入池提现
    withdrawOwnerFeeBalance(amount) {
        if (!amount) {
            throw new Error("invalid argument")
        }
        amount = new BigNumber(amount)
        if (amount.lte(new BigNumber(0))) {
            throw new Error("invalid withdraw amount")
        }
        this.checkIsAdmin()
        let config: ConfigInfo = this.getConfig()
        if (config.ownerFeeBalance.lt(amount)) {
            throw new Error("not enough balance to withdraw")
        }
        if (!Blockchain.transfer(config.owner, amount)) {
            throw new Error("withdraw error")
        }
        config.ownerFeeBalance = config.ownerFeeBalance.minus(amount)
        this._config = config
    },

    // NASUSD-NAS交易所功能
    getUserOrders(userAddress) {
        let itemIds = this.userOrderIds.get(userAddress) || []
        let result = []
        for (let itemId of itemIds) {
            let item = this.orders.get(itemId)
            if (item) {
                result.push(item)
            }
        }
        return result
    },
    getAllOrders() {
        let itemIds = this._allOrderIds
        let result = []
        for (let itemId of itemIds) {
            let item = this.orders.get(itemId)
            if (item) {
                result.push(item)
            }
        }
        return result
    },
    getOrderById(id) {
        return this.orders.get(id)
    },
    getBuyOrders() {
        let allOrders = this.getAllOrders()
        let result: Array<OrderItem> = []
        for (let item of allOrders) {
            if (item.isBuy) {
                result.push(item)
            }
        }
        result.sort(function (a, b) {
            // 买单队列中，高价优先，时间早优先
            if (a.buyPrice.gt(b.buyPrice)) {
                return -1;
            } else if (a.buyPrice.lt(b.buyPrice)) {
                return 1;
            } else {
                return a.time - b.time
            }
        })
        return result
    },
    getSellOrders() {
        let allOrders = this.getAllOrders()
        let result: Array<OrderItem> = []
        for (let item of allOrders) {
            if (!item.isBuy) {
                result.push(item)
            }
        }
        result.sort(function (a, b) {
            // 卖单队列中，低价优先，时间早优先
            if (a.sellPrice.lt(b.sellPrice)) {
                return -1;
            } else if (a.sellPrice.gt(b.sellPrice)) {
                return 1;
            } else {
                return a.time - b.time
            }
        })
        return result
    },
    // 交易所中挂单购买,暂时交易免费
    marketBuy(buyPrice, tradeUnitAmount) {
        let config: ConfigInfo = this.getConfig()
        if (config.paused) {
            throw new Error("this contract is paused to trade")
        }
        if (!buyPrice || !tradeUnitAmount) {
            throw new Error("invalid arguments")
        }
        buyPrice = new BigNumber(buyPrice)
        tradeUnitAmount = new BigNumber(tradeUnitAmount)
        let maxNeedBaseUnitAmount = tradeUnitAmount.mul(buyPrice) // 最大需要支付的NASUSD数量
        if (!buyPrice || buyPrice.lte(0) || !maxNeedBaseUnitAmount || maxNeedBaseUnitAmount.lte(0)) {
            throw new Error("invalid arguments")
        }
        if (!config.allowBigAmount && tradeUnitAmount.gt(maxTradeNasAmount)) {
            throw new Error("big amount trade not allowed now")
        }
        let from = Blockchain.transaction.from
        let value = Blockchain.transaction.value // 挂买单时转账金额视作捐赠给开发者
        let time = Blockchain.transaction.timestamp
        if (value.gt(0)) {
            Blockchain.transfer(config.owner, value)
        }
        let balance = this.balances.get(from) || new BigNumber(0)
        if (maxNeedBaseUnitAmount.gt(balance)) {
            throw new Error("you have not enough balance to buy, expect " + maxNeedBaseUnitAmount + " and got " + balance)
        }
        let toTransferToBuyerNasAmount = new BigNumber(0) // 需要转账给挂单人的NAS数量

        // 在卖单队列中查找是否有合适价格的卖单，如果有，作为taker去成交，否则作为maker挂新单
        let sellOrders: Array<OrderItem> = this.getSellOrders() // 已经是排序好的卖单队列
        let remainingWantBuyNasAmount = tradeUnitAmount // 剩余想买的NAS数量
        if (sellOrders.length > 0 && sellOrders[0].sellPrice.lte(buyPrice)) {
            // 作为taker去成交，多余的部分再作为maker挂单
            for (let sellOrder of sellOrders) {
                if (sellOrder.sellPrice.gt(buyPrice)) {
                    break
                }
                if (sellOrder.remainingSellAmount.gt(remainingWantBuyNasAmount)) {
                    // 卖单足够，交易后结束撮合
                    sellOrder.remainingSellAmount = sellOrder.remainingSellAmount.minus(remainingWantBuyNasAmount)
                    toTransferToBuyerNasAmount = toTransferToBuyerNasAmount.plus(remainingWantBuyNasAmount)
                    remainingWantBuyNasAmount = new BigNumber(0)
                    this.orders.set(sellOrder.id, sellOrder)
                    let nasusdAmountInItem = remainingWantBuyNasAmount.mul(sellOrder.sellPrice)
                    // 给卖家增加NASUSD，买家减少NASUSD
                    this.balances.set(sellOrder.maker, new BigNumber(this.balances.get(sellOrder.maker) || new BigNumber(0)).plus(nasusdAmountInItem))
                    balance = balance.minus(nasusdAmountInItem)
                    this.transferEvent(true, from, sellOrder.maker, nasusdAmountInItem);
                    break
                } else {
                    // 卖单不够，交易后继续撮合
                    toTransferToBuyerNasAmount = toTransferToBuyerNasAmount.plus(sellOrder.remainingSellAmount)
                    remainingWantBuyNasAmount = remainingWantBuyNasAmount.minus(sellOrder.remainingSellAmount)
                    this.orders.del(sellOrder.id)

                    // 修改user orders, all orders
                    let userOrderIds: Array<string> = this.userOrderIds.get(sellOrder.maker) || []
                    if (userOrderIds.indexOf(sellOrder.id) >= 0) {
                        userOrderIds.splice(userOrderIds.indexOf(sellOrder.id), 1)
                        this.userOrderIds.set(sellOrder.maker, userOrderIds)
                    }
                    let allOrderIds: Array<string> = this._allOrderIds
                    if (allOrderIds.indexOf(sellOrder.id) >= 0) {
                        allOrderIds.splice(allOrderIds.indexOf(sellOrder.id), 1)
                        this._allOrderIds = allOrderIds
                    }

                    let nasusdAmountInItem = sellOrder.remainingSellAmount.mul(sellOrder.sellPrice)
                    // 给卖家增加NASUSD，买家减少NASUSD
                    this.balances.set(sellOrder.maker, new BigNumber(this.balances.get(sellOrder.maker) || new BigNumber(0)).plus(nasusdAmountInItem))
                    balance = balance.minus(nasusdAmountInItem)
                    this.transferEvent(true, from, sellOrder.maker, nasusdAmountInItem);
                }
            }
            // 如果还有多余的要买的NAS，挂新单，直接走入以下流程
        }
        // 用剩余想买的NAS数量挂新单
        let newOrder: OrderItem = null
        if (remainingWantBuyNasAmount.gt(0)) {
            let baseUnitAmountNeed = remainingWantBuyNasAmount.mul(buyPrice)
            let order = new OrderItem(null)
            order.id = Blockchain.transaction.hash
            order.time = time
            order.maker = from
            order.isBuy = true
            order.remainingBuyAmount = baseUnitAmountNeed
            order.totalBuyAmount = baseUnitAmountNeed
            order.buyPrice = buyPrice

            newOrder = order

            this.orders.set(order.id, order)

            balance = balance.minus(baseUnitAmountNeed) // 挂单时需要扣除金额

            let userOrderIds: Array<string> = this.userOrderIds.get(from) || []
            userOrderIds.push(order.id)
            this.userOrderIds.set(from, userOrderIds)

            let allOrderIds: Array<string> = this._allOrderIds
            allOrderIds.push(order.id)
            this._allOrderIds = allOrderIds
        }

        this.balances.set(from, balance)

        if (toTransferToBuyerNasAmount.gt(0)) {
            if (!Blockchain.transfer(from, toTransferToBuyerNasAmount)) {
                throw new Error("buy failed")
            }
        }
        return newOrder
    },
    // 交易所中卖出
    marketSell(sellPrice) {
        let config: ConfigInfo = this.getConfig()
        if (config.paused) {
            throw new Error("this contract is paused to trade")
        }
        if (!sellPrice) {
            throw new Error("invalid arguments")
        }
        sellPrice = new BigNumber(sellPrice)
        if (!sellPrice || sellPrice.lte(0)) {
            throw new Error("invalid arguments")
        }
        let from = Blockchain.transaction.from
        let tradeUnitAmount = Blockchain.transaction.value
        let time = Blockchain.transaction.timestamp
        if (tradeUnitAmount.lte(0)) {
            throw new Error("sell amount can't be empty")
        }

        let balance = new BigNumber(this.balances.get(from) || new BigNumber(0))

        // 在买单队列中查找是否有合适价格的买单，如果有，作为taker去成交，否则作为maker挂新单
        let buyOrders: Array<OrderItem> = this.getBuyOrders() // 已经是排序好的买单队列
        let remainingWantSellNasAmount = tradeUnitAmount // 剩余想卖的NAS数量
        if (buyOrders.length > 0 && buyOrders[0].buyPrice.gte(sellPrice)) {
            // 作为taker去成交，多余的部分再作为maker挂单
            for (let buyOrder of buyOrders) {
                if (buyOrder.buyPrice.lt(sellPrice)) {
                    break
                }
                let buyOrderRemainingWantNas = buyOrder.remainingBuyAmount.div(buyOrder.buyPrice)
                if (buyOrderRemainingWantNas.gt(remainingWantSellNasAmount)) {
                    // 买单足够，交易后结束撮合
                    let toTradeBaseUnitAmount = remainingWantSellNasAmount.mul(buyOrder.buyPrice) // 交易的NASUSD数量
                    let toTradeNasAmount = remainingWantSellNasAmount // 交易的NAS数量
                    buyOrder.remainingBuyAmount = buyOrder.remainingBuyAmount.minus(toTradeBaseUnitAmount)
                    balance = balance.plus(toTradeBaseUnitAmount)
                    remainingWantSellNasAmount = new BigNumber(0)
                    // 给买家转NAS
                    if (!Blockchain.transfer(buyOrder.maker, toTradeNasAmount)) {
                        throw new Error("transfer to buy order maker failed")
                    }

                    this.orders.set(buyOrder.id, buyOrder)

                    this.transferEvent(true, buyOrder.maker, from, toTradeBaseUnitAmount)
                    break
                } else {
                    // 买单不够，交易后继续撮合
                    let toTradeBaseUnitAmount = buyOrder.remainingBuyAmount // 交易的NASUSD数量
                    let toTradeNasAmount = toTradeBaseUnitAmount.div(buyOrder.buyPrice) // 交易的NAS数量
                    remainingWantSellNasAmount = remainingWantSellNasAmount.minus(toTradeNasAmount)

                    this.orders.del(buyOrder.id)

                    // 修改user orders, all orders
                    let userOrderIds: Array<string> = this.userOrderIds.get(buyOrder.maker) || []
                    if (userOrderIds.indexOf(buyOrder.id) >= 0) {
                        userOrderIds.splice(userOrderIds.indexOf(buyOrder.id), 1)
                        this.userOrderIds.set(buyOrder.maker, userOrderIds)
                    }
                    let allOrderIds: Array<string> = this._allOrderIds
                    if (allOrderIds.indexOf(buyOrder.id) >= 0) {
                        allOrderIds.splice(allOrderIds.indexOf(buyOrder.id), 1)
                        this._allOrderIds = allOrderIds
                    }

                    // 给卖家增加NASUSD，买家减少NASUSD
                    balance = balance.plus(toTradeBaseUnitAmount)
                    this.transferEvent(true, buyOrder.maker, from, toTradeBaseUnitAmount);
                }
            }
            // 如果还有多余的要卖的NAS，挂新单，直接走入以下流程
        }
        // 用剩余想卖的NAS数量挂新单
        let newOrder: OrderItem = null
        if (remainingWantSellNasAmount.gt(0)) {
            let order = new OrderItem(null)
            order.id = Blockchain.transaction.hash
            order.time = time
            order.maker = from
            order.isBuy = false
            order.remainingSellAmount = remainingWantSellNasAmount
            order.totalSellAmount = remainingWantSellNasAmount
            order.sellPrice = sellPrice

            newOrder = order

            this.orders.set(order.id, order)

            let userOrderIds: Array<string> = this.userOrderIds.get(from) || []
            userOrderIds.push(order.id)
            this.userOrderIds.set(from, userOrderIds)

            let allOrderIds: Array<string> = this._allOrderIds
            allOrderIds.push(order.id)
            this._allOrderIds = allOrderIds
        }

        this.balances.set(from, balance)
        return newOrder
    },
    // 交易所中取消订单
    marketCancelOrder(orderId) {
        let from = Blockchain.transaction.from
        let order: OrderItem = this.getOrderById(orderId)
        if (!order) {
            throw new Error("can't find this order")
        }
        if (order.maker !== from) {
            throw new Error("you aren't this order's maker, so you can't cancel it")
        }
        this.orders.del(order.id)

        // 修改urser orders, all orders
        let userOrderIds: Array<string> = this.userOrderIds.get(order.maker) || []
        if (userOrderIds.indexOf(order.id) >= 0) {
            userOrderIds.splice(userOrderIds.indexOf(order.id), 1)
            this.userOrderIds.set(order.maker, userOrderIds)
        }
        let allOrderIds: Array<string> = this._allOrderIds
        if (allOrderIds.indexOf(order.id) >= 0) {
            allOrderIds.splice(allOrderIds.indexOf(order.id), 1)
            this._allOrderIds = allOrderIds
        }

        // 取消挂单需要把钱退回
        if (order.isBuy) {
            // 退回NASUSD
            let balance = new BigNumber(this.balances.get(from) || new BigNumber(0))
            balance = balance.plus(order.remainingBuyAmount)
            this.balances.set(from, balance)
        } else {
            // 退回NAS
            let amountToBack = order.remainingSellAmount
            if (!Blockchain.transfer(order.maker, amountToBack)) {
                throw new Error("transfer to user failed when cancel order")
            }
        }
    },


    getConfig() {
        return this._config
    },

    // Returns the name of the token
    name: function () {
        return this._name;
    },

    // Returns the symbol of the token
    symbol: function () {
        return this._symbol;
    },

    // Returns the number of decimals the token uses
    decimals: function () {
        return this._decimals;
    },

    totalSupply: function () {
        return this._totalSupply.toString(10);
    },

    balanceOf: function (owner) {
        var balance = this.balances.get(owner);

        if (balance instanceof BigNumber) {
            return balance.toString(10);
        } else {
            return "0";
        }
    },

    transfer: function (to, value) {
        value = new BigNumber(value);
        if (value.lt(0)) {
            throw new Error("invalid value.");
        }

        var from = Blockchain.transaction.from;
        var balance = this.balances.get(from) || new BigNumber(0);

        if (balance.lt(value)) {
            throw new Error("transfer failed.");
        }

        this.balances.set(from, balance.sub(value));
        var toBalance = this.balances.get(to) || new BigNumber(0);
        this.balances.set(to, toBalance.add(value));

        this.transferEvent(true, from, to, value);
    },

    transferFrom: function (from, to, value) {
        var spender = Blockchain.transaction.from;
        var balance = this.balances.get(from) || new BigNumber(0);

        var allowed = this.allowed.get(from) || new Allowed(undefined);
        var allowedValue = allowed.get(spender) || new BigNumber(0);
        value = new BigNumber(value);

        if (value.gte(0) && balance.gte(value) && allowedValue.gte(value)) {

            this.balances.set(from, balance.sub(value));

            // update allowed value
            allowed.set(spender, allowedValue.sub(value));
            this.allowed.set(from, allowed);

            var toBalance = this.balances.get(to) || new BigNumber(0);
            this.balances.set(to, toBalance.add(value));

            this.transferEvent(true, from, to, value);
        } else {
            throw new Error("transfer failed.");
        }
    },

    transferEvent: function (status, from, to, value) {
        Event.Trigger(this.name(), {
            Status: status,
            Transfer: {
                from: from,
                to: to,
                value: value
            }
        });
    },

    approve: function (spender, currentValue, valueObj) {
        var from = Blockchain.transaction.from;

        var oldValue = this.allowance(from, spender);
        if (oldValue != currentValue.toString()) {
            throw new Error("current approve value mistake.");
        }

        var balance = new BigNumber(this.balanceOf(from));
        var value = new BigNumber(valueObj);

        if (value.lt(0) || balance.lt(value)) {
            throw new Error("invalid value.");
        }

        var owned = this.allowed.get(from) || new Allowed(undefined);
        owned.set(spender, value);

        this.allowed.set(from, owned);

        this.approveEvent(true, from, spender, value);
    },

    approveEvent: function (status, from, spender, value) {
        Event.Trigger(this.name(), {
            Status: status,
            Approve: {
                owner: from,
                spender: spender,
                value: value
            }
        });
    },

    allowance: function (owner, spender) {
        var owned = this.allowed.get(owner);

        if (owned instanceof Allowed) {
            var spender = owned.get(spender);
            if (typeof spender != "undefined") {
                return spender.toString(10);
            }
        }
        return "0";
    }
};

declare var module: any

module.exports = ContractService;
