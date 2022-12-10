import { CryptoAmount } from "@xchainjs/xchain-thorchain-query"
import { Asset, BaseAmount } from "@xchainjs/xchain-util"

export type Order = {
  fromAsset: Asset,
  toAsset: Asset | undefined,
  toAddress: string,
  input: number,
  price: string,
  maxSlip: string,
  done: boolean
}

export class OrdersStorage {
  orders: Order[] 

  constructor(ors?: Order[]) {
    if (ors)
      this.orders = ors
  }

  addOrder(ors: Order[]) {
    this.orders.push(...ors)
  }

  deleteOrder(index: number) {
    if (this.orders.length > 0) {
      this.orders.splice(index, 1)
    }
  }
}