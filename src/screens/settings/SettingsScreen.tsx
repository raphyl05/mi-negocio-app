import EmptyState from '../../components/EmptyState';
import Screen from '../../components/Screen';

export default function SettingsScreen() {
  return (
    <Screen>
      <EmptyState
        icon="apps-outline"
        title="Más"
        subtitle="Resumen del día, cierre de caja y configuración (Fases 14, 4–6)."
      />
    </Screen>
  );
}