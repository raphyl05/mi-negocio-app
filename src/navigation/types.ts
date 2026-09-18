export type RootStackParamList = {
  Main: undefined;
  Cart: undefined;
  Payment: undefined;
  PaymentMethod: undefined;
  OrderComplete: { orderId: string };
  ProductForm: { productId?: string } | undefined;
};

export type TabParamList = {
  Home: undefined;
  Sales: undefined;
  Products: undefined;
  Settings: undefined;
};