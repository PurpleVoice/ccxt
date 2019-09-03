'use strict';

//  ---------------------------------------------------------------------------

const Exchange = require ('./base/Exchange');
const { ExchangeError, ArgumentsRequired, InvalidNonce, OrderNotFound, InvalidOrder, InsufficientFunds, AuthenticationError, DDoSProtection, NotSupported } = require ('./base/errors');

//  ---------------------------------------------------------------------------

module.exports = class liquid extends Exchange {
    describe () {
        return this.deepExtend (super.describe (), {
            'id': 'liquid',
            'name': 'Liquid',
            'countries': [ 'JP', 'CN', 'TW' ],
            'version': '2',
            'rateLimit': 1000,
            'has': {
                'CORS': false,
                'fetchCurrencies': true,
                'fetchTickers': true,
                'fetchOrder': true,
                'fetchOrders': true,
                'fetchOpenOrders': true,
                'fetchClosedOrders': true,
                'fetchMyTrades': true,
            },
            'urls': {
                'logo': 'https://user-images.githubusercontent.com/1294454/45798859-1a872600-bcb4-11e8-8746-69291ce87b04.jpg',
                'api': 'https://api.liquid.com',
                'www': 'https://www.liquid.com',
                'doc': [
                    'https://developers.liquid.com',
                ],
                'fees': 'https://help.liquid.com/getting-started-with-liquid/the-platform/fee-structure',
                'referral': 'https://www.liquid.com?affiliate=SbzC62lt30976',
            },
            'api': {
                'public': {
                    'get': [
                        'currencies',
                        'products',
                        'products/{id}',
                        'products/{id}/price_levels',
                        'executions',
                        'ir_ladders/{currency}',
                    ],
                },
                'private': {
                    'get': [
                        'accounts/balance',
                        'accounts/main_asset',
                        'accounts/{id}',
                        'crypto_accounts',
                        'executions/me',
                        'fiat_accounts',
                        'loan_bids',
                        'loans',
                        'orders',
                        'orders/{id}',
                        'orders/{id}/trades',
                        'orders/{id}/executions',
                        'trades',
                        'trades/{id}/loans',
                        'trading_accounts',
                        'trading_accounts/{id}',
                        'transactions',
                    ],
                    'post': [
                        'fiat_accounts',
                        'loan_bids',
                        'orders',
                    ],
                    'put': [
                        'loan_bids/{id}/close',
                        'loans/{id}',
                        'orders/{id}',
                        'orders/{id}/cancel',
                        'trades/{id}',
                        'trades/{id}/close',
                        'trades/close_all',
                        'trading_accounts/{id}',
                    ],
                },
            },
            'exceptions': {
                'API rate limit exceeded. Please retry after 300s': DDoSProtection,
                'API Authentication failed': AuthenticationError,
                'Nonce is too small': InvalidNonce,
                'Order not found': OrderNotFound,
                'Can not update partially filled order': InvalidOrder,
                'Can not update non-live order': OrderNotFound,
                'not_enough_free_balance': InsufficientFunds,
                'must_be_positive': InvalidOrder,
                'less_than_order_size': InvalidOrder,
            },
            'commonCurrencies': {
                'WIN': 'WCOIN',
                'HOT': 'HOT Token',
            },
            'options': {
                'cancelOrderException': true,
            },
            'wsconf': {
                'conx-tpls': {
                    'default': {
                        'type': 'pusher',
                        'baseurl': 'wss://ws.pusherapp.com/app/2ff981bb060680b5ce97',
                    },
                },
                'methodmap': {
                    '_websocketTimeoutRemoveNonce': '_websocketTimeoutRemoveNonce',
                },
                'events': {
                    'ob': {
                        'conx-tpl': 'default',
                        'conx-param': {
                            'url': '{baseurl}',
                            'id': '{id}',
                        },
                    },
                },
            },
        });
    }

    async fetchCurrencies (params = {}) {
        const response = await this.publicGetCurrencies (params);
        //
        //     [
        //         {
        //             currency_type: 'fiat',
        //             currency: 'USD',
        //             symbol: '$',
        //             assets_precision: 2,
        //             quoting_precision: 5,
        //             minimum_withdrawal: '15.0',
        //             withdrawal_fee: 5,
        //             minimum_fee: null,
        //             minimum_order_quantity: null,
        //             display_precision: 2,
        //             depositable: true,
        //             withdrawable: true,
        //             discount_fee: 0.5,
        //         },
        //     ]
        //
        const result = {};
        for (let i = 0; i < response.length; i++) {
            const currency = response[i];
            const id = this.safeString (currency, 'currency');
            const code = this.safeCurrencyCode (id);
            const active = currency['depositable'] && currency['withdrawable'];
            const amountPrecision = this.safeInteger (currency, 'display_precision');
            const pricePrecision = this.safeInteger (currency, 'quoting_precision');
            const precision = Math.max (amountPrecision, pricePrecision);
            result[code] = {
                'id': id,
                'code': code,
                'info': currency,
                'name': code,
                'active': active,
                'fee': this.safeFloat (currency, 'withdrawal_fee'),
                'precision': precision,
                'limits': {
                    'amount': {
                        'min': Math.pow (10, -amountPrecision),
                        'max': Math.pow (10, amountPrecision),
                    },
                    'price': {
                        'min': Math.pow (10, -pricePrecision),
                        'max': Math.pow (10, pricePrecision),
                    },
                    'cost': {
                        'min': undefined,
                        'max': undefined,
                    },
                    'withdraw': {
                        'min': this.safeFloat (currency, 'minimum_withdrawal'),
                        'max': undefined,
                    },
                },
            };
        }
        return result;
    }

    async fetchMarkets (params = {}) {
        const markets = await this.publicGetProducts ();
        //
        //     [
        //         {
        //             id: '7',
        //             product_type: 'CurrencyPair',
        //             code: 'CASH',
        //             name: ' CASH Trading',
        //             market_ask: 8865.79147,
        //             market_bid: 8853.95988,
        //             indicator: 1,
        //             currency: 'SGD',
        //             currency_pair_code: 'BTCSGD',
        //             symbol: 'S$',
        //             btc_minimum_withdraw: null,
        //             fiat_minimum_withdraw: null,
        //             pusher_channel: 'product_cash_btcsgd_7',
        //             taker_fee: 0,
        //             maker_fee: 0,
        //             low_market_bid: '8803.25579',
        //             high_market_ask: '8905.0',
        //             volume_24h: '15.85443468',
        //             last_price_24h: '8807.54625',
        //             last_traded_price: '8857.77206',
        //             last_traded_quantity: '0.00590974',
        //             quoted_currency: 'SGD',
        //             base_currency: 'BTC',
        //             disabled: false,
        //         },
        //     ]
        //
        const currencies = await this.fetchCurrencies ();
        const currenciesByCode = this.indexBy (currencies, 'code');
        const result = [];
        for (let i = 0; i < markets.length; i++) {
            const market = markets[i];
            const id = market['id'].toString ();
            const baseId = market['base_currency'];
            const quoteId = market['quoted_currency'];
            const base = this.safeCurrencyCode (baseId);
            const quote = this.safeCurrencyCode (quoteId);
            const symbol = base + '/' + quote;
            const maker = this.safeFloat (market, 'maker_fee');
            const taker = this.safeFloat (market, 'taker_fee');
            const active = !market['disabled'];
            const baseCurrency = this.safeValue (currenciesByCode, base);
            const quoteCurrency = this.safeValue (currenciesByCode, quote);
            const precision = {
                'amount': 8,
                'price': 8,
            };
            let minAmount = undefined;
            if (baseCurrency !== undefined) {
                minAmount = this.safeFloat (baseCurrency['info'], 'minimum_order_quantity');
                // precision['amount'] = this.safeInteger (baseCurrency['info'], 'quoting_precision');
            }
            let minPrice = undefined;
            if (quoteCurrency !== undefined) {
                precision['price'] = this.safeInteger (quoteCurrency['info'], 'quoting_precision');
                minPrice = Math.pow (10, -precision['price']);
            }
            let minCost = undefined;
            if (minPrice !== undefined) {
                if (minAmount !== undefined) {
                    minCost = minPrice * minAmount;
                }
            }
            const limits = {
                'amount': {
                    'min': minAmount,
                    'max': undefined,
                },
                'price': {
                    'min': minPrice,
                    'max': undefined,
                },
                'cost': {
                    'min': minCost,
                    'max': undefined,
                },
            };
            result.push ({
                'id': id,
                'symbol': symbol,
                'base': base,
                'quote': quote,
                'baseId': baseId,
                'quoteId': quoteId,
                'maker': maker,
                'taker': taker,
                'limits': limits,
                'precision': precision,
                'active': active,
                'info': market,
            });
        }
        return result;
    }

    async fetchBalance (params = {}) {
        await this.loadMarkets ();
        const response = await this.privateGetAccountsBalance (params);
        //
        //     [
        //         {"currency":"USD","balance":"0.0"},
        //         {"currency":"BTC","balance":"0.0"},
        //         {"currency":"ETH","balance":"0.1651354"}
        //     ]
        //
        const result = { 'info': response };
        for (let i = 0; i < response.length; i++) {
            const balance = response[i];
            const currencyId = this.safeString (balance, 'currency');
            const code = this.safeCurrencyCode (currencyId);
            const account = this.account ();
            account['total'] = this.safeFloat (balance, 'balance');
            result[code] = account;
        }
        return this.parseBalance (result);
    }

    async fetchOrderBook (symbol, limit = undefined, params = {}) {
        await this.loadMarkets ();
        const request = {
            'id': this.marketId (symbol),
        };
        const response = await this.publicGetProductsIdPriceLevels (this.extend (request, params));
        return this.parseOrderBook (response, undefined, 'buy_price_levels', 'sell_price_levels');
    }

    parseTicker (ticker, market = undefined) {
        const timestamp = this.milliseconds ();
        let last = undefined;
        if ('last_traded_price' in ticker) {
            if (ticker['last_traded_price']) {
                const length = ticker['last_traded_price'].length;
                if (length > 0) {
                    last = this.safeFloat (ticker, 'last_traded_price');
                }
            }
        }
        let symbol = undefined;
        if (market === undefined) {
            const marketId = this.safeString (ticker, 'id');
            if (marketId in this.markets_by_id) {
                market = this.markets_by_id[marketId];
            } else {
                const baseId = this.safeString (ticker, 'base_currency');
                const quoteId = this.safeString (ticker, 'quoted_currency');
                if (symbol in this.markets) {
                    market = this.markets[symbol];
                } else {
                    symbol = this.safeCurrencyCode (baseId) + '/' + this.safeCurrencyCode (quoteId);
                }
            }
        }
        if (market !== undefined) {
            symbol = market['symbol'];
        }
        let change = undefined;
        let percentage = undefined;
        let average = undefined;
        const open = this.safeFloat (ticker, 'last_price_24h');
        if (open !== undefined && last !== undefined) {
            change = last - open;
            average = this.sum (last, open) / 2;
            if (open > 0) {
                percentage = change / open * 100;
            }
        }
        return {
            'symbol': symbol,
            'timestamp': timestamp,
            'datetime': this.iso8601 (timestamp),
            'high': this.safeFloat (ticker, 'high_market_ask'),
            'low': this.safeFloat (ticker, 'low_market_bid'),
            'bid': this.safeFloat (ticker, 'market_bid'),
            'bidVolume': undefined,
            'ask': this.safeFloat (ticker, 'market_ask'),
            'askVolume': undefined,
            'vwap': undefined,
            'open': open,
            'close': last,
            'last': last,
            'previousClose': undefined,
            'change': change,
            'percentage': percentage,
            'average': average,
            'baseVolume': this.safeFloat (ticker, 'volume_24h'),
            'quoteVolume': undefined,
            'info': ticker,
        };
    }

    async fetchTickers (symbols = undefined, params = {}) {
        await this.loadMarkets ();
        const response = await this.publicGetProducts (params);
        const result = {};
        for (let i = 0; i < response.length; i++) {
            const ticker = this.parseTicker (response[i]);
            const symbol = ticker['symbol'];
            result[symbol] = ticker;
        }
        return result;
    }

    async fetchTicker (symbol, params = {}) {
        await this.loadMarkets ();
        const market = this.market (symbol);
        const request = {
            'id': market['id'],
        };
        const response = await this.publicGetProductsId (this.extend (request, params));
        return this.parseTicker (response, market);
    }

    parseTrade (trade, market) {
        // {             id:  12345,
        //         quantity: "6.789",
        //            price: "98765.4321",
        //       taker_side: "sell",
        //       created_at:  1512345678,
        //          my_side: "buy"           }
        const timestamp = this.safeTimestamp (trade, 'created_at');
        const orderId = this.safeString (trade, 'order_id');
        // 'taker_side' gets filled for both fetchTrades and fetchMyTrades
        const takerSide = this.safeString (trade, 'taker_side');
        // 'my_side' gets filled for fetchMyTrades only and may differ from 'taker_side'
        const mySide = this.safeString (trade, 'my_side');
        const side = (mySide !== undefined) ? mySide : takerSide;
        let takerOrMaker = undefined;
        if (mySide !== undefined) {
            takerOrMaker = (takerSide === mySide) ? 'taker' : 'maker';
        }
        let cost = undefined;
        const price = this.safeFloat (trade, 'price');
        const amount = this.safeFloat (trade, 'quantity');
        if (price !== undefined) {
            if (amount !== undefined) {
                cost = price * amount;
            }
        }
        const id = this.safeString (trade, 'id');
        return {
            'info': trade,
            'id': id,
            'order': orderId,
            'timestamp': timestamp,
            'datetime': this.iso8601 (timestamp),
            'symbol': market['symbol'],
            'type': undefined,
            'side': side,
            'takerOrMaker': takerOrMaker,
            'price': price,
            'amount': amount,
            'cost': cost,
            'fee': undefined,
        };
    }

    async fetchTrades (symbol, since = undefined, limit = undefined, params = {}) {
        await this.loadMarkets ();
        const market = this.market (symbol);
        const request = {
            'product_id': market['id'],
        };
        if (limit !== undefined) {
            request['limit'] = limit;
        }
        if (since !== undefined) {
            // timestamp should be in seconds, whereas we use milliseconds in since and everywhere
            request['timestamp'] = parseInt (since / 1000);
        }
        const response = await this.publicGetExecutions (this.extend (request, params));
        const result = (since !== undefined) ? response : response['models'];
        return this.parseTrades (result, market, since, limit);
    }

    async fetchMyTrades (symbol = undefined, since = undefined, limit = undefined, params = {}) {
        await this.loadMarkets ();
        const market = this.market (symbol);
        // the `with_details` param is undocumented - it adds the order_id to the results
        const request = {
            'product_id': market['id'],
            'with_details': true,
        };
        if (limit !== undefined) {
            request['limit'] = limit;
        }
        const response = await this.privateGetExecutionsMe (this.extend (request, params));
        return this.parseTrades (response['models'], market, since, limit);
    }

    async createOrder (symbol, type, side, amount, price = undefined, params = {}) {
        await this.loadMarkets ();
        const request = {
            'order_type': type,
            'product_id': this.marketId (symbol),
            'side': side,
            'quantity': this.amountToPrecision (symbol, amount),
        };
        if (type === 'limit') {
            request['price'] = this.priceToPrecision (symbol, price);
        }
        const response = await this.privatePostOrders (this.extend (request, params));
        //
        //     {
        //         "id": 2157474,
        //         "order_type": "limit",
        //         "quantity": "0.01",
        //         "disc_quantity": "0.0",
        //         "iceberg_total_quantity": "0.0",
        //         "side": "sell",
        //         "filled_quantity": "0.0",
        //         "price": "500.0",
        //         "created_at": 1462123639,
        //         "updated_at": 1462123639,
        //         "status": "live",
        //         "leverage_level": 1,
        //         "source_exchange": "QUOINE",
        //         "product_id": 1,
        //         "product_code": "CASH",
        //         "funding_currency": "USD",
        //         "currency_pair_code": "BTCUSD",
        //         "order_fee": "0.0"
        //     }
        //
        return this.parseOrder (response);
    }

    async cancelOrder (id, symbol = undefined, params = {}) {
        await this.loadMarkets ();
        const request = {
            'id': id,
        };
        const response = await this.privatePutOrdersIdCancel (this.extend (request, params));
        const order = this.parseOrder (response);
        if (order['status'] === 'closed') {
            if (this.options['cancelOrderException']) {
                throw new OrderNotFound (this.id + ' order closed already: ' + this.json (response));
            }
        }
        return order;
    }

    async editOrder (id, symbol, type, side, amount, price = undefined, params = {}) {
        await this.loadMarkets ();
        if (price === undefined) {
            throw new ArgumentsRequired (this.id + ' editOrder requires the price argument');
        }
        const request = {
            'order': {
                'quantity': this.amountToPrecision (symbol, amount),
                'price': this.priceToPrecision (symbol, price),
            },
            'id': id,
        };
        const response = await this.privatePutOrdersId (this.extend (request, params));
        return this.parseOrder (response);
    }

    parseOrderStatus (status) {
        const statuses = {
            'live': 'open',
            'filled': 'closed',
            'cancelled': 'canceled',
        };
        return this.safeString (statuses, status, status);
    }

    parseOrder (order, market = undefined) {
        //
        // createOrder
        //
        //     {
        //         "id": 2157474,
        //         "order_type": "limit",
        //         "quantity": "0.01",
        //         "disc_quantity": "0.0",
        //         "iceberg_total_quantity": "0.0",
        //         "side": "sell",
        //         "filled_quantity": "0.0",
        //         "price": "500.0",
        //         "created_at": 1462123639,
        //         "updated_at": 1462123639,
        //         "status": "live",
        //         "leverage_level": 1,
        //         "source_exchange": "QUOINE",
        //         "product_id": 1,
        //         "product_code": "CASH",
        //         "funding_currency": "USD",
        //         "currency_pair_code": "BTCUSD",
        //         "order_fee": "0.0"
        //     }
        //
        // fetchOrder, fetchOrders, fetchOpenOrders, fetchClosedOrders
        //
        //     {
        //         "id": 2157479,
        //         "order_type": "limit",
        //         "quantity": "0.01",
        //         "disc_quantity": "0.0",
        //         "iceberg_total_quantity": "0.0",
        //         "side": "sell",
        //         "filled_quantity": "0.01",
        //         "price": "500.0",
        //         "created_at": 1462123639,
        //         "updated_at": 1462123639,
        //         "status": "filled",
        //         "leverage_level": 2,
        //         "source_exchange": "QUOINE",
        //         "product_id": 1,
        //         "product_code": "CASH",
        //         "funding_currency": "USD",
        //         "currency_pair_code": "BTCUSD",
        //         "order_fee": "0.0",
        //         "executions": [
        //             {
        //                 "id": 4566133,
        //                 "quantity": "0.01",
        //                 "price": "500.0",
        //                 "taker_side": "buy",
        //                 "my_side": "sell",
        //                 "created_at": 1465396785
        //             }
        //         ]
        //     }
        //
        const orderId = this.safeString (order, 'id');
        const timestamp = this.safeTimestamp (order, 'created_at');
        const marketId = this.safeString (order, 'product_id');
        market = this.safeValue (this.markets_by_id, marketId);
        const status = this.parseOrderStatus (this.safeString (order, 'status'));
        const amount = this.safeFloat (order, 'quantity');
        let filled = this.safeFloat (order, 'filled_quantity');
        const price = this.safeFloat (order, 'price');
        let symbol = undefined;
        let feeCurrency = undefined;
        if (market !== undefined) {
            symbol = market['symbol'];
            feeCurrency = market['quote'];
        }
        const type = this.safeString (order, 'order_type');
        let tradeCost = 0;
        let tradeFilled = 0;
        let average = this.safeFloat (order, 'average_price');
        const trades = this.parseTrades (this.safeValue (order, 'executions', []), market, undefined, undefined, {
            'order': orderId,
            'type': type,
        });
        const numTrades = trades.length;
        for (let i = 0; i < numTrades; i++) {
            // php copies values upon assignment, but not references them
            // todo rewrite this (shortly)
            const trade = trades[i];
            trade['order'] = orderId;
            trade['type'] = type;
            tradeFilled = this.sum (tradeFilled, trade['amount']);
            tradeCost = this.sum (tradeCost, trade['cost']);
        }
        let cost = undefined;
        let lastTradeTimestamp = undefined;
        if (numTrades > 0) {
            lastTradeTimestamp = trades[numTrades - 1]['timestamp'];
            if (!average && (tradeFilled > 0)) {
                average = tradeCost / tradeFilled;
            }
            if (cost === undefined) {
                cost = tradeCost;
            }
            if (filled === undefined) {
                filled = tradeFilled;
            }
        }
        let remaining = undefined;
        if (amount !== undefined && filled !== undefined) {
            remaining = amount - filled;
        }
        const side = this.safeString (order, 'side');
        return {
            'id': orderId,
            'timestamp': timestamp,
            'datetime': this.iso8601 (timestamp),
            'lastTradeTimestamp': lastTradeTimestamp,
            'type': type,
            'status': status,
            'symbol': symbol,
            'side': side,
            'price': price,
            'amount': amount,
            'filled': filled,
            'cost': cost,
            'remaining': remaining,
            'average': average,
            'trades': trades,
            'fee': {
                'currency': feeCurrency,
                'cost': this.safeFloat (order, 'order_fee'),
            },
            'info': order,
        };
    }

    async fetchOrder (id, symbol = undefined, params = {}) {
        await this.loadMarkets ();
        const request = {
            'id': id,
        };
        const response = await this.privateGetOrdersId (this.extend (request, params));
        return this.parseOrder (response);
    }

    async fetchOrders (symbol = undefined, since = undefined, limit = undefined, params = {}) {
        await this.loadMarkets ();
        let market = undefined;
        const request = {
            // 'funding_currency': market['quoteId'], // filter orders based on "funding" currency (quote currency)
            // 'product_id': market['id'],
            // 'status': 'live', // 'filled', 'cancelled'
            // 'trading_type': 'spot', // 'margin', 'cfd'
            'with_details': 1, // return full order details including executions
        };
        if (symbol !== undefined) {
            market = this.market (symbol);
            request['product_id'] = market['id'];
        }
        if (limit !== undefined) {
            request['limit'] = limit;
        }
        const response = await this.privateGetOrders (this.extend (request, params));
        //
        //     {
        //         "models": [
        //             {
        //                 "id": 2157474,
        //                 "order_type": "limit",
        //                 "quantity": "0.01",
        //                 "disc_quantity": "0.0",
        //                 "iceberg_total_quantity": "0.0",
        //                 "side": "sell",
        //                 "filled_quantity": "0.0",
        //                 "price": "500.0",
        //                 "created_at": 1462123639,
        //                 "updated_at": 1462123639,
        //                 "status": "live",
        //                 "leverage_level": 1,
        //                 "source_exchange": "QUOINE",
        //                 "product_id": 1,
        //                 "product_code": "CASH",
        //                 "funding_currency": "USD",
        //                 "currency_pair_code": "BTCUSD",
        //                 "order_fee": "0.0",
        //                 "executions": [], // optional
        //             }
        //         ],
        //         "current_page": 1,
        //         "total_pages": 1
        //     }
        //
        const orders = this.safeValue (response, 'models', []);
        return this.parseOrders (orders, market, since, limit);
    }

    fetchOpenOrders (symbol = undefined, since = undefined, limit = undefined, params = {}) {
        const request = { 'status': 'live' };
        return this.fetchOrders (symbol, since, limit, this.extend (request, params));
    }

    fetchClosedOrders (symbol = undefined, since = undefined, limit = undefined, params = {}) {
        const request = { 'status': 'filled' };
        return this.fetchOrders (symbol, since, limit, this.extend (request, params));
    }

    nonce () {
        return this.milliseconds ();
    }

    sign (path, api = 'public', method = 'GET', params = {}, headers = undefined, body = undefined) {
        let url = '/' + this.implodeParams (path, params);
        const query = this.omit (params, this.extractParams (path));
        headers = {
            'X-Quoine-API-Version': this.version,
            'Content-Type': 'application/json',
        };
        if (api === 'private') {
            this.checkRequiredCredentials ();
            if (method === 'GET') {
                if (Object.keys (query).length) {
                    url += '?' + this.urlencode (query);
                }
            } else if (Object.keys (query).length) {
                body = this.json (query);
            }
            const nonce = this.nonce ();
            const request = {
                'path': url,
                'nonce': nonce,
                'token_id': this.apiKey,
                'iat': Math.floor (nonce / 1000), // issued at
            };
            headers['X-Quoine-Auth'] = this.jwt (request, this.encode (this.secret));
        } else {
            if (Object.keys (query).length) {
                url += '?' + this.urlencode (query);
            }
        }
        url = this.urls['api'] + url;
        return { 'url': url, 'method': method, 'body': body, 'headers': headers };
    }

    handleErrors (code, reason, url, method, headers, body, response, requestHeaders, requestBody) {
        if (code >= 200 && code < 300) {
            return;
        }
        const exceptions = this.exceptions;
        if (code === 401) {
            // expected non-json response
            if (body in exceptions) {
                throw new exceptions[body] (this.id + ' ' + body);
            } else {
                return;
            }
        }
        if (code === 429) {
            throw new DDoSProtection (this.id + ' ' + body);
        }
        if (response === undefined) {
            return;
        }
        const feedback = this.id + ' ' + body;
        const message = this.safeString (response, 'message');
        const errors = this.safeValue (response, 'errors');
        if (message !== undefined) {
            //
            //  { "message": "Order not found" }
            //
            if (message in exceptions) {
                throw new exceptions[message] (feedback);
            }
        } else if (errors !== undefined) {
            //
            //  { "errors": { "user": ["not_enough_free_balance"] }}
            //  { "errors": { "quantity": ["less_than_order_size"] }}
            //  { "errors": { "order": ["Can not update partially filled order"] }}
            //
            const types = Object.keys (errors);
            for (let i = 0; i < types.length; i++) {
                const type = types[i];
                const errorMessages = errors[type];
                for (let j = 0; j < errorMessages.length; j++) {
                    const message = errorMessages[j];
                    if (message in exceptions) {
                        throw new exceptions[message] (feedback);
                    }
                }
            }
        } else {
            throw new ExchangeError (feedback);
        }
    }

    _websocketOnMessage (contextId, data) {
        let msg = JSON.parse (data);
        // console.log (data);
        let evt = this.safeString (msg, 'event');
        if (evt === 'subscription_succeeded') {
            this._websocketHandleSubscription (contextId, msg);
        } else if (evt === 'updated') {
            let chan = this.safeString (msg, 'channel');
            if (chan.indexOf ('price_ladders_cash_') >= 0) {
                this._websocketHandleOrderbook (contextId, msg);
            }
        }
    }

    _websocketHandleOrderbook (contextId, msg) {
        let chan = this.safeString (msg, 'channel');
        let parts = chan.split ('_');
        let symbol = parts[3];
        const symbolMap = this._contextGet (contextId, 'symbolmap');
        if (symbol in symbolMap) {
            symbol = symbolMap[symbol];
        }
        const symbolData = this._contextGetSymbolData (contextId, 'ob', symbol);
        if (!('ob' in symbolData)) {
            symbolData['ob'] = {
                'nonce': undefined,
                'timestamp': undefined,
                'datetime': undefined,
                'bids': [],
                'asks': [],
            };
        }
        let data = this.safeValue (msg, 'data');
        if (parts[4] === 'buy') {
            symbolData['ob']['bids'] = data;
        } else {
            symbolData['ob']['asks'] = data;
        }
        this.emit ('ob', symbol, this._cloneOrderBook (symbolData['ob'], symbolData['limit']));
        this._contextSetSymbolData (contextId, 'ob', symbol, symbolData);
    }

    _websocketHandleSubscription (contextId, msg) {
        let chan = this.safeString (msg, 'channel');
        if (chan.indexOf ('price_ladders_cash_') >= 0) {
            let parts = chan.split ('_');
            let symbol = parts[3];
            const symbolMap = this._contextGet (contextId, 'symbolmap');
            if (symbol in symbolMap) {
                symbol = symbolMap[symbol];
            }
            let buyOrSell = (parts[4] === 'buy') ? 'buy_sub' : 'sell_sub';
            let symbolData = this._contextGetSymbolData (contextId, 'ob', symbol);
            if ('sub-nonces' in symbolData) {
                let nonces = symbolData['sub-nonces'];
                const keys = Object.keys (nonces);
                for (let i = 0; i < keys.length; i++) {
                    let nonce = keys[i];
                    nonces[nonce][buyOrSell] = true;
                    if ((nonces[nonce]['buy_sub']) && (nonces[nonce]['sell_sub'])) {
                        this._cancelTimeout (nonces[nonce]['handle']);
                        this.emit (nonce, true);
                        this.omit (symbolData['sub-nonces'], nonce);
                    }
                }
                symbolData['sub-nonces'] = nonces;
                this._contextSetSymbolData (contextId, 'ob', symbol, symbolData);
            }
        }
    }

    _websocketOnOpen (contextId, websocketOptions) { // eslint-disable-line no-unused-vars
        let symbolMap = {};
        this._contextSet (contextId, 'symbolmap', symbolMap);
    }

    _websocketSubscribe (contextId, event, symbol, nonce, params = {}) {
        if (event !== 'ob') {
            throw new NotSupported ('subscribe ' + event + '(' + symbol + ') not supported for exchange ' + this.id);
        }
        // save nonce for subscription response
        let symbolData = this._contextGetSymbolData (contextId, event, symbol);
        if (!('sub-nonces' in symbolData)) {
            symbolData['sub-nonces'] = {};
        }
        symbolData['limit'] = this.safeInteger (params, 'limit', undefined);
        let nonceStr = nonce.toString ();
        let handle = this._setTimeout (contextId, this.timeout, this._websocketMethodMap ('_websocketTimeoutRemoveNonce'), [contextId, nonceStr, event, symbol, 'sub-nonce']);
        symbolData['sub-nonces'][nonceStr] = {
            'handle': handle,
            'buy_sub': false,
            'sell_sub': false,
        };
        this._contextSetSymbolData (contextId, event, symbol, symbolData);
        // send request
        const id = this._websocketMarketId (symbol);
        const symbolMap = this._contextGet (contextId, 'symbolmap');
        symbolMap[id] = symbol;
        this._contextSet (contextId, 'symbolmap', symbolMap);
        this.websocketSendJson ({
            'event': 'subscribe',
            'channel': 'price_ladders_cash_' + id + '_buy',
        }, contextId);
        this.websocketSendJson ({
            'event': 'subscribe',
            'channel': 'price_ladders_cash_' + id + '_sell',
        }, contextId);
    }

    _websocketUnsubscribe (contextId, event, symbol, nonce, params = {}) {
        if (event !== 'ob') {
            throw new NotSupported ('unsubscribe ' + event + '(' + symbol + ') not supported for exchange ' + this.id);
        }
        let id = this._websocketMarketId (symbol);
        this.websocketSendJson ({
            'event': 'unsubscribe',
            'channel': 'price_ladders_cash_' + id + '_buy',
        });
        this.websocketSendJson ({
            'event': 'unsubscribe',
            'channel': 'price_ladders_cash_' + id + '_sell',
        });
        let nonceStr = nonce.toString ();
        this.emit (nonceStr, true);
    }

    _websocketTimeoutRemoveNonce (contextId, timerNonce, event, symbol, key) {
        let symbolData = this._contextGetSymbolData (contextId, event, symbol);
        if (key in symbolData) {
            let nonces = symbolData[key];
            if (timerNonce in nonces) {
                this.omit (symbolData[key], timerNonce);
                this._contextSetSymbolData (contextId, event, symbol, symbolData);
            }
        }
    }

    _websocketMarketId (symbol) {
        let market = this.findMarket (symbol);
        if (typeof market !== 'undefined') {
            let baseId = market['baseId'].toLowerCase ();
            let quoteId = market['quoteId'].toLowerCase ();
            return baseId + quoteId;
        }
        return symbol;
    }

    _getCurrentWebsocketOrderbook (contextId, symbol, limit) {
        let data = this._contextGetSymbolData (contextId, 'ob', symbol);
        if (('ob' in data) && (typeof data['ob'] !== 'undefined')) {
            return this._cloneOrderBook (data['ob'], limit);
        }
        return undefined;
    }
};
