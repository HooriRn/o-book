import { CryptoAmount, SwapEstimate, TxDetails } from "@xchainjs/xchain-thorchain-query"
import { decryptFromKeystore, Keystore } from '@xchainjs/xchain-crypto'
import * as fs from 'fs';
const prompts = require('prompts');

// Helper function for printing out the returned object
function print(estimate: SwapEstimate, input: CryptoAmount) {
  const expanded = {
    input: input.formatedAssetString(),
    totalFees: {
      inboundFee: estimate.totalFees.inboundFee.formatedAssetString(),
      swapFee: estimate.totalFees.swapFee.formatedAssetString(),
      outboundFee: estimate.totalFees.outboundFee.formatedAssetString(),
      affiliateFee: estimate.totalFees.affiliateFee.formatedAssetString(),
    },
    slipPercentage: estimate.slipPercentage.toFixed(),
    netOutput: estimate.netOutput.formatedAssetString(),
    waitTimeSeconds: estimate.waitTimeSeconds.toFixed(),
    canSwap: estimate.canSwap,
    errors: estimate.errors,
  }
  return expanded
}
export function printTx(txDetails: TxDetails, input: CryptoAmount) {
  const expanded = {
    memo: txDetails.memo,
    expiry: txDetails.expiry,
    toAddress: txDetails.toAddress,
    txEstimate: print(txDetails.txEstimate, input),
  }
  console.log(expanded)
}

//Read Keystore File
export async function readKeystore(path: string) {
  const keystore: Keystore = JSON.parse(await fs.readFileSync(path, 'utf-8'))

  const questions = await prompts([
    { 
      type: 'password', 
      name: 'password', 
      message: 'Type your password'
    }
  ]);

  const phrase = await decryptFromKeystore(keystore, questions.password)

  return phrase
}
