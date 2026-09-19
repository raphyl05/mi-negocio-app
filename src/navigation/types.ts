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
  PrinterConfig: undefined;
  Dashboard: undefined;
  Security: undefined;
  Customers: undefined;
  Providers: undefined;
  DatosYRespaldo: undefined;
  Configuration: undefined;
};

export type TabParamList = {
  Home: undefined;
  Sales: undefined;
  Products: undefined;
  Settings: undefined;
};