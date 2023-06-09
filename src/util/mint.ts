// xchainjs
import { Asset, assetAmount, assetFromString, assetToBase, assetToString, baseToAsset } from '@xchainjs/xchain-util';
import { Client, Client as thorchainClient } from '@xchainjs/xchain-thorchain';
import { CryptoAmount, ThorchainQuery } from '@xchainjs/xchain-thorchain-query';

// dot env config
import dotenv from 'dotenv'
dotenv.config()

import { BigNumber as bn } from 'bignumber.js'
import { readKeystore } from './util';

const query = new ThorchainQuery()
var wallet: Client

async function doMint(fromAsset: Asset, toAsset: Asset, toAddress: string, value: number): Promise<string | undefined> {
  const txDetails = await query.estimateSwap({
    input: new CryptoAmount(assetToBase(assetAmount(value, 8)), fromAsset),
    destinationAddress: toAddress,
    destinationAsset: toAsset,
    slipLimit: new bn("0.01")
  })

  console.log('See if it can be swapped', txDetails.txEstimate.canSwap) 
  if (txDetails.txEstimate.canSwap) {
    console.log('Swapping now with the output fee:', txDetails.txEstimate.totalFees.outboundFee.assetAmountFixedString())
    console.log('Swapping now with the est output:', txDetails.txEstimate.netOutput.assetAmountFixedString())
    const txID = await wallet.deposit({
      asset: fromAsset,
      amount: assetToBase(assetAmount(value, 8)),
      memo: txDetails.memo,
    })

    return txID
  }

  return undefined
}

async function main() {
  const phrase = await readKeystore(process.env.KeystoreFile)
  wallet = new thorchainClient({phrase})

  const balances = (await wallet.getBalance(wallet.getAddress())).map(a => ({asset: assetToString(a.asset), input: baseToAsset(a.amount).amount().toString()}))
  const toMintAsset = assetFromString('BNB.BUSD-BD1') ?? undefined 

  // do mint 100%
  const toMintAmount = +balances.find(a => a.asset === 'BNB/BUSD-BD1').input * (1)

  if (toMintAsset) {
    const tx = await doMint(assetFromString('BNB/BUSD-BD1'), toMintAsset, 'bnb1c88g08m6w994ugzyz0hnfqnzs5c2vm27zqm2f9', toMintAmount)
    console.log(tx)
  }
}

main();