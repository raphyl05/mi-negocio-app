import EmptyState from '../../components/EmptyState';
import Screen from '../../components/Screen';

export default function ProductsScreen() {
  return (
    <Screen>
      <EmptyState
        icon="cube-outline"
        title="Productos"
        subtitle="Aquí administrarás tu catálogo de productos (Fase 10)."
      />
    </Screen>
  );
}