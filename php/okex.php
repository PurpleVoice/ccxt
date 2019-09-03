<?php

namespace ccxt;

// PLEASE DO NOT EDIT THIS FILE, IT IS GENERATED AND WILL BE OVERWRITTEN:
// https://github.com/ccxt/ccxt/blob/master/CONTRIBUTING.md#how-to-contribute-code

use Exception as Exception; // a common import

class okex extends okcoinusd {

    public function describe () {
        return array_replace_recursive (parent::describe (), array (
            'id' => 'okex',
            'name' => 'OKEX',
            'countries' => ['CN', 'US'],
            'has' => array (
                'CORS' => false,
                'futures' => true,
                'fetchTickers' => true,
            ),
            'urls' => array (
                'logo' => 'https://user-images.githubusercontent.com/1294454/32552768-0d6dd3c6-c4a6-11e7-90f8-c043b64756a7.jpg',
                'api' => array (
                    'web' => 'https://www.okex.com/v2',
                    'public' => 'https://www.okex.com/api',
                    'private' => 'https://www.okex.com/api',
                ),
                'www' => 'https://www.okex.com',
                'doc' => array (
                    'https://github.com/okcoin-okex/API-docs-OKEx.com',
                    'https://www.okex.com/docs/en/',
                ),
                'fees' => 'https://www.okex.com/pages/products/fees.html',
                'referral' => 'https://www.okex.com',
            ),
            'fees' => array (
                'trading' => array (
                    'taker' => 0.0015,
                    'maker' => 0.0010,
                ),
                'spot' => array (
                    'taker' => 0.0015,
                    'maker' => 0.0010,
                ),
                'future' => array (
                    'taker' => 0.0030,
                    'maker' => 0.0020,
                ),
                'swap' => array (
                    'taker' => 0.0070,
                    'maker' => 0.0020,
                ),
            ),
            'commonCurrencies' => array (
                // OKEX refers to ERC20 version of Aeternity (AEToken)
                'AE' => 'AET', // https://github.com/ccxt/ccxt/issues/4981
                'FAIR' => 'FairGame',
                'HOT' => 'Hydro Protocol',
                'HSR' => 'HC',
                'MAG' => 'Maggie',
                'YOYO' => 'YOYOW',
                'WIN' => 'WinToken', // https://github.com/ccxt/ccxt/issues/5701
            ),
            'wsconf' => array (
                'conx-tpls' => array (
                    'default' => array (
                        'type' => 'ws',
                        'baseurl' => 'wss://real.okex.com:10441/websocket',
                    ),
                ),
                'methodmap' => array (
                    'addChannel' => '_websocketOnAddChannel',
                    'removeChannel' => '_websocketOnRemoveChannel',
                    '_websocketSendHeartbeat' => '_websocketSendHeartbeat',
                ),
                'events' => array (
                    'ob' => array (
                        'conx-tpl' => 'default',
                        'conx-param' => array (
                            'url' => '{baseurl}',
                            'id' => '{id}',
                        ),
                    ),
                ),
            ),
        ));
    }

    public function _websocket_on_open ($contextId, $params) {
        // : heartbeat
        // $this->_websocketHeartbeatTicker && clearInterval ($this->_websocketHeartbeatTicker);
        // $this->_websocketHeartbeatTicker = setInterval (() => {
        //      $this->websocketSendJson (array (
        //        'event' => 'ping',
        //    ));
        //  }, 30000);
        $heartbeatTimer = $this->_contextGet ($contextId, 'heartbeattimer');
        if ($heartbeatTimer !== null) {
            $this->_cancelTimer ($heartbeatTimer);
        }
        $heartbeatTimer = $this->_setTimer ($contextId, 30000, $this->_websocketMethodMap ('_websocketSendHeartbeat'), [$contextId]);
        $this->_contextSet ($contextId, 'heartbeattimer', $heartbeatTimer);
    }

    public function _websocket_send_heartbeat ($contextId) {
        $this->websocketSendJson (
            array (
                'event' => 'ping',
            ),
            $contextId
        );
    }

    public function websocket_close ($conxid = 'default') {
        parent::websocketClose ($conxid);
        // stop heartbeat ticker
        // $this->_websocketHeartbeatTicker && clearInterval ($this->_websocketHeartbeatTicker);
        // $this->_websocketHeartbeatTicker = null;
        $heartbeatTimer = $this->_contextGet ($conxid, 'heartbeattimer');
        if ($heartbeatTimer !== null) {
            $this->_cancelTimer ($heartbeatTimer);
        }
        $this->_contextSet ($conxid, 'heartbeattimer', null);
    }

    public function _websocket_on_add_channel () {
        return null;
    }

    public function _websocket_on_remove_channel () {
        return null;
    }

    public function _websocket_on_channel ($contextId, $channel, $msg, $data) {
        // var_dump('========================',$msg);
        if (mb_strpos($channel, 'ok_sub_spot_') !== false) {
            // spot
            $depthIndex = mb_strpos($channel, '_depth');
            if ($depthIndex > 0) {
                // orderbook
                $result = $this->safe_value($data, 'result', null);
                if ($result !== null && !$result) {
                    $error = new ExchangeError ($this->safe_string($data, 'error_msg', 'orderbook error'));
                    $this->emit ('err', $error);
                    return;
                }
                $channelName = str_replace('ok_sub_spot_', '', $channel);
                $parts = explode('_depth', $channelName);
                $pair = $parts[0];
                $symbol = $this->_get_symbol_by_pair ($pair);
                $timestamp = $this->safe_value($data, 'timestamp');
                $ob = $this->parse_order_book($data, $timestamp);
                $symbolData = $this->_contextGetSymbolData (
                    $contextId,
                    'ob',
                    $symbol
                );
                $symbolData['ob'] = $ob;
                $this->_contextSetSymbolData ($contextId, 'ob', $symbol, $symbolData);
                $this->emit (
                    'ob',
                    $symbol,
                    $this->_cloneOrderBook ($symbolData['ob'], $symbolData['depth'])
                );
            }
        } else if (mb_strpos($channel, 'ok_sub_future') !== false) {
            // future
            $depthIndex = mb_strpos($channel, '_depth');
            if ($depthIndex > 0) {
                // orderbook
                $pair = $channel->substring (
                    strlen ('ok_sub_future'),
                    $depthIndex
                );
                $symbol = $this->_get_symbol_by_pair ($pair, true);
                $timestamp = $data->timestamp;
                $ob = $this->parse_order_book($data, $timestamp);
                $symbolData = $this->_contextGetSymbolData (
                    $contextId,
                    'ob',
                    $symbol
                );
                $symbolData['ob'] = $ob;
                $this->_contextSetSymbolData ($contextId, 'ob', $symbol, $symbolData);
                $this->emit (
                    'ob',
                    $symbol,
                    $this->_cloneOrderBook ($symbolData['ob'], $symbolData['depth'])
                );
            }
        }
    }

    public function _websocket_dispatch ($contextId, $msg) {
        // _websocketOnMsg [array("binary":0,"$channel":"addChannel","data":array ("result":true,"$channel":"ok_sub_spot_btc_usdt_depth"))] default
        // _websocketOnMsg [{"binary":0,"$channel":"ok_sub_spot_btc_usdt_depth","data":{"asks":[[
        $channel = $this->safe_string($msg, 'channel');
        if (!$channel) {
            // pong
            return;
        }
        $resData = $this->safe_value($msg, 'data', array());
        if (is_array($this->wsconf['methodmap']) && array_key_exists($channel, $this->wsconf['methodmap'])) {
            $method = $this->wsconf['methodmap'][$channel];
            $this->$method ($channel, $msg, $resData, $contextId);
        } else {
            $this->_websocket_on_channel ($contextId, $channel, $msg, $resData);
        }
    }

    public function _websocket_on_message ($contextId, $data) {
        // var_dump ('_websocketOnMsg', $data);
        $msgs = json_decode($data, $as_associative_array = true);
        if (gettype ($msgs) === 'array' && count (array_filter (array_keys ($msgs), 'is_string')) == 0) {
            for ($i = 0; $i < count ($msgs); $i++) {
                $this->_websocket_dispatch ($contextId, $msgs[$i]);
            }
        } else {
            $this->_websocket_dispatch ($contextId, $msgs);
        }
    }

    public function _websocket_subscribe ($contextId, $event, $symbol, $nonce, $params = array ()) {
        if ($event !== 'ob') {
            throw new NotSupported('subscribe ' . $event . '(' . $symbol . ') not supported for exchange ' . $this->id);
        }
        $data = $this->_contextGetSymbolData ($contextId, $event, $symbol);
        $data['depth'] = $params['depth'];
        $data['limit'] = $params['depth'];
        $this->_contextSetSymbolData ($contextId, $event, $symbol, $data);
        $sendJson = array (
            'event' => 'addChannel',
            'channel' => $this->_get_order_book_channel_by_symbol ($symbol, $params),
        );
        $this->websocketSendJson ($sendJson);
        $nonceStr = (string) $nonce;
        $this->emit ($nonceStr, true);
    }

    public function _websocket_unsubscribe ($contextId, $event, $symbol, $nonce, $params = array ()) {
        if ($event !== 'ob') {
            throw new NotSupported('subscribe ' . $event . '(' . $symbol . ') not supported for exchange ' . $this->id);
        }
        $sendJson = array (
            'event' => 'removeChannel',
            'channel' => $this->_get_order_book_channel_by_symbol ($symbol, $params),
        );
        $this->websocketSendJson ($sendJson);
        $nonceStr = (string) $nonce;
        $this->emit ($nonceStr, true);
    }

    public function _get_order_book_channel_by_symbol ($symbol, $params = array ()) {
        $pair = $this->_get_pair_by_symbol ($symbol);
        // future example:ok_sub_futureusd_btc_depth_this_week_20
        // ok_sub_spot_usdt_btc_depth
        // spot ewxample:ok_sub_spot_btc_usdt_depth_5
        $depthParam = $this->safe_string($params, 'depth', '');
        // becareful of the underscore
        if ($depthParam) {
            $depthParam = '_' . $depthParam;
        }
        $channel = 'ok_sub_spot_' . $pair . '_depth' . $depthParam;
        if ($this->_isFutureSymbol ($symbol)) {
            $contract_type = $params->contract_type;
            if (!$contract_type) {
                throw new ExchangeError('parameter $contract_type is required for the future.');
            }
            $channel = 'ok_sub_future' . $pair . '_depth_' . $contract_type . $depthParam;
        }
        return $channel;
    }

    public function _get_pair_by_symbol ($symbol) {
        [$currencyBase, $currencyQuote] = explode('/', $symbol);
        $currencyBase = strtolower($currencyBase);
        $currencyQuote = strtolower($currencyQuote);
        $pair = $currencyBase . '_' . $currencyQuote;
        if ($this->_isFutureSymbol ($symbol)) {
            $pair = $currencyQuote . '_' . $currencyBase;
        }
        return $pair;
    }

    public function _get_symbol_by_pair ($pair, $isFuture = false) {
        [$currency1, $currency2] = explode('_', $pair);
        $currency1 = strtoupper($currency1);
        $currency2 = strtoupper($currency2);
        $symbol = $isFuture ? $currency2 . '/' . $currency1 : $currency1 . '/' . $currency2;
        return $symbol;
    }

    public function _get_current_websocket_orderbook ($contextId, $symbol, $limit) {
        $data = $this->_contextGetSymbolData ($contextId, 'ob', $symbol);
        if (is_array($data && $data['ob'] !== null) && array_key_exists('ob', $data && $data['ob'] !== null)) {
            return $this->_cloneOrderBook ($data['ob'], $limit);
        }
        return null;
    }
}
