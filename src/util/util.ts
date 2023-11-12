import { CryptoAmount, SwapEstimate, TxDetails } from "@xchainjs/xchain-thorchain-query"
import { decryptFromKeystore, Keystore } from '@xchainjs/xchain-crypto'
import * as fs from 'fs';
const prompts = require('prompts');

// Helper function for printing out the returned object
function print(estimate: SwapEstimate, input: CryptoAmount) {
  const expanded = {
    input: input.formatedAssetString(),
    totalFees: {
      outboundFee: estimate.totalFees.outboundFee.formatedAssetString(),
      affiliateFee: estimate.totalFees.affiliateFee.formatedAssetString(),
    },
    slipBasisPoints: estimate.slipBasisPoints.toFixed(),
    netOutput: estimate.netOutput.formatedAssetString(),
    inboundConfirmationSeconds: estimate.inboundConfirmationSeconds,
    outboundDelaySeconds: estimate.outboundDelaySeconds,
    canSwap: estimate.canSwap,
    errors: estimate.errors,
  }
  return expanded
}
function printTx(txDetails: TxDetails, input: CryptoAmount) {
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
