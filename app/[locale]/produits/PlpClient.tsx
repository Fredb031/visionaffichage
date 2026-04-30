'use client';

import { useMemo, useTransition } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { SearchX } from 'lucide-react';

import { ProductGrid } from '@/components/product/ProductGrid';
import { ProductFilters } from '@/components/filters/ProductFilters';
import type { ProductFilterValue } from '@/components/filters/ProductFilters';
import { AppliedFilters } from '@/components/filters/AppliedFilters';
import type { AppliedFilter } from '@/components/filters/AppliedFilters';
import { SortSelect } from '@/components/filters/SortSelect';
import type { SortKey } from '@/components/filters/SortSelect';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/Button';
import { buildSearchString } from '@/lib/filters';
import type {
  BadgeKey,
  Locale,
  Product,
  ProductCategory,
} from '@/lib/types';

type Props = {
  locale: Locale;
  products: Product[];
  totalCount: number;
  initialFilters: {
    categories: ProductCategory[];
    badges: BadgeKey[];
    colors: string[];
  };
  initialSort: SortKey;
  availableColors: { hex: string; name: string }[];
  availableCategories: ProductCategory[];
  availableBadges: BadgeKey[];
};

const categoryLabels: Record<ProductCategory, { 'fr-ca': string; 'en-ca': string }> = {
  polo: { 'fr-ca': 'Polo', 'en-ca': 'Polo' },
  tshirt: { 'fr-ca': 'T-shirt', 'en-ca': 'T-shirt' },
  longsleeve: { 'fr-ca': 'Manches longues', 'en-ca': 'Long sleeve' },
  hoodie: { 'fr-ca': 'Chandail à capuchon', 'en-ca': 'Hoodie' },
  jacket: { 'fr-ca': 'Veste / Casquette', 'en-ca': 'Jacket / Cap' },
  youth: { 'fr-ca': 'Jeunesse', 'en-ca': 'Youth' },
};

const badgeLabels: Record<BadgeKey, { 'fr-ca': string; 'en-ca': string }> = {
  'quick-ship': { 'fr-ca': 'Expédition rapide', 'en-ca': 'Quick ship' },
  'best-embroidery': { 'fr-ca': 'Meilleure broderie', 'en-ca': 'Best for embroidery' },
  'best-screen-print': { 'fr-ca': 'Meilleure sérigraphie', 'en-ca': 'Best for screen print' },
  heavyweight: { 'fr-ca': 'Tissu robuste', 'en-ca': 'Heavyweight' },
  'kit-friendly': { 'fr-ca': 'Idéal pour kit', 'en-ca': 'Kit friendly' },
};

export function PlpClient({
  locale,
  products,
  totalCount,
  initialFilters,
  initialSort,
  availableColors,
  availableCategories,
  availableBadges,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const tPlp = useTranslations('plp');

  const value: ProductFilterValue = {
    categories: initialFilters.categories,
    badges: initialFilters.badges,
    colors: initialFilters.colors,
    minQuantities: [],
  };

  function pushUrl(
    nextCategories: ProductCategory[],
    nextBadges: BadgeKey[],
    nextColors: string[],
    nextSort: SortKey,
  ) {
    const qs = buildSearchString(
      {
        categories: nextCategories,
        badges: nextBadges,
        colors: nextColors,
      },
      nextSort,
    );
    startTransition(() => {
      router.push(`${pathname}${qs}`, { scroll: false });
    });
  }

  function handleFiltersChange(next: ProductFilterValue) {
    pushUrl(next.categories, next.badges, next.colors, initialSort);
  }

  function handleSortChange(next: SortKey) {
    pushUrl(
      initialFilters.categories,
      initialFilters.badges,
      initialFilters.colors,
      next,
    );
  }

  function handleClearAll() {
    startTransition(() => {
      router.push(pathname, { scroll: false });
    });
  }

  function handleRemove(key: string) {
    const [kind, raw] = key.split(':');
    if (!kind || !raw) return;
    if (kind === 'category') {
      pushUrl(
        initialFilters.categories.filter((c) => c !== raw),
        initialFilters.badges,
        initialFilters.colors,
        initialSort,
      );
    } else if (kind === 'badge') {
      pushUrl(
        initialFilters.categories,
        initialFilters.badges.filter((b) => b !== raw),
        initialFilters.colors,
        initialSort,
      );
    } else if (kind === 'color') {
      pushUrl(
        initialFilters.categories,
        initialFilters.badges,
        initialFilters.colors.filter((c) => c.toLowerCase() !== raw.toLowerCase()),
        initialSort,
      );
    }
  }

  const appliedChips: AppliedFilter[] = useMemo(() => {
    const out: AppliedFilter[] = [];
    for (const c of initialFilters.categories) {
      out.push({ key: `category:${c}`, label: categoryLabels[c][locale] });
    }
    for (const b of initialFilters.badges) {
      out.push({ key: `badge:${b}`, label: badgeLabels[b][locale] });
    }
    for (const hex of initialFilters.colors) {
      const found = availableColors.find(
        (c) => c.hex.toLowerCase() === hex.toLowerCase(),
      );
      out.push({
        key: `color:${hex}`,
        label: found ? found.name : hex,
      });
    }
    return out;
  }, [initialFilters, availableColors, locale]);

  // Keep a no-op suppressor for unused param `searchParams` (read indirectly via route).
  void searchParams;

  const resultsCount = products.length;
  const showingFiltered =
    appliedChips.length > 0 && resultsCount !== totalCount;

  return (
    <div className={`grid gap-10 lg:grid-cols-12 ${isPending ? 'opacity-90' : ''}`}>
      <aside className="lg:col-span-3">
        <ProductFilters
          value={value}
          onChange={handleFiltersChange}
          locale={locale}
          availableCategories={availableCategories}
          availableBadges={availableBadges}
          availableColors={availableColors}
        />
      </aside>

      <div className="lg:col-span-9">
        <div className="flex flex-col gap-4 border-b border-sand-300 pb-4 md:flex-row md:items-center md:justify-between">
          <p className="text-body-sm text-stone-600" aria-live="polite">
            {tPlp('results.count', { count: resultsCount })}
            {showingFiltered ? (
              <span className="ml-2 text-stone-600">
                {locale === 'fr-ca'
                  ? `(sur ${totalCount})`
                  : `(of ${totalCount})`}
              </span>
            ) : null}
          </p>
          <SortSelect
            value={initialSort}
            onChange={handleSortChange}
            locale={locale}
          />
        </div>

        {appliedChips.length > 0 ? (
          <AppliedFilters
            filters={appliedChips}
            onRemove={handleRemove}
            onClearAll={handleClearAll}
            locale={locale}
            className="mt-4"
          />
        ) : null}

        {resultsCount === 0 ? (
          <EmptyState
            icon={SearchX}
            title={tPlp('filters.empty.title')}
            description={tPlp('filters.empty.body')}
            className="mt-8"
            action={
              <Button
                variant="primary"
                size="md"
                onClick={handleClearAll}
              >
                {tPlp('filters.empty.cta')}
              </Button>
            }
          />
        ) : (
          <ProductGrid
            products={products}
            locale={locale}
            columns={3}
            className="mt-6"
          />
        )}
      </div>
    </div>
  );
}
