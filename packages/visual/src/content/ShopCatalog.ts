export type ShopProductKind = 'manual';

export interface ShopProductDef {
  id: string;
  kind: ShopProductKind;
  manualId: string;
  name: string;
  subtitle: string;
  price: number;
  rarity: 'common' | 'rare' | 'epic';
  description: string;
  effect: string;
  tags: string[];
}

export const SHOP_PRODUCTS: ShopProductDef[] = [
  {
    id: 'shop_manual_tuna_intro',
    kind: 'manual',
    manualId: 'manual_tuna_intro',
    name: '吐纳入门',
    subtitle: '基础内功 · 入门',
    price: 30,
    rarity: 'common',
    description: '最朴素的调息法门，适合少侠先把内力根基打稳。',
    effect: '立即学会吐纳入门，战斗中解锁「吐纳功」。',
    tags: ['内力', '入门', '近身武功'],
  },
  {
    id: 'shop_manual_digital_fumo_intro',
    kind: 'manual',
    manualId: 'manual_digital_fumo_intro',
    name: '金刚伏魔入门',
    subtitle: '数字门派 · 护体',
    price: 80,
    rarity: 'rare',
    description: '数字掌门流传的护体心法，讲究守住本金、稳住心神。',
    effect: '立即学会金刚伏魔入门，提升防御与悟性，并解锁战斗技能。',
    tags: ['防御', '护体', '数字门派'],
  },
  {
    id: 'shop_manual_strategy_deduction_notes',
    kind: 'manual',
    manualId: 'manual_strategy_deduction_notes',
    name: '实盘推演札记',
    subtitle: '策略秘籍 · 推演',
    price: 120,
    rarity: 'epic',
    description: '摘录实盘复盘、回撤控制与行情心跳的札记，适合提升策略理解。',
    effect: '立即研读札记，提升悟性与内力上限；后续可继续接入策略技能。',
    tags: ['策略', '实盘', '悟性'],
  },
];

export function getShopProduct(productId: string): ShopProductDef | undefined {
  return SHOP_PRODUCTS.find((product) => product.id === productId);
}
