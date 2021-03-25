import React, { Component } from 'react';
import { w3cwebsocket as W3CWebSocket } from 'websocket';

import { Responsive, WidthProvider  } from 'react-grid-layout';
import '../node_modules/react-grid-layout/css/styles.css'
import '../node_modules/react-resizable/css/styles.css'

import request from 'request'



// #SECRET

const secretHoldings =  ['your', 'holdings']
const secretToken =     'your api key from finnhub'



const ResponsiveGridLayout = WidthProvider(Responsive);
const originalLayouts = getFromLS("layouts") || {};

// Finnhub.io token #SECRET
const token = secretToken


const client = new W3CWebSocket('wss://ws.finnhub.io?token=' + token);

const DEBUG = false;

function getFromLS(key) {
  let ls = {};
  if (global.localStorage) {
    try {
      ls = JSON.parse(global.localStorage.getItem("rgl-8")) || {};
    } catch (e) {
      /*Ignore*/
    }
  }
  return ls[key];
}

function saveToLS(key, value) {
  if (global.localStorage) {
    global.localStorage.setItem(
      "rgl-8",
      JSON.stringify({
        [key]: value
      })
    );
  }
}

class SimpleTicker extends Component {
  render() {
    if(DEBUG)
    {
      console.log("DEBUG: SimpleTicker: this.props")
      console.log(this.props)
      console.log("DEBUG: SimpleTicker: this.state")
      console.log(this.state)
    }
    
    const backgroundOpacity = 50    /100.0;
    return (
      <div style={{
        backgroundColor: 
          this.props.data.lastTrade.p > this.props.data.previousClose ? 'rgba(63, 191, 63, '+backgroundOpacity+')' : 
            (this.props.data.lastTrade.p < this.props.data.previousClose ? 'rgba(255, 40, 40, '+backgroundOpacity+')' : 
              'none'
            )
        }}>
        
        {this.props.s}
        <br />
        Price: {this.props.data.lastTrade.p}
        <br />
        Volume: {this.props.data.lastTrade.v}
        <br />
        Previous Close: {this.props.data.previousClose}
        <br />
        Open: {this.props.data.open}
        <br />
        High: {this.props.data.high}
        <br />
        Low: {this.props.data.low}
        <br />
        As Of: {this.props.data.lastTrade.t}
      </div>
    );
  }
}


class App extends Component {
  constructor(props) {
    super(props);

    const _subscribedSymbols = [
      'BINANCE:BTCUSDT',
      'BINANCE:ETHBTC',
      'SPY', 
    ] 
    // Holdings #SECRET I guess
    const subscribedSymbols = _subscribedSymbols.concat(secretHoldings);

    // TODO: Prefill the current price
    const newtickers = {};
    for (let i = 0; i < subscribedSymbols.length; i++) {
      let sym = subscribedSymbols[i];
      newtickers[sym] = 
        {
          lastTrade:
          {
            p: null,  // Price
            v: null,  // Volume
            s: null,  // Symbol
            t: null,  // Timestamp
            c: null,  // Trade Conditions
          },
          open: null,
          high: null,
          low: null,
          current: null,
          previousClose: null,
          asOfTime : null,
        }

      newtickers[sym].lastTrade.s = sym
 
      // Fill data
      const request = require('request');

      request('https://finnhub.io/api/v1/quote?symbol='+sym+'&token=' + token, { json: true }, (err, res, body) => {
        
        if(DEBUG){
          console.log("DEBUG: App: Constructor: 'request' to quote API");
          console.log(res);
        }
        
        if (err) {
          console.log(err);
        }
        else {
          newtickers[sym].open = body.o;
          newtickers[sym].high = body.h;
          newtickers[sym].low = body.l;
          newtickers[sym].current = body.c;
          newtickers[sym].previousClose = body.pc;
          newtickers[sym].asOfTime = body.t;

          newtickers[sym].lastTrade.p = body.c;
          newtickers[sym].lastTrade.t = body.t;

        }
      });

      
    };

    

    this.state = {
      subscribedSymbols: subscribedSymbols,
      tickers: newtickers,
      layouts: JSON.parse(JSON.stringify(originalLayouts)),
    };

    


  }
  static get defaultProps() {
    return {
      className: "layout",
      cols: { lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 },
      rowHeight: 30
    };
  }
  onLayoutChange(layout, layouts) {
    saveToLS("layouts", layouts);
    this.setState({ layouts });
  }
  componentDidMount() {
    client.onerror = (event) => {
      console.log(event);
      client.close();
    };
    client.onclose = () => {
      console.log("Socket closed");
      // TODO: Figure out how to retry socket open
      /*setTimeout(function() {
        client = new W3CWebSocket('wss://ws.finnhub.io?token=' + token);;
      }, 5000);*/
    };
    client.onopen = () => {
      console.log('WebSocket Client Connected');

      // Subscribe to symbols
      for (let i = 0; i < this.state.subscribedSymbols.length; i++) {
        console.log(this.state.subscribedSymbols[i]);
        //  TODO: Move to function to allow for adhoc adds and removes
        //    TODO: Socket status checks and response checks
        client.send(
          JSON.stringify({
            type: 'subscribe',
            symbol: this.state.subscribedSymbols[i],
          })
        );
      };
    };
    client.onmessage = (message) => {

      if(DEBUG)
      {
        console.log("DEBUG: App: componentWillMount: Websocket client: onMessage (entry): this.state");
        console.log(this.state);
      }

      

      //console.log(message);

      const data = JSON.parse(message.data);
      const type = data.type;
      const trades = data.data;

      const tickers2 = this.state.tickers;

      if (type == 'trade') {
        //console.log(trades);

        trades.forEach(trade => {
          // Find the Ticker that the trade corresponds to and update it
          // TODO: handle not found; check subscribed symbols and add new ticker entry if new one found.
          ///let x = tickers.find((_) => _.s == trade.s);
          ///tickers[tickers.indexOf(x)] = trade;

          tickers2[trade.s].lastTrade = trade;
          
          
        });
        this.setState({ tickers: tickers2 });; // TODO: measure performance, move out of/into loop if neccessary
        


        
      }
      if(DEBUG)
      {
        console.log("DEBUG: App: componentWillMount: Websocket client: onMessage (exit): this.state");
        console.log(this.state);
      }
    };
  }

  render() {
    
    return (
      <>
      <ResponsiveGridLayout className="layout"
          cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
          rowHeight={30}
          layouts={this.state.layouts}
          onLayoutChange={(layout, layouts) =>
            this.onLayoutChange(layout, layouts)
          }>
        {
          
          Object.keys(this.state.tickers).map((value, index) => {
            return (
              <div key={index}>
                <SimpleTicker s={value} data={this.state.tickers[value]} data-grid={{x: index, y:index, w:1, h:1}}  />
              </div>
            )
          })
        }
        </ResponsiveGridLayout>
      </>
    );
  }
}

export default App;