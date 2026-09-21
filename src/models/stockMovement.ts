export type StockMovementType = 'SALE' | 'RETURN' | 'ADJUSTMENT' | 'INITIAL_STOCK';

export type StockMovement = {
  id: string;
  productId: string;
  quantity: number;
  movementType: StockMovementType;
  referenceId?: string;
  deviceId?: string;
  synced: boolean;
  createdAt: string;
};

export type StockMovementInput = Omit<StockMovement, 'id' | 'createdAt' | 'synced'> & {
  id?: string;
  createdAt?: string;
  synced?: boolean;
};