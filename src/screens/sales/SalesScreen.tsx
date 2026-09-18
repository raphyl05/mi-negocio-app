import EmptyState from '../../components/EmptyState';
import Screen from '../../components/Screen';

export default function SalesScreen() {
  return (
    <Screen>
      <EmptyState
        icon="receipt-outline"
        title="Ventas"
        subtitle="Aquí verás el historial y el detalle de las ventas del día (Fase 13)."
      />
    </Screen>
  );
}