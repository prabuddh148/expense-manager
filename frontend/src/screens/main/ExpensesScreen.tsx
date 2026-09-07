import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { categoryApi, expenseApi, toAppError } from '../../api';
import {
  BottomSheet,
  Button,
  ConfirmDialog,
  DateTimeField,
  EmptyState,
  ErrorState,
  FloatingActionButton,
  SkeletonList,
  Screen,
} from '../../components';
import { AppStackParamList } from '../../navigation/types';
import { useToast } from '../../store/ToastContext';
import { useTheme } from '../../theme';
import { Category, Expense, ExpenseQuery } from '../../types/api';
import { formatDate, formatTime, relativeDay, toIsoDate } from '../../utils/date';
import { formatMoney } from '../../utils/format';

type Nav = NativeStackNavigationProp<AppStackParamList>;

const PAGE_SIZE = 20;
/** Sentinel the API understands for expenses filed under Other. */
const OTHER_CATEGORY_ID = 0;

type SortOption = { key: string; label: string; sortBy: ExpenseQuery['sortBy']; direction: ExpenseQuery['direction'] };

const SORTS: SortOption[] = [
  { key: 'date_desc', label: 'Newest first', sortBy: 'date', direction: 'desc' },
  { key: 'date_asc', label: 'Oldest first', sortBy: 'date', direction: 'asc' },
  { key: 'amount_desc', label: 'Highest amount', sortBy: 'amount', direction: 'desc' },
  { key: 'amount_asc', label: 'Lowest amount', sortBy: 'amount', direction: 'asc' },
];

export function ExpensesScreen() {
  const navigation = useNavigation<Nav>();
  const { colors, radius, spacing, typography } = useTheme();
  const { showToast } = useToast();

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [sort, setSort] = useState<SortOption>(SORTS[0]);
  const [dateFilter, setDateFilter] = useState<{ from?: string; to?: string }>({});
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [items, setItems] = useState<Expense[]>([]);
  const [page, setPage] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [last, setLast] = useState(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Typing shouldn't fire a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(timer);
  }, [search]);

  const query = useMemo<ExpenseQuery>(
    () => ({
      search: debouncedSearch || undefined,
      categoryId: categoryId ?? undefined,
      from: dateFilter.from,
      to: dateFilter.to,
      size: PAGE_SIZE,
      sortBy: sort.sortBy,
      direction: sort.direction,
    }),
    [categoryId, dateFilter.from, dateFilter.to, debouncedSearch, sort],
  );

  const load = useCallback(
    async (mode: 'initial' | 'refresh' | 'more', targetPage = 0) => {
      if (mode === 'initial') setLoading(items.length === 0);
      if (mode === 'refresh') setRefreshing(true);
      if (mode === 'more') setLoadingMore(true);

      try {
        const result = await expenseApi.list({ ...query, page: targetPage });
        setItems((current) =>
          mode === 'more' ? [...current, ...result.content] : result.content,
        );
        setPage(result.page);
        setLast(result.last);
        setTotalElements(result.totalElements);
        setError(null);
        setOffline(false);
      } catch (caught) {
        const appError = toAppError(caught);
        setError(appError.message);
        setOffline(appError.kind === 'network');
      } finally {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    },
    [items.length, query],
  );

  useEffect(() => {
    void load('initial', 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  // Coming back from Add/Edit should show the change without a manual pull.
  useFocusEffect(
    useCallback(() => {
      void load('refresh', 0);
      categoryApi
        .list()
        .then(setCategories)
        .catch(() => undefined);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [query]),
  );

  const activeFilterCount =
    (categoryId !== null ? 1 : 0) + (dateFilter.from || dateFilter.to ? 1 : 0) + (sort.key === 'date_desc' ? 0 : 1);

  // Long-pressing a row starts selection; from then on a plain tap toggles instead of
  // opening the expense, which is what makes bulk delete feel natural.
  const selectionMode = selected.size > 0;

  const toggleSelected = useCallback((id: number) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => setSelected(new Set()), []);

  // Android's back gesture should leave selection rather than leave the screen.
  useEffect(() => {
    if (!selectionMode) {
      return undefined;
    }
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      clearSelection();
      return true;
    });
    return () => subscription.remove();
  }, [clearSelection, selectionMode]);

  const deleteSelected = async () => {
    const ids = [...selected];
    setDeleting(true);
    // There is no bulk endpoint, so fire the deletes together and report partial failure
    // honestly rather than pretending the whole batch worked.
    const results = await Promise.allSettled(ids.map((id) => expenseApi.remove(id)));
    const failed = results.filter((result) => result.status === 'rejected').length;

    setDeleting(false);
    setConfirmDelete(false);
    clearSelection();

    if (failed === 0) {
      showToast(`${ids.length} ${ids.length === 1 ? 'expense' : 'expenses'} deleted`, 'success');
    } else {
      showToast(`${ids.length - failed} deleted, ${failed} could not be deleted`, 'error');
    }
    void load('refresh', 0);
  };

  const renderItem = useCallback(
    ({ item, index }: { item: Expense; index: number }) => {
      const previous = items[index - 1];
      const showHeader = !previous || previous.date !== item.date;
      const isSelecting = selected.size > 0;
      const isChecked = selected.has(item.id);

      return (
        <View>
          {showHeader ? (
            <Text
              style={[
                typography.caption,
                {
                  color: colors.textMuted,
                  marginTop: index === 0 ? 0 : spacing.lg,
                  marginBottom: spacing.sm,
                },
              ]}
            >
              {relativeDay(item.date).toUpperCase()}
            </Text>
          ) : null}

          <Pressable
            onPress={() =>
              isSelecting
                ? toggleSelected(item.id)
                : navigation.navigate('ExpenseDetail', { expenseId: item.id })
            }
            onLongPress={() => toggleSelected(item.id)}
            delayLongPress={250}
            style={({ pressed }) => [
              styles.row,
              {
                backgroundColor: isChecked ? colors.primarySoft : colors.surface,
                borderColor: isChecked ? colors.primary : colors.border,
                borderRadius: radius.md,
                padding: spacing.md,
                marginBottom: spacing.sm,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            {isSelecting ? (
              <View
                style={[
                  styles.checkbox,
                  {
                    backgroundColor: isChecked ? colors.primary : 'transparent',
                    borderColor: isChecked ? colors.primary : colors.border,
                  },
                ]}
              >
                {isChecked ? (
                  <Ionicons name="checkmark" size={16} color={colors.textInverse} />
                ) : null}
              </View>
            ) : (
              <View
                style={[
                  styles.iconBubble,
                  { backgroundColor: (item.categoryColor ?? colors.primary) + '22' },
                ]}
              >
                <Ionicons
                  name={(item.categoryIcon as keyof typeof Ionicons.glyphMap) ?? 'pricetag-outline'}
                  size={18}
                  color={item.categoryColor ?? colors.primary}
                />
              </View>
            )}

            <View style={[styles.flex, { marginLeft: spacing.md }]}>
              <Text style={[typography.body, { color: colors.text }]} numberOfLines={1}>
                {item.displayName}
              </Text>
              <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]} numberOfLines={1}>
                {[formatTime(item.time), item.description].filter(Boolean).join(' · ') || formatDate(item.date)}
              </Text>
            </View>

            <Text style={[typography.heading, { color: colors.text }]}>
              -{formatMoney(item.amount)}
            </Text>

            {/* Always on the card, so editing never needs a detour through the detail
                screen. Hidden while selecting, where the whole row is a checkbox. */}
            {!isSelecting ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Edit ${item.displayName}`}
                onPress={() => navigation.navigate('AddExpense', { expenseId: item.id })}
                hitSlop={10}
                style={({ pressed }) => [
                  styles.editButton,
                  {
                    backgroundColor: colors.surfaceAlt,
                    borderRadius: radius.sm,
                    marginLeft: spacing.md,
                    opacity: pressed ? 0.6 : 1,
                  },
                ]}
              >
                <Ionicons name="create-outline" size={16} color={colors.textMuted} />
              </Pressable>
            ) : null}
          </Pressable>
        </View>
      );
    },
    [colors, items, navigation, radius, selected, spacing, toggleSelected, typography],
  );

  if (loading && items.length === 0) {
    return (
      <Screen edges={['bottom']}>
        <SkeletonList rows={7} />
      </Screen>
    );
  }

  return (
    <Screen edges={['bottom']} padded={false}>
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm }}>
        {selectionMode ? (
          <View style={[styles.selectionBar, { marginBottom: spacing.md }]}>
            <Pressable onPress={clearSelection} hitSlop={10} accessibilityLabel="Cancel selection">
              <Ionicons name="close" size={24} color={colors.text} />
            </Pressable>

            <Text style={[typography.title, { color: colors.text, flex: 1, marginLeft: spacing.md }]}>
              {selected.size} selected
            </Text>

            <Pressable
              onPress={() => setSelected(new Set(items.map((expense) => expense.id)))}
              hitSlop={10}
              style={{ marginRight: spacing.lg }}
            >
              <Text style={[typography.label, { color: colors.primary }]}>All</Text>
            </Pressable>

            <Pressable
              onPress={() => setConfirmDelete(true)}
              hitSlop={10}
              accessibilityLabel="Delete selected expenses"
            >
              <Ionicons name="trash-outline" size={22} color={colors.danger} />
            </Pressable>
          </View>
        ) : (
          <Text style={[typography.title, { color: colors.text, marginBottom: spacing.md }]}>
            Expense history
          </Text>
        )}

        <View style={[styles.searchRow, { marginBottom: spacing.md }]}>
          <View
            style={[
              styles.searchBox,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderRadius: radius.md,
                paddingHorizontal: spacing.md,
              },
            ]}
          >
            <Ionicons name="search" size={18} color={colors.textMuted} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search name or note"
              placeholderTextColor={colors.textMuted}
              style={[typography.body, { flex: 1, color: colors.text, paddingVertical: spacing.md, marginLeft: spacing.sm }]}
              returnKeyType="search"
            />
            {search ? (
              <Pressable onPress={() => setSearch('')} hitSlop={8}>
                <Ionicons name="close-circle" size={18} color={colors.textMuted} />
              </Pressable>
            ) : null}
          </View>

          <Pressable
            onPress={() => setFiltersOpen(true)}
            style={[
              styles.filterButton,
              {
                backgroundColor: activeFilterCount ? colors.primary : colors.surface,
                borderColor: activeFilterCount ? colors.primary : colors.border,
                borderRadius: radius.md,
                marginLeft: spacing.sm,
              },
            ]}
          >
            <Ionicons
              name="options-outline"
              size={20}
              color={activeFilterCount ? colors.textInverse : colors.text}
            />
          </Pressable>
        </View>

        <Text style={[typography.caption, { color: colors.textMuted, marginBottom: spacing.sm }]}>
          {totalElements} {totalElements === 1 ? 'expense' : 'expenses'}
          {activeFilterCount ? ' · filtered' : ''}
        </Text>
      </View>

      {error && items.length === 0 ? (
        <ErrorState message={error} offline={offline} onRetry={() => load('initial', 0)} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          // Rows read the selection set, so the list has to know it changed.
          extraData={selected}
          contentContainerStyle={{
            paddingHorizontal: spacing.lg,
            paddingBottom: 120,
            flexGrow: 1,
          }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load('refresh', 0)}
              tintColor={colors.primary}
            />
          }
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (!last && !loadingMore && !refreshing) {
              void load('more', page + 1);
            }
          }}
          ListEmptyComponent={
            <EmptyState
              icon="receipt-outline"
              title={activeFilterCount ? 'Nothing matches those filters' : 'No expenses yet'}
              message={
                activeFilterCount
                  ? 'Try a wider date range or clear the category filter.'
                  : 'Tap the + button to record your first expense.'
              }
              // Only the filter reset lives here; adding is the centred button, and
              // offering it twice on the same screen was confusing.
              actionLabel={activeFilterCount ? 'Clear filters' : undefined}
              actionAlign="right"
              onAction={
                activeFilterCount
                  ? () => {
                      setCategoryId(null);
                      setDateFilter({});
                      setSort(SORTS[0]);
                    }
                  : undefined
              }
            />
          }
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.lg }} />
            ) : null
          }
          // Rows are a fixed height, so the list can skip measuring them.
          removeClippedSubviews
          initialNumToRender={12}
          maxToRenderPerBatch={12}
          windowSize={9}
        />
      )}

      {/* Hidden while selecting so the trash in the toolbar is the only destructive
          control on screen. */}
      {!selectionMode ? (
        <FloatingActionButton
          accessibilityLabel="Add expense"
          onPress={() => navigation.navigate('AddExpense')}
        />
      ) : null}

      <ConfirmDialog
        visible={confirmDelete}
        title={`Delete ${selected.size} ${selected.size === 1 ? 'expense' : 'expenses'}?`}
        message="The amounts go back onto your salary and category balances. This cannot be undone."
        confirmLabel="Delete"
        destructive
        loading={deleting}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={deleteSelected}
      />

      <BottomSheet visible={filtersOpen} onClose={() => setFiltersOpen(false)} title="Filter & sort">
        <Text style={[typography.label, { color: colors.textMuted, marginBottom: spacing.sm }]}>
          CATEGORY
        </Text>
        <View style={styles.chipWrap}>
          <FilterChip
            label="All"
            active={categoryId === null}
            onPress={() => setCategoryId(null)}
          />
          {categories.map((category) => (
            <FilterChip
              key={category.id}
              label={category.name}
              color={category.color}
              active={categoryId === category.id}
              onPress={() => setCategoryId(category.id)}
            />
          ))}
          <FilterChip
            label="Other"
            active={categoryId === OTHER_CATEGORY_ID}
            onPress={() => setCategoryId(OTHER_CATEGORY_ID)}
          />
        </View>

        <Text
          style={[
            typography.label,
            { color: colors.textMuted, marginTop: spacing.lg, marginBottom: spacing.sm },
          ]}
        >
          SORT BY
        </Text>
        <View style={styles.chipWrap}>
          {SORTS.map((option) => (
            <FilterChip
              key={option.key}
              label={option.label}
              active={sort.key === option.key}
              onPress={() => setSort(option)}
            />
          ))}
        </View>

        <Text
          style={[
            typography.label,
            { color: colors.textMuted, marginTop: spacing.lg, marginBottom: spacing.sm },
          ]}
        >
          DATE RANGE
        </Text>
        {/* Side by side rather than stacked: two full-width pickers pushed the sheet
            past the screen and forced it to scroll. */}
        <View style={styles.dateRow}>
          <View style={styles.half}>
            <DateTimeField
              label="From"
              mode="date"
              value={dateFilter.from ?? toIsoDate(new Date())}
              onChange={(value) => setDateFilter((current) => ({ ...current, from: value }))}
            />
          </View>
          <View style={[styles.half, { marginLeft: spacing.md }]}>
            <DateTimeField
              label="To"
              mode="date"
              value={dateFilter.to ?? toIsoDate(new Date())}
              onChange={(value) => setDateFilter((current) => ({ ...current, to: value }))}
            />
          </View>
        </View>

        <Button label="Apply" onPress={() => setFiltersOpen(false)} />
        <Button
          label="Clear all"
          variant="ghost"
          onPress={() => {
            setCategoryId(null);
            setDateFilter({});
            setSort(SORTS[0]);
            setSearch('');
            setFiltersOpen(false);
          }}
          style={{ marginTop: spacing.sm }}
        />
      </BottomSheet>
    </Screen>
  );
}

function FilterChip({
  label,
  active,
  color,
  onPress,
}: {
  label: string;
  active: boolean;
  color?: string | null;
  onPress: () => void;
}) {
  const { colors, radius, spacing, typography } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: active ? colors.primary : colors.surfaceAlt,
          borderColor: active ? colors.primary : colors.border,
          borderRadius: radius.pill,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
        },
      ]}
    >
      {color ? <View style={[styles.chipDot, { backgroundColor: color }]} /> : null}
      <Text
        style={[typography.caption, { color: active ? colors.textInverse : colors.text }]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', borderWidth: StyleSheet.hairlineWidth },
  iconBubble: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  checkbox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editButton: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  selectionBar: { flexDirection: 'row', alignItems: 'center' },
  searchRow: { flexDirection: 'row', alignItems: 'center' },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  filterButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  dateRow: { flexDirection: 'row' },
  half: { flex: 1 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', borderWidth: StyleSheet.hairlineWidth },
  chipDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
});
