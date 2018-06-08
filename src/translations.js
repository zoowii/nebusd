let chinese = {
    "Price Feeders": "喂价人列表",
    "Price": "价格",
    "price can't be empty": "价格不可为空",
    "price must be positive": "价格需要是正数",
    "this exchange is paused now": "交易所功能暂停服务中",
    "amount can't be empty": "数量不可为空",
    "amount must be positive": "数量需要是正数",
    "order submited": "挂单已提交",
    "order confirmed": "挂单已上链",
    "clear.mortgage": "平仓",
    "cancel mortgage submited": "平仓操作已提交",
    "mortgage cancel confirmed": "平仓操作已确认",
    "Refresh": "刷新",
    "you have not enough NASUSD balance to clear this mortgage, please get more NASUSD": "你没有足够NASUSD来平仓这个抵押单，请获取足够NASUSD后再尝试",
    "No sell orders": "目前没有卖单",
    "No buy orders": "目前没有买单",
    "Up is sell orders": "以上是卖单",
    "Below is buy orders": "以上是买单",
    "View My Orders": "我的挂单",
    "order cancel submited": "取消订单已提交",
    "order cancel confirmed": "取消订单已确认",
    "you have no enough NASUSD balance to buy, please change wallet to buy": "您没有足够NASUSD余额，请切换钱包后再买",
    "My Orders": "我的挂单",
    "Mortgage And Mint": "抵押发行",
    "Introduction": "介绍",
    "Exchange of NAS and NASUSD": "NAS和NASUSD交易所",
    "Status": "状态",
    "Have no NASUSD? you can buy from this exchange or mint NASUSD by mortgage NAS.": "没有NASUSD? 您可以从交易所购买或者抵押NAS发行NASUSD",
    "Your balance": "你的余额",
    "NAS/NASUSD Exchange Orders": "NAS/NASUSD 交易挂单",
    "Mortgage of NAS and NASUSD": "NASUSD抵押和发行",
    "Mint NASUSD": "抵押发行NASUSD",
    "Total Supply of NASUSD": "NASUSD总供应量",
    "NASUSD is NRC20 token": "NASUSD是一种NRC20资产",
    "Out Market Price": "NAS外部交易所价格",
    "NAS Buy Price": "NAS本内盘买一价",
    "NAS Sell Price": "NAS本内盘卖一价",
    "NAS/NASUSD Price": "NAS价格(/NASUSD)",
    "NAS Amount": "NAS数量",
    "What's NASUSD": "什么是NASUSD",
    "How to use NASUSD": "如何使用NASUSD",
    "Feed Price Admin Page": "喂价管理页面",
    "only when you are one of the feeder": "当你是喂价人时",
    "Feed Price": "喂价",
    "Buy": "买",
    "Sell": "卖",
    "Exchange": "交易所",
    "mortgage.mint": "抵押发行",
    "Help": "帮助",
    "feed": "喂价",
    "Menu": "菜单",
    "Donate": "捐赠",
    "intro.text": `NASUSD是一种基于星云链的智能代币+合约交易所，锚定美元。NASUSD原理类似BitShares上的BITCNY，你可以通过抵押至少3倍市值的NAS来发行NASUSD，
    也可以在本合约交易所种做NAS和NASUSD的交易。同时NASUSD也是一种NRC20资产，你可以直接转移给其他人`,
    "howtouse.text": `你可以在本合约交易所种和其他人交易NAS/NASUSD，也可以通过抵押至少3倍市值的NAS发行NASUSD。
    需要注意的是抵押单的抵押率会随着市价降低而降低，当抵押率降低到一定程度（160%)时会爆仓，或者抵押率较低的抵押单也可能因为其他用户清算NASUSD而平仓。
    如果您是NASUSD的持有者，您可以通过清算您手上的NASUSD将NASUSD清算为差不多市值的NAS`,
    "donate successfully!": "捐赠成功，你得到了一份作者的感谢！",
    "Convert NASUSD to NAS": "清算NASUSD为NAS",
    "invalid amount format": "错误的数量的格式",
    "to convert NASUSD amount can't be empty": "清算的数量不可为空",
    "Suspended trading with big amout(over 10NAS)": "已暂停大额交易",
}

let english = {
    "clear.mortgage": "Clear",
    "mortgage.mint": "Mint",
    "feed": "Feed",
    "intro.text": `
    NASUSD is a smart token and exchange dapp on nebulas chain, anchored to USD. Its principle is similar to BITUSD on bitshares.
    You can mint NASUSD by mortgage NAS(at least 3 times values), exchange NASUSD to NAS, exchagne NAS/NASUSD with each other, etc.
    At the same time, NASUSD is also a NRC20 token, so you can transfer it to other very friendly by NAS wallet.
    `,
    "howtouse.text": `
    You can exchagne NASUSD and NAS with each other in this dapp.
    You can also mint NASUSD by mortgage at least 3times values NAS to smart contract. Notice that the mortgage mey be destroyed when price is not safe enough(too low) or some other acquire convert NASUSD to same value NAS.
    When you have some NASUSD, you can also convert them to some NAS with almost equal value, on market-price.
    `,
}

let dicts = { chinese, english }

let currentLang = null

function changeLang(newLang) {
    currentLang = newLang
    localStorage.language = currentLang
}

function getLang() {
    if (!currentLang) {
        if (localStorage.language) {
            currentLang = localStorage.language
            return currentLang
        }
        if (window.navigator.language === 'zh-CN') {
            currentLang = 'chinese'
        } else {
            currentLang = 'english'
        }
        return currentLang
    } else {
        return currentLang
    }
}

function trans(message, lang) {
    lang = lang || getLang()
    return (dicts[lang] || english)[message] || message
}

export { dicts, trans, changeLang, getLang }