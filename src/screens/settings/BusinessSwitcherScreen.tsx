import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import EmptyState from '../../components/EmptyState';
import Screen from '../../components/Screen';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../theme';

export default function BusinessSwitcherScreen() {
  const { colors, typography } = useTheme();
  const { session, switchBusiness } = useAuth();
  const [switching, setSwitching] = useState(false);

  const businesses = session?.businesses ?? [];
  const activeBusinessId = session?.activeBusinessId ?? businesses[0]?.id;

  const handleSwitch = async (businessId: string) => {
    if (!activeBusinessId || businessId === activeBusinessId) return;
    setSwitching(true);
    try {
      const res = await switchBusiness(businessId);
      if (!res.ok) {
        Alert.alert('No se pudo cambiar de negocio', res.error?.message || 'Inténtalo de nuevo.');
      }
    } finally {
      setSwitching(false);
    }
  };

  return (
    <Screen>
      <FlatList
        data={businesses}
        keyExtractor={(business) => business.id}
        style={styles.list}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text
              style={[
                styles.title,
                { color: colors.textPrimary, fontSize: typography.sizes.h1, fontWeight: typography.weights.extrabold },
              ]}
            >
              Mi negocio
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: typography.sizes.body }}>
              Elige con qué negocio trabajar en este equipo.
            </Text>
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            icon="storefront-outline"
            title="Sin negocios conectados"
            subtitle="Crea o únete a un negocio desde tu cuenta."
          />
        }
        renderItem={({ item, index }) => {
          const isActive = item.id === activeBusinessId;
          return (
            <Pressable
              onPress={() => handleSwitch(item.id)}
              disabled={isActive || switching}
              style={({ pressed }) => [
                styles.row,
                {
                  backgroundColor: colors.surface,
                  borderRadius: 16,
                  borderWidth: 1.5,
                  borderColor: isActive ? colors.primary : 'transparent',
                  opacity: pressed ? 0.85 : isActive ? 1 : 0.92,
                },
              ]}
            >
              <View style={[styles.iconCircle, { backgroundColor: isActive ? colors.primaryLight : colors.surfaceMuted }]}>
                <Text style={{ color: isActive ? colors.primary : colors.textSecondary, fontSize: typography.sizes.h2, fontWeight: '800' }}>
                  {item.name.trim().charAt(0).toUpperCase() || '?'}
                </Text>
              </View>
              <View style={styles.rowText}>
                <Text style={[styles.rowTitle, { color: colors.textPrimary, fontSize: typography.sizes.body }]}>{item.name}</Text>
                <Text style={[styles.rowSubtitle, { color: colors.textSecondary, fontSize: typography.sizes.caption }]}>
                  {index + 1 === 1 ? 'Negocio principal' : 'Negocio vinculado'} · rol {item.role || 'miembro'}
                </Text>
              </View>
              {isActive ? <Ionicons name="checkmark-circle" size={22} color={colors.primary} /> : null}
            </Pressable>
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
  },
  content: {
    padding: 24,
    gap: 10,
    paddingBottom: 40,
  },
  header: {
    gap: 6,
    marginBottom: 8,
  },
  title: {
    letterSpacing: -0.5,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
  },
  rowTitle: {
    fontWeight: '600',
  },
  rowSubtitle: {
    marginTop: 2,
  },
});