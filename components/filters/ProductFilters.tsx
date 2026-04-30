'use client';

import { useState } from 'react';
import { ChevronDown, Filter } from 'lucide-react';
import type { BadgeKey, Locale, ProductCategory } from '@/lib/types';

export type ProductFilterValue = {
  categories: ProductCategory[];
  badges: BadgeKey[];
  colors: string[];
  minQuantities: number[];
};

type Group<T extends string | number> = {
  id: string;
  label: string;
  options: { value: T; label: string }[];
};

type Props = {
  value: ProductFilterValue;
  onChange: (value: ProductFilterValue) => void;
  locale?: Locale;
  availableCategories?: ProductCategory[];
  availableBadges?: BadgeKey[];
  availableColors?: { hex: string; name: string }[];
  availableMinQuantities?: number[];
  className?: string;
};

const categoryLabels: Record<
  ProductCategory,
  { 'fr-ca': string; 'en-ca': string }
> = {
  polo: { 'fr-ca': 'Polo', 'en-ca': 'Polo' },
  tshirt: { 'fr-ca': 'T-shirt', 'en-ca': 'T-shirt' },
  longsleeve: { 'fr-ca': 'Manches longues', 'en-ca': 'Long sleeve' },
  hoodie: { 'fr-ca': 'Chandail à capuchon', 'en-ca': 'Hoodie' },
  jacket: { 'fr-ca': 'Veste / Casquette', 'en-ca': 'Jacket / Cap' },
  youth: { 'fr-ca': 'Jeunesse', 'en-ca': 'Youth' },
};

const badgeLabels: Record<BadgeKey, { 'fr-ca': string; 'en-ca': string }> = {
  'quick-ship': { 'fr-ca': 'Expédition rapide', 'en-ca': 'Quick ship' },
  'best-embroidery': {
    'fr-ca': 'Meilleure broderie',
    'en-ca': 'Best for embroidery',
  },
  'best-screen-print': {
    'fr-ca': 'Meilleure sérigraphie',
    'en-ca': 'Best for screen print',
  },
  heavyweight: { 'fr-ca': 'Tissu robuste', 'en-ca': 'Heavyweight' },
  'kit-friendly': { 'fr-ca': 'Idéal pour kit', 'en-ca': 'Kit friendly' },
};

function FilterGroup<T extends string | number>({
  group,
  selected,
  onToggle,
  defaultOpen = true,
}: {
  group: Group<T>;
  selected: T[];
  onToggle: (value: T) => void;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-sand-300 py-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between text-left text-meta-xs font-semibold uppercase tracking-wider text-ink-950 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700"
      >
        {group.label}
        <ChevronDown
          aria-hidden
          className={`h-4 w-4 transition-transform duration-base ease-standard ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open ? (
        <ul className="mt-3 space-y-2">
          {group.options.map((opt) => {
            const isSel = selected.includes(opt.value);
            return (
              <li key={String(opt.value)}>
                <label className="flex cursor-pointer items-center gap-2 text-body-sm text-ink-950">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded-sm border-sand-300 text-ink-950 focus:ring-slate-700"
                    checked={isSel}
                    onChange={() => onToggle(opt.value)}
                  />
                  {opt.label}
                </label>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

export function ProductFilters({
  value,
  onChange,
  locale = 'fr-ca',
  availableCategories,
  availableBadges,
  availableColors,
  availableMinQuantities,
  className = '',
}: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const allCategories = (availableCategories ?? [
    'polo',
    'tshirt',
    'longsleeve',
    'hoodie',
    'jacket',
    'youth',
  ]) as ProductCategory[];
  const allBadges = (availableBadges ?? [
    'quick-ship',
    'best-embroidery',
    'best-screen-print',
    'heavyweight',
    'kit-friendly',
  ]) as BadgeKey[];
  const allColors = availableColors ?? [];
  const allMinQty = availableMinQuantities ?? [6, 12, 24, 50];

  const categoryGroup: Group<ProductCategory> = {
    id: 'category',
    label: locale === 'fr-ca' ? 'Catégorie' : 'Category',
    options: allCategories.map((c) => ({
      value: c,
      label: categoryLabels[c][locale],
    })),
  };
  const badgesGroup: Group<BadgeKey> = {
    id: 'badges',
    label: locale === 'fr-ca' ? 'Spécialités' : 'Specialties',
    options: allBadges.map((b) => ({
      value: b,
      label: badgeLabels[b][locale],
    })),
  };
  const colorGroup: Group<string> = {
    id: 'color',
    label: locale === 'fr-ca' ? 'Couleur' : 'Color',
    options: allColors.map((c) => ({ value: c.hex, label: c.name })),
  };
  const qtyGroup: Group<number> = {
    id: 'minqty',
    label:
      locale === 'fr-ca' ? 'Quantité minimum' : 'Minimum quantity',
    options: allMinQty.map((q) => ({ value: q, label: `${q}+` })),
  };

  function toggle<T>(arr: T[], v: T): T[] {
    return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
  }

  const body = (
    <>
      <FilterGroup
        group={categoryGroup}
        selected={value.categories}
        onToggle={(v) =>
          onChange({ ...value, categories: toggle(value.categories, v) })
        }
      />
      <FilterGroup
        group={badgesGroup}
        selected={value.badges}
        onToggle={(v) =>
          onChange({ ...value, badges: toggle(value.badges, v) })
        }
      />
      {colorGroup.options.length > 0 ? (
        <FilterGroup
          group={colorGroup}
          selected={value.colors}
          onToggle={(v) =>
            onChange({ ...value, colors: toggle(value.colors, v) })
          }
          defaultOpen={false}
        />
      ) : null}
      <FilterGroup
        group={qtyGroup}
        selected={value.minQuantities}
        onToggle={(v) =>
          onChange({
            ...value,
            minQuantities: toggle(value.minQuantities, v),
          })
        }
        defaultOpen={false}
      />
    </>
  );

  return (
    <div className={className}>
      <div className="lg:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          aria-expanded={mobileOpen}
          className="inline-flex h-10 items-center gap-2 rounded-sm border border-sand-300 bg-canvas-000 px-3 text-body-sm text-ink-950"
        >
          <Filter aria-hidden className="h-4 w-4" />
          {locale === 'fr-ca' ? 'Filtres' : 'Filters'}
        </button>
        {mobileOpen ? (
          <div className="mt-3 rounded-sm border border-sand-300 bg-canvas-000 p-4">
            {body}
          </div>
        ) : null}
      </div>
      <aside aria-label={locale === 'fr-ca' ? 'Filtres' : 'Filters'} className="hidden lg:block">
        {body}
      </aside>
    </div>
  );
}
