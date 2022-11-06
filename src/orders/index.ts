import { Asset } from "@xchainjs/xchain-util"

export type Order = {
  fromAsset: Asset,
  toAsset: Asset,
  toAddress: string,
  input: number,
  price: string
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