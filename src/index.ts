// xchainjs
import { Asset, assetAmount, assetToBase, assetToString, bnOrZero, isSynthAsset } from '@xchainjs/xchain-util';
import { AssetRuneNative, Client as thorchainClient, THORChain, ThorchainClient } from '@xchainjs/xchain-thorchain';
import { CryptoAmount, LiquidityPool, ThorchainQuery } from '@xchainjs/xchain-thorchain-query';
import { BNBChain, Client as bnbClient } from '@xchainjs/xchain-binance';
import { XChainClient } from '@xchainjs/xchain-client';

// dot env config
import dotenv from 'dotenv'
dotenv.config()

import { Order, OrdersStorage } from './orders';
import BigNumber, { BigNumber as bn } from 'bignumber.js'
import { orders } from '../orders';

//custom interval from: https://www.npmjs.com/package/set-interval-async
import { setIntervalAsync } from 'set-interval-async/dynamic';
import { readKeystore } from './util/util';

const query = new ThorchainQuery()
var thorWallet: XChainClient; 
var bnbWallet: XChainClient;

function getClientByChain(asset: Asset): XChainClient {
  if (isSynthAsset(asset) || asset.chain === THORChain)
    return thorWallet
  else if (asset.chain === BNBChain)
    return bnbWallet
}

async function doSwap(order: Order): Promise<string | undefined> {
  let client = getClientByChain(order.fromAsset)
  let destClient = getClientByChain(order.toAsset)

  const txDetails = await query.estimateSwap({
    input: new CryptoAmount(assetToBase(assetAmount(order.input, 8)), order.fromAsset),
    destinationAddress: destClient.getAddress(),
    destinationAsset: order.toAsset,
    slipLimit: new bn(order.maxSlip)
  })

  console.log('See if it can be swapped', txDetails.txEstimate.canSwap)
  if (txDetails.txEstimate.canSwap) {
    console.log('Swapping now with the output fee:', txDetails.txEstimate.totalFees.outboundFee.assetAmountFixedString())
    console.log('Swapping now with the est output:', txDetails.txEstimate.netOutput.assetAmountFixedString())

    let txID = ''
    if (order.fromAsset.chain === THORChain || isSynthAsset(order.fromAsset)) {
      txID = await (thorWallet as any).deposit({
        asset: order.fromAsset,
        amount: assetToBase(assetAmount(order.input, 8)),
        memo: txDetails.memo,
      })
    } else if (order.fromAsset.chain === BNBChain) {
      txID = await client.transfer({
        asset: order.fromAsset,
        amount: assetToBase(assetAmount(order.input, 8)),
        recipient: txDetails.toAddress,
        memo: txDetails.memo
      })
    }


    return txID
  }

  return undefined
}

async function getAssetPrice(asset: Asset, pools: Record<string, LiquidityPool>): Promise<BigNumber> {
  let poolPrice = bnOrZero(0)
  if (assetToString(asset) == assetToString(AssetRuneNative)) {
    poolPrice = (bnOrZero(pools['BNB.BUSD'].pool.assetPrice)).pow(-1)
    console.log('RUNE price is: ', poolPrice.toFixed(4).toString())
    return poolPrice
  } else {
    let poolDetail = await query.thorchainCache.getPoolForAsset(asset)
    poolPrice = new bn(poolDetail.pool.assetPrice)
    console.log(assetToString(asset) + ' price is: ', poolPrice.toFixed(2).toString())
    return poolPrice
  }
}

function formatCurrentSwap(index: number, order: Order): string {
  return (`${index} for ${order.input} ${assetToString(order.fromAsset)} to ${assetToString(order.toAsset)} at price: ${order.price || order.toPrice} ... ${order.inverse ? "Inverse swap" : ""}`)
}

async function interval(ordersStorage: OrdersStorage) {
  try {
    setIntervalAsync(async () => {
      const pools = await query.thorchainCache.getPools()
      ordersStorage?.orders.forEach(async (order: Order, index: number) => {
        if (order.done == true) {
          console.log('Deleting order', formatCurrentSwap(index, order))
          ordersStorage.deleteOrder(index)
          return
        }

        console.log('Checking order', formatCurrentSwap(index, order))

        let poolPrice = bnOrZero(0)
        let orderPrice = order.price
        if (order.price) {
          poolPrice = await getAssetPrice(order.fromAsset, pools)
        } else if (order.toPrice) {
          poolPrice = await getAssetPrice(order.toAsset, pools)
          orderPrice = order.toPrice
        } else {
          throw new Error("Can't get the price in the order!");
        }

        if (!order.inverse && poolPrice.gte(orderPrice)) {
          console.log('there is vaild order book Doing SWAP. ' + (new Date()).toLocaleString(), '\nPrice: ', poolPrice.toFixed(3).toString())
          const txID = await doSwap(order)
          if (txID) {
            console.log('Tx is done with this txID: ' + txID)
          }
          order.done = true
        } else if (order.inverse && poolPrice.lte(orderPrice)) {
          console.log('there is vaild order book for lower price Doing SWAP. ' + (new Date()).toLocaleString(), '\nConversion: ', poolPrice.toFixed(3).toString())
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

  const phrase = await readKeystore(process.env.KeystoreFile)
  thorWallet = new thorchainClient({ phrase })
  bnbWallet = new bnbClient({ phrase })

  console.log('Wallet address being: ' + thorWallet.getAddress())

  const ordersStorage = new OrdersStorage(orders)

  interval(ordersStorage)
}

main();
