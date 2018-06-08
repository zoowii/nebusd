var originSubtle = null;
var browserCrypto = window.crypto || window.msCrypto; //for IE11
if (browserCrypto) {
    originSubtle = browserCrypto.subtle || browserCrypto.webkitSubtle
}

var crypto = require("crypto");
var eccrypto = require("eccrypto");

window.crypto = crypto;
if (!crypto.subtle) {
    crypto.subtle = originSubtle;
}
window.eccrypto = eccrypto;

function convertHexToBinary(hex) {
    return Buffer(new Uint8Array(hex.match(/[\da-f]{2}/gi).map(function (h) {
        return parseInt(h, 16)
    })));
}
window.convertHexToBinary = convertHexToBinary;

window.Buffer = Buffer;

function getNebUrl() {
    var useTestNet = window.location.search.indexOf('testnet=true') >= 0 ? true : false;
    return useTestNet ? "https://testnet.nebulas.io" : "https://mainnet.nebulas.io";
}


// nebPay的交易结果查询的最大尝试次数
var maxQueryCount = 6;

// TODO: use CancelablePromise
function waitTxResponse(txHash) {
    var handler = null;
    var promiseResolver = null;
    var promiseRejector = null;
    var promise = new Promise(function (resolve, reject) {
        promiseResolver = resolve;
        promiseRejector = reject;
        var tryCount = 0;
        handler = setInterval(function () {
            if (promise.canceledReason) {
                clearInterval(handler);
                handler = null;
                reject(promise.canceledReason);
                return;
            }
            tryCount += 1;
            if (tryCount > maxQueryCount) {
                clearInterval(handler);
                handler = null;
                reject("请求超时，请等20秒后刷新重试");
                return;
            }
            funcIntervalQuery2(txHash, function (data) {
                clearInterval(handler);
                handler = null;
                if (data && data.queryReturn) {
                    resolve(data.data);
                } else {
                    resolve(data);
                }
            }, function (arg) {
                var data = arg.data;
                var queryReturn = arg.queryReturn;
                if (queryReturn) {
                    clearInterval(handler);
                    handler = null;
                    reject(data);
                } else {
                    // 还可以继续尝试，不结束
                }
            });
        }, 5000);
    });
    promise.reject = function (err) {
        if (handler && promiseRejector) {
            clearInterval(handler);
            handler = null;
            promiseRejector(err);
        }
    };
    promise.resolve = function (data) {
        if (handler && promiseResolver) {
            clearInterval(handler);
            handler = null;
            promiseResolver(data);
        }
    };
    return promise;
}

function funcIntervalQuery2(txHash, resolve, reject) {
    var neburl = getNebUrl();
    axios.post(neburl + "/v1/user/getTransactionReceipt", { hash: txHash })
        .then(d => {
            if (d.data && d.data.result.execute_result !== "") {
                resolve(d.data.result);
            } else if (d.data.status === 0) {
                reject({ data: d.data, queryReturn: true });
            } else {
                reject({ data: d.data, queryReturn: false });
            }
        });
}

window.waitTxResponse = waitTxResponse;

function simulateCallContract(simulateFromAddress, toAddress, value, callFunction, callArgs, gasPrice, gasLimit) {
    var contract = {
        function: callFunction,
        args: callArgs
    };
    gasPrice = gasPrice || '1000000';
    gasLimit = gasLimit || '2000000';
    return neb.api.call(simulateFromAddress, toAddress, value, '0', gasPrice, gasLimit, contract).then(function (resp) {
        console.log(resp);
        if (resp.execute_err.length > 0) {
            throw new Error(resp.execute_err);
        }
        var result = JSON.parse(resp.result);
        if (!result) {
            throw new Error("访问合约API出错");
        }
        return result;
    });
}

window.simulateCallContract = simulateCallContract;

function callOnChainTx(simulateFromAddress, toAddress, value, simulateAddressNonce, gasPrice, gasLimit, callFunction, callArgs, sendTxHandler, txConfirmHandler, errorHandler) {
    var contract = callFunction ? {
        "function": callFunction,
        "args": callArgs
    } : null;
    errorHandler = errorHandler || showErrorInfo;

    neb.api.call(simulateFromAddress, toAddress, value, simulateAddressNonce, gasPrice, gasLimit, contract).then(function (resp) {
        console.log(resp);
        if (resp.execute_err.length > 0) {
            throw new Error(resp.execute_err);
        }
        var promise;
        var serialNumber = nebPay.call(toAddress, value, callFunction, callArgs, {
            listener: function (data) {
                if (JSON.stringify(data) === "\"Error: Transaction rejected by user\"") {
                    if (errorHandler) {
                        errorHandler("您拒绝了这笔交易");
                    }
                    return;
                }
                if (data.txhash) {
                    var txhash = data.txhash;
                    (sendTxHandler || window.showSuccessInfo || function () { })(data); // 不结束promise，为了等待链上确认结果
                    promise = waitTxResponse(txhash);
                    promise.then(function (data) {
                        if (data && data.from) {
                            window.currentUserAddress = data.from;
                        }
                        if (txConfirmHandler) {
                            txConfirmHandler(data);
                        }
                    }, function (err) {
                        errorHandler(err);
                    });
                } else {
                    if (errorHandler) {
                        errorHandler(data);
                    }
                }
            }
        });
    }).catch(function (err) {
        errorHandler(err.message || err);
    });
}

function directCallOnChainTx(toAddress, value, callFunction, callArgs, sendTxHandler, txConfirmHandler, errorHandler) {
    var contract = callFunction ? {
        "function": callFunction,
        "args": callArgs
    } : null;
    errorHandler = errorHandler || showErrorInfo;
    var promise;
    var serialNumber = nebPay.call(toAddress, value, callFunction, callArgs, {
        listener: function (data) {
            if (JSON.stringify(data) === "\"Error: Transaction rejected by user\"") {
                if (errorHandler) {
                    errorHandler("您拒绝了这笔交易");
                }
                return;
            }
            if (data.txhash) {
                var txhash = data.txhash;
                (sendTxHandler || showSuccessInfo || function () { })(data); // 不结束promise，为了等待链上确认结果
                promise = waitTxResponse(txhash);
                promise.then(function (data) {
                    if (data && data.from) {
                        window.currentUserAddress = data.from;
                    }
                    if (txConfirmHandler) {
                        txConfirmHandler(data);
                    }
                }, function (err) {
                    errorHandler(err);
                });
            } else {
                if (errorHandler) {
                    errorHandler(data);
                }
            }
        }
    });
}

window.callOnChainTx = callOnChainTx;
window.directCallOnChainTx = directCallOnChainTx;