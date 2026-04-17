// ============================================================
// TokenStore.ts — Token 中心状态管理
// ============================================================

import type { Token, ObserverAccount, TokenListing, Transaction } from '../types';
import {
  TOKEN_ACCOUNT_URL, TOKEN_LIST_URL,
  LS_KEY_ACCOUNT, LS_KEY_TOKENS, LS_KEY_LISTINGS, LS_KEY_TRANSACTIONS,
} from '../config';
import { EventBus } from './EventBus';

/** 生成唯一 ID */
function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export class TokenStore {
  account: ObserverAccount | null = null;
  tokens: Token[] = [];
  listings: TokenListing[] = [];
  transactions: Transaction[] = [];

  private eventBus: EventBus;
  private loaded = false;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
    this.init();
  }

  // ── 初始化 ──

  private async init(): Promise<void> {
    // 尝试从 localStorage 恢复
    const savedAccount = localStorage.getItem(LS_KEY_ACCOUNT);
    const savedTokens = localStorage.getItem(LS_KEY_TOKENS);
    const savedListings = localStorage.getItem(LS_KEY_LISTINGS);
    const savedTx = localStorage.getItem(LS_KEY_TRANSACTIONS);

    if (savedAccount && savedTokens) {
      this.account = JSON.parse(savedAccount);
      this.tokens = JSON.parse(savedTokens);
      this.listings = savedListings ? JSON.parse(savedListings) : [];
      this.transactions = savedTx ? JSON.parse(savedTx) : [];
      this.loaded = true;
      this.emitUpdate();
      return;
    }

    // 首次加载：从 JSON 文件初始化
    try {
      const [accResp, tokResp] = await Promise.all([
        fetch(TOKEN_ACCOUNT_URL),
        fetch(TOKEN_LIST_URL),
      ]);
      if (accResp.ok) this.account = await accResp.json();
      if (tokResp.ok) this.tokens = await tokResp.json();
    } catch {
      // fallback
    }

    if (!this.account) {
      this.account = {
        id: 'observer_001',
        name: '观察者',
        balance: 10000,
        bio: '策略研究员，探索中...',
        tokenIds: [],
        createdAt: new Date().toISOString().slice(0, 10),
      };
    }

    this.listings = [];
    this.transactions = [];
    this.loaded = true;
    this.persist();
    this.emitUpdate();
  }

  private emitUpdate(): void {
    if (this.account) {
      this.eventBus.emit('account:updated', this.account);
    }
  }

  private persist(): void {
    if (this.account) localStorage.setItem(LS_KEY_ACCOUNT, JSON.stringify(this.account));
    localStorage.setItem(LS_KEY_TOKENS, JSON.stringify(this.tokens));
    localStorage.setItem(LS_KEY_LISTINGS, JSON.stringify(this.listings));
    localStorage.setItem(LS_KEY_TRANSACTIONS, JSON.stringify(this.transactions));
  }

  // ── 查询 ──

  isLoaded(): boolean { return this.loaded; }

  getToken(id: string): Token | undefined {
    return this.tokens.find(t => t.id === id);
  }

  /** 获取账户持有的 Token 列表（排除已上架的） */
  getHeldTokens(): Token[] {
    if (!this.account) return [];
    const listedIds = new Set(this.listings.filter(l => l.status === 'active').map(l => l.tokenId));
    return this.account.tokenIds
      .map(id => this.tokens.find(t => t.id === id))
      .filter((t): t is Token => !!t && !listedIds.has(t.id));
  }

  /** 获取活跃挂单 */
  getActiveListings(): TokenListing[] {
    return this.listings.filter(l => l.status === 'active');
  }

  // ── 操作 ──

  /** 上架售卖 Token */
  listToken(tokenId: string, price: number): boolean {
    if (!this.account) return false;
    if (price <= 0) return false;
    if (!this.account.tokenIds.includes(tokenId)) return false;
    // 检查是否已上架
    if (this.listings.some(l => l.tokenId === tokenId && l.status === 'active')) return false;

    const token = this.getToken(tokenId);
    if (!token) return false;

    const listing: TokenListing = {
      id: 'listing_' + uid(),
      tokenId,
      tokenName: token.name,
      tokenRarity: token.rarity,
      price,
      listedAt: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
      status: 'active',
    };
    this.listings.push(listing);

    this.transactions.push({
      id: 'tx_' + uid(),
      type: 'list',
      tokenId,
      tokenName: token.name,
      price,
      timestamp: new Date().toLocaleString('zh-CN'),
    });

    this.persist();
    this.eventBus.emit('token:listed', listing);
    this.emitUpdate();
    return true;
  }

  /** 取消挂单 */
  cancelListing(listingId: string): boolean {
    const listing = this.listings.find(l => l.id === listingId && l.status === 'active');
    if (!listing) return false;

    listing.status = 'cancelled';

    this.transactions.push({
      id: 'tx_' + uid(),
      type: 'cancel',
      tokenId: listing.tokenId,
      tokenName: listing.tokenName,
      price: listing.price,
      timestamp: new Date().toLocaleString('zh-CN'),
    });

    this.persist();
    this.eventBus.emit('token:cancel', listingId);
    this.emitUpdate();
    return true;
  }

  /** 更新个人信息 */
  updateBio(bio: string): void {
    if (!this.account) return;
    this.account.bio = bio;
    this.persist();
    this.emitUpdate();
  }

  /** 重置所有数据 */
  reset(): void {
    localStorage.removeItem(LS_KEY_ACCOUNT);
    localStorage.removeItem(LS_KEY_TOKENS);
    localStorage.removeItem(LS_KEY_LISTINGS);
    localStorage.removeItem(LS_KEY_TRANSACTIONS);
    this.account = null;
    this.tokens = [];
    this.listings = [];
    this.transactions = [];
    this.loaded = false;
    this.init();
  }
}
