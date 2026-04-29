/** Token 稀有度 */
export type TokenRarity = 'common' | 'rare' | 'epic' | 'legendary';

/** Token 数据 */
export interface Token {
  id: string;
  name: string;
  description: string;
  rarity: TokenRarity;
  iconKey: string;
  createdAt: string;
}

/** 观察者账户 */
export interface ObserverAccount {
  id: string;
  name: string;
  balance: number;
  bio: string;
  tokenIds: string[];
  createdAt: string;
}

/** Token 挂单 */
export interface TokenListing {
  id: string;
  tokenId: string;
  tokenName: string;
  tokenRarity: TokenRarity;
  price: number;
  listedAt: string;
  status: 'active' | 'cancelled';
}

/** 操作记录 */
export interface Transaction {
  id: string;
  type: 'list' | 'cancel';
  tokenId: string;
  tokenName: string;
  price: number;
  timestamp: string;
}
