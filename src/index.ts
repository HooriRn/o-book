// xchainjs
import { assetAmount, assetFromString, AssetRuneNative, assetToBase, assetToString, baseAmount, bnOrZero, isAssetRuneNative } from '@xchainjs/xchain-util';
import { Client as thorchainClient } from '@xchainjs/xchain-thorchain';
import { CryptoAmount, LiquidityPool, ThorchainQuery } from '@xchainjs/xchain-thorchain-query';

// dot env config
import dotenv from 'dotenv'
dotenv.config()

import { Order, OrdersStorage } from './orders';
import BigNumber, { BigNumber as bn } from 'bignumber.js'
import { orders } from '../orders';

const query = new ThorchainQuery()
const wallet = new thorchainClient({ phrase: process.env.PHRASE })

async function doSwap(order: Order): Promise<string | undefined> {
  const txDetails = await query.estimateSwap({
    input: new CryptoAmount(assetToBase(assetAmount(order.input, 8)), order.fromAsset),
    destinationAddress: wallet.getAddress(),
    destinationAsset: order.toAsset,
    slipLimit: new bn(order.maxSlip)
  })

  if (txDetails.txEstimate.canSwap) {
    console.log('Swapping now with the output fee:', txDetails.txEstimate.totalFees.outboundFee.assetAmountFixedString())
    console.log('Swapping now with the est output:', txDetails.txEstimate.netOutput.assetAmountFixedString())
    const txID = await wallet.deposit({
      asset: order.fromAsset,
      amount: assetToBase(assetAmount(order.input, 8)),
      memo: txDetails.memo,
    })

    return txID
  }

  return undefined
}

async function getPoolPrice(order: Order, pools: Record<string, LiquidityPool>): Promise<BigNumber> {
  let poolPrice = bnOrZero(0)
  if (assetToString(order.fromAsset) == assetToString(AssetRuneNative)) {
    poolPrice = (bnOrZero(pools['BNB.BUSD'].pool.assetPrice)).pow(-1)
    console.log('RUNE price is: ', poolPrice.toFixed(2).toString())
    return poolPrice
  } else {
    let poolDetail = await query.thorchainCache.getPoolForAsset(order.fromAsset)
    poolPrice = new bn(poolDetail.pool.assetPrice)
    console.log(assetToString(order.fromAsset) + ' price is: ', poolPrice.toFixed(2).toString())
    return poolPrice
  }
}

async function interval(ordersStorage: OrdersStorage) {
  try {
    setInterval(async () => {
      const pools = await query.thorchainCache.getPools()
      ordersStorage?.orders.forEach(async (order: Order, index: number) => {
        if (order.done == true) {
          console.log(`Deleting order ${index} for ${assetToString(order.fromAsset)} to ${assetToString(order.toAsset)} at price:`, order.price)
          ordersStorage.deleteOrder(index)
          return
        }
        
        console.log(`Checking order ${index} for ${assetToString(order.fromAsset)} to ${assetToString(order.toAsset)} at price:`, order.price)

        const poolPrice = await getPoolPrice(order, pools)

        if (poolPrice.gte(order.price)) {
          console.log('there is vaild order book Doing SWAP. ' + (new Date()).toLocaleString(), '\nPrice: ', poolPrice.toFixed(2).toString())
          const txID = await doSwap(order)
          if (txID) {
            console.log('Tx is done with this txID: ' + txID)
          }
          order.done = true
        } else {
          console.log('not yet reached the price ' + (new Date()).toLocaleString())
        }

      });
    }, 10000)
  } catch (error: any) {
    console.error(error.stack)
  }
}

async function main() {
  console.log('start of the script...')

  console.log('Wallet address being: ' + wallet.getAddress())

  const ordersStorage = new OrdersStorage(orders)

  interval(ordersStorage)
}

main();
