// xchainjs
import { Asset, assetAmount, assetToBase, assetToString, bnOrZero } from '@xchainjs/xchain-util';
import { AssetRuneNative } from '@xchainjs/xchain-thorchain';
import { CryptoAmount, ThorchainCache, ThorchainQuery } from '@xchainjs/xchain-thorchain-query';
import { AmmEstimateSwapParams, ThorchainAMM, Wallet } from '@xchainjs/xchain-thorchain-amm';
import { Client as XchainEvmClient } from '@xchainjs/xchain-evm'

// dot env config
import dotenv from 'dotenv'
dotenv.config()

import { Order, OrdersStorage } from './orders';
import BigNumber, { BigNumber as bn } from 'bignumber.js'
import { orders } from '../orders';

//custom interval from: https://www.npmjs.com/package/set-interval-async
import { setIntervalAsync } from 'set-interval-async/dynamic';
import { readKeystore } from './util/util';
import { PoolDetails } from '@xchainjs/xchain-midgard';
import { Midgard } from '@xchainjs/xchain-midgard-query';
import { FeeOption, Network, XChainClient } from '@xchainjs/xchain-client';

const prompts = require('prompts');

var phrase: string;

// Setup wallet
const midgard = new Midgard(Network.Mainnet)
const thorchainCache = new ThorchainCache()
const thorchainQuery = new ThorchainQuery(thorchainCache)
const thorchainAmm = new ThorchainAMM(thorchainQuery)


function getDestAddress(clients: Record<string, XChainClient>, asset: Asset, walletIndex: number = 0) {
  const c = clients[asset.chain]
  if (asset.synth) {
    return clients['THOR'].getAddress(walletIndex)
  }
  return c.getAddress(walletIndex)
}

async function doSwap(order: Order) {
  const wallet = new Wallet(phrase, thorchainQuery)

  const swapParams: AmmEstimateSwapParams = {
    fromAsset: order.fromAsset,
    amount: new CryptoAmount(assetToBase(assetAmount(order.input, order.decimals ?? 8)), order.fromAsset),
    destinationAddress: getDestAddress(wallet.clients, order.toAsset),
    destinationAsset: order.toAsset,
    wallet,
    walletIndex: 0,
    streamingInterval: 3,
    streamingQuantity: 3
  }

  const txDetails = await thorchainAmm.estimateSwap(swapParams)

  console.log('See if it can be swapped', txDetails)

  if (txDetails.txEstimate.canSwap) {
    console.log('Swapping now with the output fee:', txDetails.txEstimate.totalFees.outboundFee.assetAmountFixedString())
    console.log('Swapping now with the est output:', txDetails.txEstimate.netOutput.assetAmountFixedString())

    const output = await thorchainAmm.doSwap(wallet, swapParams)

    console.log(
      `Tx hash: ${output.hash},\n Tx url: ${output.url}\n WaitTime: ${txDetails.txEstimate.outboundDelaySeconds}`,
    )
  }
}

async function getAssetPrice(asset: Asset, pools: PoolDetails): Promise<BigNumber> {
  let poolPrice = bnOrZero(0)
  if (assetToString(asset) == assetToString(AssetRuneNative)) {
    poolPrice = (bnOrZero(pools.find(p => p.asset === 'ETH.USDC-0XA0B86991C6218B36C1D19D4A2E9EB0CE3606EB48').assetPrice)).pow(-1)
    console.log('RUNE price is: ', poolPrice.toFixed(4).toString())
    return poolPrice
  } else {
    poolPrice = new bn(pools.find(p => p.asset === assetToString(asset)).assetPriceUSD)
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
      const pools = await midgard.getPools()
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
          await doSwap(order)
          order.done = true
        } else if (order.inverse && poolPrice.lte(orderPrice)) {
          console.log('there is vaild order book for lower price Doing SWAP. ' + (new Date()).toLocaleString(), '\nConversion: ', poolPrice.toFixed(3).toString())
          await doSwap(order)
          order.done = true
        } else {
          console.log('not yet reached the price ' + (new Date()).toLocaleString())
        }

      });
    }, 30000)
  } catch (error: any) {
    console.error(error.stack)
  }
}

async function main() {
  console.log('start of the script...')

  phrase = await readKeystore(process.env.KeystoreFile)

  const ordersStorage = new OrdersStorage(orders)

  interval(ordersStorage)
}

main();
