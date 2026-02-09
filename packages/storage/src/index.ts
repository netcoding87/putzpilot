export type Exclusion = {
  memberId: string;
  reason?: string;
  createdAt: string;
};

export type SyncMeta = {
  lastSyncedAt?: string;
};
