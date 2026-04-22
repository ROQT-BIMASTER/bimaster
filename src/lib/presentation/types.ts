export interface PresentationGroup {
  key: string;
  storeName: string;
  storeAddress?: string;
  date: string;
  beforeUrl?: string;
  afterUrl?: string;
  beforeAi?: boolean;
  afterAi?: boolean;
}

export interface PresentationPlan {
  title: string;
  client?: string;
  objective?: string;
  notesByKey: Record<string, string>;
}
