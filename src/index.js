import { assetAmount, assetFromString, AssetRuneNative, assetToBase, assetToString } from '@xchainjs/xchain-util';
import { Client as thorchainClient } from '@xchainjs/xchain-thorchain';
import { CryptoAmount, ThorchainQuery } from '@xchainjs/xchain-thorchain-query';

import dotenv from 'dotenv'
import { OrdersStorage } from './orders';
import { BigNumber as bn } from 'bignumber.js'
dotenv.config()

const query = new ThorchainQuery()
const wallet = new thorchainClient({phrase: process.env.PHRASE})

async function doSwap(destAsset, amount, destAddress, fromAsset) {
  const estSwap = {
    input: new CryptoAmount(assetToBase(assetAmount(amount)), fromAsset),
    destinationAddress: destAddress,
    destinationAsset: destAsset
  }

  const est = await query.estimateSwap(estSwap)

  return est
}

async function interval(ordersStorage) {
  try {
    setInterval(async () => {
      const pools = await query.thorchainCache.getPools()
      ordersStorage?.orders.forEach(async (order) => {
        let poolPrice = bn(0)
        if (assetToString(order.fromAsset) == assetToString(AssetRuneNative)) {
          poolPrice = bn(1 / (new bn(pools['BNB.BUSD'].pool.assetPrice)))
          console.log('RUNE price is: ', poolPrice.toString())
        } else {
          let poolDetail = await query.thorchainCache.getPoolForAsset(order.fromAsset)
          poolPrice = new bn(poolDetail.pool.assetPrice)
          console.log(assetToString(order.fromAsset) + ' price is: ', poolPrice.toString())
        }
        if (poolPrice.gte(order.price)) {
          console.log('there is vaild order book DO SWAP. ' + (new Date()).toLocaleString())
        } else {
          console.log('not yet reached the price ' + (new Date()).toLocaleString())
        }
      });
    }, 10000) 
  } catch (error) {
    console.log(error)
  }
}

async function main() {
  console.log('start of the script...')

  const ordersStorage = new OrdersStorage([{
    fromAsset: AssetRuneNative,
    toAsset: assetFromString('BNB/BUSD-BD1'),
    toAddress: wallet.getAddress(),
    input: 150,
    price: "1.7"
  }])

  interval(ordersStorage)

  // const est = await doSwap(assetFromString('BNB/BUSD-BD1'), 1000, wallet.getAddress(), AssetRuneNative)
  // console.log(est)
}

main();
