import fetch from 'cross-fetch';
import { defaultAbiCoder } from 'ethers/utils/abi-coder';
import debug from 'debug';
import { globalUtils } from "./globalUtils";

const log = debug('multicall');

// Function signature for: aggregate((address,bytes)[])
export const AGGREGATE_SELECTOR = '0x252dba42';

export function strip0x(str) {
  return str.replace(/^0x/, '');
}

export function typesLength(types) {
  return types.length;
}

export function encodeParameter(type, val) {
  return encodeParameters([type], [val]);
}

export function encodeParameters(types, vals, nonEthereum) {
  if (nonEthereum === globalUtils.constant.TRON) {
    if (vals.length == 0) {
      return ""
    }

    const finalValues = [];
    for (let i = 0; i < vals.length; i++) {
      let type = types[i];
      let value = vals[i];

      if (type === 'address') {
        value = value.replace("0x", "");
        value = value.replace(globalUtils.constant.ADDRESS_PREFIX_REGEX, '0x');
      } else if (type === 'address[]') {
        value = value.map(v => {
          return v.replace(globalUtils.constant.ADDRESS_PREFIX_REGEX, '0x');
        });
      } else {
        value = value.map(item => {
          return item.map(v => {
            if (v.length === 44) {
              return v.replace("0x", "").replace(globalUtils.constant.ADDRESS_PREFIX_REGEX, '0x');
            } else {
              return v;
            }
          });
        });
      }

      finalValues.push(value);
    }

    try {
      return defaultAbiCoder.encode(types, finalValues);
    } catch (ex) {
      console.error(ex);
    }
  } else {
    return defaultAbiCoder.encode(types, vals);
  }
}

export function decodeParameter(type, val) {
  return decodeParameters([type], val);
}

export function decodeParameters(types, vals) {
  return defaultAbiCoder.decode(types, '0x' + vals.replace(/0x/i, ''));
}

export function padLeft(string, chars, sign) {
  var hasPrefix = /^0x/i.test(string) || typeof string === 'number';
  string = string.toString(16).replace(/^0x/i, '');
  var padding = chars - string.length + 1 >= 0 ? chars - string.length + 1 : 0;
  return (
    (hasPrefix ? '0x' : '') +
    new Array(padding).join(sign ? sign : '0') +
    string
  );
}

export function padRight(string, chars, sign) {
  var hasPrefix = /^0x/i.test(string) || typeof string === 'number';
  string = string.toString(16).replace(/^0x/i, '');
  var padding = chars - string.length + 1 >= 0 ? chars - string.length + 1 : 0;
  return (
    (hasPrefix ? '0x' : '') +
    string +
    new Array(padding).join(sign ? sign : '0')
  );
}

export function isEmpty(obj) {
  if (Array.isArray(obj)) return obj.length === 0;
  return !obj || Object.keys(obj).length === 0;
}

export async function ethCall(rawData, { id, web3, rpcUrl, block, multicallAddress, ws, wsResponseTimeout, nonEthereum }) {
  const abiEncodedData = AGGREGATE_SELECTOR + strip0x(rawData);

  if (ws) {
    log('Sending via WebSocket');
    return new Promise((resolve, reject) => {
      ws.send(JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_call',
        params: [
          {
            to: multicallAddress,
            data: abiEncodedData
          },
          block || 'latest'
        ],
        id
      }));
      function onMessage(data) {
        if (typeof data !== 'string') data = data.data;
        const json = JSON.parse(data);
        if (!json.id || json.id !== id) return;
        log('Got WebSocket response id #%d', json.id);
        clearTimeout(timeoutHandle);
        ws.onmessage = null;
        resolve(json.result);
      }
      const timeoutHandle = setTimeout(() => {
        if (ws.onmessage !== onMessage) return;
        ws.onmessage = null;
        reject(new Error('WebSocket response timeout'));
      }, wsResponseTimeout);

      ws.onmessage = onMessage;
    });
  }
  else if (web3) {
    log('Sending via web3 provider');
    return web3.eth.call({
      to: multicallAddress,
      data: abiEncodedData
    });
  } else {
    let rawResponse = null;
    let content = null;
    try {
      rawResponse = await global.fetch(rpcUrl, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_call',
          params: [{
            to: multicallAddress,
            data: abiEncodedData
          }, block || 'latest'],
          id: 1
        })
      });
      content = await rawResponse.json();
    } catch (error) {
      console.error(error)
    }

    if (!content || !content.result) {
      throw new Error('Multicall received an empty response. Check your call configuration for errors.');
    }
    return content.result;
  }
}
