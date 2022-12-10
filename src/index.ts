// xchainjs
import { assetAmount, assetFromString, AssetRuneNative, assetToBase, assetToString, baseAmount, bnOrZero, isAssetRuneNative } from '@xchainjs/xchain-util';
import { Client as thorchainClient } from '@xchainjs/xchain-thorchain';
import { CryptoAmount, LiquidityPool, ThorchainQuery } from '@xchainjs/xchain-thorchain-query';

// dot env config
import dotenv from 'dotenv'
dotenv.config()

import { Order, OrdersStorage } from './orders';
import BigNumber, { BigNumber as bn } from 'bignumber.js'

const query = new ThorchainQuery()
const wallet = new thorchainClient({ phrase: process.env.PHRASE })

async function doSwap(order: Order): Promise<string | undefined> {
  const txDetails = await query.estimateSwap({
    input: new CryptoAmount(assetToBase(assetAmount(order.input, 8)), order.fromAsset),
    destinationAddress: order.toAddress,
    destinationAsset: order.toAsset,
    slipLimit: new bn(order.maxSlip)
  })

  if (txDetails.txEstimate.canSwap) {
    console.log('Swapping now with the est output :', txDetails.txEstimate.netOutput.assetAmountFixedString())
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
    console.log('RUNE price is: ', poolPrice.toString())
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
          ordersStorage.deleteOrder(index)
          return
        }

        const poolPrice = await getPoolPrice(order, pools)

        if (poolPrice.gte(order.price)) {
          console.log('there is vaild order book Doing SWAP. ' + (new Date()).toLocaleString(), '\n Price: ', poolPrice.toFixed(2).toString())
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

  console.log('wallet address being: ', wallet.getAddress())

  const ordersStorage = new OrdersStorage([{
    fromAsset: AssetRuneNative,
    toAsset: assetFromString('BNB/BUSD-BD1') ?? undefined,
    toAddress: wallet.getAddress(),
    input: 1,
    price: "1.39",
    maxSlip: "0.01",
    done: false
  }])

  interval(ordersStorage)
}

main();
