export type RootStackParamList = {
  Main: undefined;
  Cart: undefined;
  Payment: undefined;
  PaymentMethod: { orderId?: string } | undefined;
  OrderComplete: { orderId: string };
  ProductForm: { productId?: string } | undefined;
  OrderDetail: { orderId: string };
  CashClosure: undefined;
  BusinessEdit: undefined;
  InvoiceConfig: undefined;
  Dashboard: undefined;
  Security: undefined;
};

export type TabParamList = {
  Home: undefined;
  Sales: undefined;
  Products: undefined;
  Settings: undefined;
};